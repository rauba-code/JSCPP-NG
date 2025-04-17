import { CRuntime, OpSignature } from "./rt";
import { ArithmeticVariable, IndexPointerVariable, PointerVariable, Variable, Function, variables, InitArithmeticValue, InitArithmeticVariable, InitPointerVariable, InitIndexPointerVariable, InitVariable, MaybeUnboundVariable } from "./variables";

function raiseSupportException(rt: CRuntime, l: Variable, r: Variable, op: string): never {
    rt.raiseException(`${rt.makeTypeStringOfVar(l)} does not support ${op} on ${rt.makeTypeStringOfVar(r)}`);
}

type OpHandler = {
    type: string,
    op: OpSignature,
    // no operators known to me return void
    default: ((rt: CRuntime, ...args: Variable[]) => MaybeUnboundVariable)
};

function binaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): InitArithmeticVariable {
    const retType = rt.promoteNumeric(l.t, r.t);
    const ret = variables.arithmetic(retType.sig, op(rt.arithmeticValue(l), rt.arithmeticValue(r)), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}

function unaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, op: (a: number) => number): InitArithmeticVariable {
    const ret = variables.arithmetic(l.t.sig, op(rt.arithmeticValue(l)), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}

function checkLeftAssign(rt: CRuntime, l: Variable): void {
    if (l.v.lvHolder === null) {
        rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
    }
    if (l.v.isConst) {
        rt.raiseException("Attempted assignment to a constant");
    }
}

function binaryArithmeticDirectAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
    checkLeftAssign(rt, l);
    const ret = variables.arithmetic(l.t.sig, rt.arithmeticValue(r), null);
    rt.adjustArithmeticValue(ret);
    l.v.state = "INIT";
    (l.v as InitArithmeticValue).value = ret.v.value;
    return ret;
}

function binaryArithmeticAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): InitArithmeticVariable {
    checkLeftAssign(rt, l);
    const ret = variables.arithmetic(l.t.sig, op(rt.arithmeticValue(l), rt.arithmeticValue(r)), null);
    rt.adjustArithmeticValue(ret);
    l.v.state = "INIT";
    (l.v as InitArithmeticValue).value = ret.v.value;
    return ret;
}

function binaryIntegerOp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number, opstr: string): InitArithmeticVariable {
    const properties = variables.arithmeticProperties;
    if (properties[l.t.sig].isFloat || properties[r.t.sig].isFloat) {
        raiseSupportException(rt, l, r, opstr);
    }
    const retType = rt.promoteNumeric(l.t, r.t);
    const ret = variables.arithmetic(retType.sig, op(rt.arithmeticValue(l), rt.arithmeticValue(r)), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}

function binaryIntegerAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number, opstr: string): InitArithmeticVariable {
    const properties = variables.arithmeticProperties;
    if (properties[l.t.sig].isFloat || properties[r.t.sig].isFloat) {
        raiseSupportException(rt, l, r, opstr);
    }
    checkLeftAssign(rt, l);
    const ret = variables.arithmetic(l.t.sig, op(rt.arithmeticValue(l), rt.arithmeticValue(r)), null);
    rt.adjustArithmeticValue(ret);
    l.v.state = "INIT";
    (l.v as InitArithmeticValue).value = ret.v.value;
    return ret;
}

function binaryArithmeticCmp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => boolean): InitArithmeticVariable {
    return variables.arithmetic("BOOL", op(rt.arithmeticValue(l), rt.arithmeticValue(r)) ? 1 : 0, null);
}

const defaultOpHandler: OpHandler[] = [
    {
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        op: "o(_*_)",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x * y);
        }
    },
    {
        op: "o(_/_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted division by zero") : x / y));
        }
    },
    {
        op: "o(_%_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted modulo zero") : x % y), "%");
        }
    },
    {
        op: "o(_+_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x + y);
        }
    },
    {
        op: "o(_-_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x - y);
        }
    },
    {
        op: "o(-_)",
        type: "FUNCTION Arithmetic ( Arithmetic )",
        default(rt, l: ArithmeticVariable): InitArithmeticVariable {
            return unaryArithmeticOp(rt, l, (x) => -x);
        }
    },
    {
        op: "o(_<<_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x << y, "<<");
        }
    },
    {
        op: "o(_>>_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x << y, ">>");
        }
    },
    {
        op: "o(_<_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x < y);
        }
    },
    {
        op: "o(_<=_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x <= y);
        }
    },
    {
        op: "o(_>_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x > y);
        }
    },
    {
        op: "o(_>=_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x >= y);
        }
    },
    {
        op: "o(_==_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x == y);
        }
    },
    {
        op: "o(_!=_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x != y);
        }
    },
    {
        op: "o(_&_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x & y, "&");
        }
    },
    {
        op: "o(_^_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x ^ y, "^");
        }
    },
    {
        op: "o(_|_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x | y, "|");
        }
    },
    {
        op: "o(_=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticDirectAssign(rt, l, r);
        }
    },
    {
        op: "o(_+=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x + y);
        }
    },
    {
        op: "o(_-=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x - y);
        }
    },
    {
        op: "o(_*=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x * y);
        }
    },
    {
        op: "o(_/=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted division by zero") : x / y));
        }
    },
    {
        op: "o(_%=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted modulo zero") : x % y), "%");
        }
    },
    {
        op: "o(_<<=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x << y, "<<");
        }
    },
    {
        op: "o(_>>=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, ">>");
        }
    },
    {
        op: "o(_&=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "&");
        }
    },
    {
        op: "o(_^=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "^");
        }
    },
    {
        op: "o(_|=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "|");
        }
    },
    {
        op: "o(_++)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, _l: ArithmeticVariable): InitArithmeticVariable {
            checkLeftAssign(rt, _l);
            const ret = variables.arithmetic(_l.t.sig, rt.arithmeticValue(_l), null);
            const l = _l as InitArithmeticVariable;
            l.v.value = ret.v.value as number + 1;
            if (rt.inrange(l.v.value, l.t, () => `overflow during post-increment '${rt.makeValueString(l)}' of type '${rt.makeTypeStringOfVar(l)}'`)) {
                rt.adjustArithmeticValue(l);
                return ret;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        op: "o(_--)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, _l: ArithmeticVariable): InitArithmeticVariable {
            checkLeftAssign(rt, _l);
            const ret = variables.arithmetic(_l.t.sig, rt.arithmeticValue(_l), null);
            const l = _l as InitArithmeticVariable;
            l.v.value = ret.v.value as number - 1;
            if (rt.inrange(l.v.value, l.t, () => `overflow during post-increment '${rt.makeValueString(l)}' of type '${rt.makeTypeStringOfVar(l)}'`)) {
                rt.adjustArithmeticValue(l);
                return ret;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        op: "o(++_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, _l: ArithmeticVariable): InitArithmeticVariable {
            checkLeftAssign(rt, _l);
            const ret = variables.arithmetic(_l.t.sig, rt.arithmeticValue(_l) + 1, null);
            const l = _l as InitArithmeticVariable;
            if (rt.inrange(l.v.value as number, l.t, () => `overflow during pre-increment '${rt.makeValueString(l)}' of type '${rt.makeTypeStringOfVar(l)}'`)) {
                rt.adjustArithmeticValue(ret);
                l.v.value = ret.v.value;
                return ret;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        op: "o(--_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, _l: ArithmeticVariable): InitArithmeticVariable {
            checkLeftAssign(rt, _l);
            const ret = variables.arithmetic(_l.t.sig, rt.arithmeticValue(_l) - 1, null);
            const l = _l as InitArithmeticVariable;
            if (rt.inrange(l.v.value as number, l.t, () => `overflow during pre-decrement '${rt.makeValueString(l)}' of type '${rt.makeTypeStringOfVar(l)}'`)) {
                rt.adjustArithmeticValue(ret);
                l.v.value = ret.v.value;
                return ret;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        // I don't know what is this but let's keep it
        op: "o(_,_)",
        type: "FUNCTION ParamObject ( ParamObject ParamObject )",
        default(_rt, _l, r) {
            return r as InitVariable;
        }
    },
    {
        op: "o(~_)",
        type: "FUNCTION Arithmetic ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): InitArithmeticVariable {
            checkLeftAssign(rt, l);
            const ret = variables.arithmetic(l.t.sig, ~rt.arithmeticValue(l), null);
            rt.adjustArithmeticValue(ret);
            return ret;
        }
    },
    {
        op: "o(!_)",
        type: "FUNCTION BOOL ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): InitArithmeticVariable {
            return variables.arithmetic("BOOL", rt.arithmeticValue(l) ? 0 : 1, null);
        }
    },
    {
        op: "o(_bool)",
        type: "FUNCTION BOOL ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): InitArithmeticVariable {
            return variables.arithmetic("BOOL", rt.arithmeticValue(l) ? 1 : 0, null);
        }
    },
    {
        op: "o(_==_)",
        type: "!Pointer FUNCTION BOOL ( ?0 ?0 )",
        default(rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>, r: PointerVariable | IndexPointerVariable<Variable>): InitArithmeticVariable {
            if (l.v.state === "UNINIT" || r.v.state === "UNINIT") {
                rt.raiseException("Attempted equality comparison of uninitialised pointer values");
            }
            // this works because pointers are always created from the same Variable["v"] object
            return variables.arithmetic("BOOL", l.v.pointee === r.v.pointee ? 1 : 0, null);
        }
    },
    {
        op: "o(_!=_)",
        type: "!Pointer FUNCTION BOOL ( ?0 ?0 )",
        default(rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>, r: PointerVariable | IndexPointerVariable<Variable>): InitArithmeticVariable {
            if (l.v.state === "UNINIT" || r.v.state === "UNINIT") {
                rt.raiseException("Attempted equality comparison of uninitialised pointer values");
            }
            // this works because pointers are always created from the same Variable["v"] object
            return variables.arithmetic("BOOL", !(l.v.pointee === r.v.pointee) ? 1 : 0, null);
        }
    },
    {
        op: "o(&_)",
        type: "!LValue FUNCTION PTR ?0 ( LREF ?0 )",
        default(rt: CRuntime, l: Variable | Function): InitPointerVariable | InitIndexPointerVariable<Variable> {
            if (l.v.lvHolder === null) {
                rt.raiseException("Cannot refer to an lvalue"); // unreachable
            } else if (l.v.lvHolder === "SELF") {
                return variables.pointer(l, null);
            }
            if (variables.asFunction(l) !== null) {
                rt.raiseException("Assertion failed: `l` must not be a Function");
            }
            const holder = l.v.lvHolder;
            const x = l as Variable;
            return variables.indexPointer<Variable>({ t: { sig: "ARRAY", object: x.t, size: holder.array.values.length }, v: holder.array }, l.v.lvHolder.index, null);
        }
    },
    {
        op: "o(*_)",
        type: "!LValue FUNCTION LREF ?0 ( LREF PTR ?0 )",
        default(rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>): InitVariable {
            const _lp = variables.asPointer(l);
            const _li = variables.asIndexPointer(l);
            if (_lp !== null) {
                const lp = rt.expectValue(_lp) as InitPointerVariable;
                if (lp.v.pointee === "VOID") {
                    rt.raiseException("Attempt to dereference a void-pointer");
                }
                return { t: lp.t.pointee, v: lp.v.pointee } as InitVariable;
            } else if (_li !== null) {
                const li = rt.expectValue(_li) as InitIndexPointerVariable<Variable>;
                if (li.v.index < 0 || li.v.index >= li.v.pointee.values.length) {
                    rt.raiseException("Segmentation fault: dereference of a pointer that points to an array element whose index is out of range");
                }
                return { t: li.t.array.object, v: li.v.pointee.values[li.v.index] } as InitVariable;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        op: "o(_[_])",
        type: "!LValue FUNCTION LREF ?0 ( LREF PTR ?0 Arithmetic )",
        default(rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>, index: ArithmeticVariable): MaybeUnboundVariable {
            const _lp = variables.asPointer(l);
            const _li = variables.asIndexPointer(l);
            const idx = rt.arithmeticValue(index);
            if (_lp !== null) {
                const lp = rt.expectValue(_lp) as InitPointerVariable;
                if (lp.v.pointee === "VOID") {
                    rt.raiseException("Attempt to dereference a void-pointer");
                }
                if (idx !== 0) {
                    rt.raiseException("Segmentation fault: non-zeroth member access of a pointer that is not an array");
                }
                return { t: lp.t.pointee, v: lp.v.pointee } as InitVariable;
            } else if (_li !== null) {
                const li = rt.expectValue(_li) as InitIndexPointerVariable<Variable>;
                const id = idx + li.v.index;
                if (id < 0 || id >= li.v.pointee.values.length) {
                    return { t: li.t.array.object, v: { lvHolder: { array: li.v.pointee, index: id }, isConst: false, state: "UNBOUND" } } as MaybeUnboundVariable
                }
                return { t: li.t.array.object, v: li.v.pointee.values[id] } as InitVariable;
            }
            rt.raiseException("Unreachable");
        }
    },
];

export function addDefaultOperations(rt: CRuntime): void {
    defaultOpHandler.forEach((x: OpHandler) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type.split(" ")));
    })
}

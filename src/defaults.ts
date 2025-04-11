import { CRuntime, OpSignature } from "./rt";
import { ArithmeticVariable, IndexPointerVariable, PointerVariable, Variable, Function, variables, IndexPointerValue } from "./variables";

function raiseSupportException(rt: CRuntime, l: Variable, r: Variable, op: string): never {
    rt.raiseException(`${rt.makeTypeStringOfVar(l)} does not support ${op} on ${rt.makeTypeStringOfVar(r)}`);
}

type OpHandler = {
    type: string,
    op: OpSignature,
    // no operators known to me return void
    default: ((rt: CRuntime, ...args: Variable[]) => Variable)
};

function binaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): ArithmeticVariable {
    const retType = rt.promoteNumeric(l.t, r.t);
    const ret = variables.arithmetic(retType.sig, op(rt.value(l), rt.value(r)), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}

function unaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, op: (a: number) => number): ArithmeticVariable {
    const ret = variables.arithmetic(l.t.sig, op(rt.value(l)), null);
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

function binaryArithmeticDirectAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
    checkLeftAssign(rt, l);
    const ret = variables.arithmetic(l.t.sig, rt.value(r), null);
    rt.adjustArithmeticValue(ret);
    l.v.value = ret.v.value;
    return ret;
}

function binaryArithmeticAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): ArithmeticVariable {
    checkLeftAssign(rt, l);
    const ret = variables.arithmetic(l.t.sig, op(rt.value(l), rt.value(r)), null);
    rt.adjustArithmeticValue(ret);
    l.v.value = ret.v.value;
    return ret;
}

function binaryIntegerOp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number, opstr: string): ArithmeticVariable {
    const properties = variables.arithmeticProperties;
    if (properties[l.t.sig].isFloat || properties[r.t.sig].isFloat) {
        raiseSupportException(rt, l, r, opstr);
    }
    const retType = rt.promoteNumeric(l.t, r.t);
    const ret = variables.arithmetic(retType.sig, op(rt.value(l), rt.value(r)), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}

function binaryIntegerAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number, opstr: string): ArithmeticVariable {
    const properties = variables.arithmeticProperties;
    if (properties[l.t.sig].isFloat || properties[r.t.sig].isFloat) {
        raiseSupportException(rt, l, r, opstr);
    }
    checkLeftAssign(rt, l);
    const ret = variables.arithmetic(l.t.sig, op(rt.value(l), rt.value(r)), null);
    rt.adjustArithmeticValue(ret);
    l.v.value = ret.v.value;
    return ret;
}

function binaryArithmeticCmp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => boolean): ArithmeticVariable {
    return variables.arithmetic("BOOL", op(rt.value(l), rt.value(r)) ? 1 : 0, null);
}

const defaultOpHandler: OpHandler[] = [
    {
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        op: "o(_*_)",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x * y);
        }
    },
    {
        op: "o(_/_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted division by zero") : x / y));
        }
    },
    {
        op: "o(_%_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted modulo zero") : x % y), "%");
        }
    },
    {
        op: "o(_+_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x + y);
        }
    },
    {
        op: "o(_-_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x - y);
        }
    },
    {
        op: "o(-_)",
        type: "FUNCTION Arithmetic ( Arithmetic )",
        default(rt, l: ArithmeticVariable): ArithmeticVariable {
            return unaryArithmeticOp(rt, l, (x) => -x);
        }
    },
    {
        op: "o(_<<_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x << y, "<<");
        }
    },
    {
        op: "o(_>>_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x << y, ">>");
        }
    },
    {
        op: "o(_<_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x < y);
        }
    },
    {
        op: "o(_<=_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x <= y);
        }
    },
    {
        op: "o(_>_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x > y);
        }
    },
    {
        op: "o(_>=_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x >= y);
        }
    },
    {
        op: "o(_==_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x == y);
        }
    },
    {
        op: "o(_!=_)",
        type: "FUNCTION BOOL ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x != y);
        }
    },
    {
        op: "o(_&_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x & y, "&");
        }
    },
    {
        op: "o(_^_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x ^ y, "^");
        }
    },
    {
        op: "o(_|_)",
        type: "FUNCTION Arithmetic ( Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x | y, "|");
        }
    },
    {
        op: "o(_=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            debugger;
            return binaryArithmeticDirectAssign(rt, l, r);
        }
    },
    {
        op: "o(_+=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x + y);
        }
    },
    {
        op: "o(_-=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x - y);
        }
    },
    {
        op: "o(_*=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x * y);
        }
    },
    {
        op: "o(_/=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted division by zero") : x / y));
        }
    },
    {
        op: "o(_%=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted modulo zero") : x % y), "%");
        }
    },
    {
        op: "o(_<<=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x << y, "<<");
        }
    },
    {
        op: "o(_>>=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, ">>");
        }
    },
    {
        op: "o(_&=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "&");
        }
    },
    {
        op: "o(_^=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "^");
        }
    },
    {
        op: "o(_|=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic Arithmetic )",
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "|");
        }
    },
    {
        op: "o(_++)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            checkLeftAssign(rt, l);
            const ret = variables.arithmetic(l.t.sig, rt.value(l), null);
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
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            checkLeftAssign(rt, l);
            const ret = variables.arithmetic(l.t.sig, rt.value(l), null);
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
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            checkLeftAssign(rt, l);
            const ret = variables.arithmetic(l.t.sig, rt.value(l) + 1, null);
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
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            checkLeftAssign(rt, l);
            const ret = variables.arithmetic(l.t.sig, rt.value(l) - 1, null);
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
            return r;
        }
    },
    {
        op: "o(~_)",
        type: "FUNCTION Arithmetic ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            checkLeftAssign(rt, l);
            const ret = variables.arithmetic(l.t.sig, ~rt.value(l), null);
            rt.adjustArithmeticValue(ret);
            return ret;
        }
    },
    {
        op: "o(!_)",
        type: "FUNCTION BOOL ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            return variables.arithmetic("BOOL", rt.value(l) ? 0 : 1, null);
        }
    },
    {
        op: "o(_bool)",
        type: "FUNCTION BOOL ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            return variables.arithmetic("BOOL", rt.value(l) ? 1 : 0, null);
        }
    },
    {
        op: "o(_==_)",
        type: "!Pointer FUNCTION BOOL ( ?0 ?0 )",
        default(_rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>, r: PointerVariable | IndexPointerVariable<Variable>): ArithmeticVariable {
            // this works because pointers are always created from the same Variable["v"] object
            return variables.arithmetic("BOOL", l.v.pointee === r.v.pointee ? 1 : 0, null);
        }
    },
    {
        op: "o(_!=_)",
        type: "!Pointer FUNCTION BOOL ( ?0 ?0 )",
        default(_rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>, r: PointerVariable | IndexPointerVariable<Variable>): ArithmeticVariable {
            // this works because pointers are always created from the same Variable["v"] object
            return variables.arithmetic("BOOL", !(l.v.pointee === r.v.pointee) ? 1 : 0, null);
        }
    },
    {
        op: "o(&_)",
        type: "!LValue FUNCTION PTR ?0 ( LREF ?0 )",
        default(rt: CRuntime, l: Variable | Function): PointerVariable | IndexPointerVariable<Variable> {
            if (l.v.lvHolder === null) {
                rt.raiseException("Cannot refer to an lvalue"); // unreachable
            } else if (l.v.lvHolder === "SELF") {
                return variables.pointer(l, null);
            }
            const holder: IndexPointerValue<Variable> = l.v.lvHolder;
            const x = l as Variable;
            return variables.indexPointer({ t: { sig: "ARRAY", object: x.t, size: holder.pointee.values.length }, v: holder.pointee }, l.v.lvHolder.index, null);
        }
    },
    {
        op: "o(*_)",
        type: "!LValue FUNCTION LREF ?0 ( PTR ?0 )",
        default(rt: CRuntime, l: PointerVariable | IndexPointerVariable<Variable>): Variable {
            const lp = variables.asPointer(l);
            const li = variables.asIndexPointer(l);
            if (lp !== null) {
                if (lp.v.pointee === "VOID") {
                    rt.raiseException("Attempt to dereference a void-pointer");
                }
                return { t: lp.t.pointee, v: lp.v.pointee } as Variable;
            } else if (li !== null) {
                if (li.v.index < 0 || li.v.index > li.v.pointee.values.length) {
                    rt.raiseException("Segmentation fault: dereference of a pointer that points to an array element whose index is out of range");
                }
                return { t: li.t.array.object, v: li.v.pointee.values[li.v.index] } as Variable;
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

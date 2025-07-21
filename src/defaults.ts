import { initializerListInit } from "./initializer_list";
import { CRuntime, OpSignature } from "./rt";
import { ArithmeticVariable, PointerVariable, Variable, Function, variables, InitArithmeticValue, InitArithmeticVariable, InitPointerVariable, InitIndexPointerVariable, InitVariable, MaybeUnboundVariable, PointeeVariable, InitDirectPointerVariable, ObjectType, ClassVariable } from "./variables";

function raiseSupportException(rt: CRuntime, l: Variable, r: Variable, op: string): never {
    rt.raiseException(`${rt.makeTypeStringOfVar(l)} does not support ${op} on ${rt.makeTypeStringOfVar(r)}`);
}

type OpHandler = {
    type: string,
    op: OpSignature,
    // no operators known to me return void
    default: ((rt: CRuntime, templateArgs: ObjectType[], ...args: Variable[]) => MaybeUnboundVariable)
};

function binaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): InitArithmeticVariable {
    const retType = rt.promoteNumeric(l.t, r.t);
    const ret = variables.arithmetic(retType.sig, op(rt.arithmeticValue(l), rt.arithmeticValue(r)), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}

function unaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, op: (a: number) => number): InitArithmeticVariable {
    const arithmeticProperties = variables.arithmeticProperties[l.t.sig];
    const ret = variables.arithmetic(arithmeticProperties.asSigned, op(rt.arithmeticValue(l)), null);
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
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        op: "o(_*_)",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x * y);
        }
    },
    {
        op: "o(_/_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted division by zero") : x / y));
        }
    },
    {
        op: "o(_%_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted modulo zero") : x % y), "%");
        }
    },
    {
        op: "o(_+_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x + y);
        }
    },
    {
        op: "o(_-_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x - y);
        }
    },
    {
        op: "o(-_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable): InitArithmeticVariable {
            return unaryArithmeticOp(rt, l, (x) => -x);
        }
    },
    {
        op: "o(+_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable): InitArithmeticVariable {
            return unaryArithmeticOp(rt, l, (x) => x);
        }
    },
    {
        op: "o(_<<_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x << y, "<<");
        }
    },
    {
        op: "o(_>>_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x >> y, ">>");
        }
    },
    {
        op: "o(_<_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x < y);
        }
    },
    {
        op: "o(_<=_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x <= y);
        }
    },
    {
        op: "o(_>_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x > y);
        }
    },
    {
        op: "o(_>=_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x >= y);
        }
    },
    {
        op: "o(_==_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x == y);
        }
    },
    {
        op: "o(_!=_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticCmp(rt, l, r, (x, y) => x != y);
        }
    },
    {
        op: "o(_&_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x & y, "&");
        }
    },
    {
        op: "o(_^_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x ^ y, "^");
        }
    },
    {
        op: "o(_|_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerOp(rt, l, r, (x, y) => x | y, "|");
        }
    },
    {
        op: "o(_=_)",
        type: "!Arithmetic FUNCTION ?0 ( LREF ?0 CLREF ?0 )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticDirectAssign(rt, l, r);
        }
    },
    {
        op: "o(_+=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x + y);
        }
    },
    {
        op: "o(_-=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x - y);
        }
    },
    {
        op: "o(_*=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => x * y);
        }
    },
    {
        op: "o(_/=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryArithmeticAssign(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted division by zero") : x / y));
        }
    },
    {
        op: "o(_%=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => ((y === 0) ? rt.raiseException("Attempted modulo zero") : x % y), "%");
        }
    },
    {
        op: "o(_<<=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x << y, "<<");
        }
    },
    {
        op: "o(_>>=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, ">>");
        }
    },
    {
        op: "o(_&=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "&");
        }
    },
    {
        op: "o(_^=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "^");
        }
    },
    {
        op: "o(_|=_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic CLREF Arithmetic )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return binaryIntegerAssign(rt, l, r, (x, y) => x >> y, "|");
        }
    },
    {
        op: "o(_++)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, _templateType: [], _l: ArithmeticVariable): InitArithmeticVariable {
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
        default(rt: CRuntime, _templateType: [], _l: ArithmeticVariable): InitArithmeticVariable {
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
        default(rt: CRuntime, _templateType: [], _l: ArithmeticVariable): InitArithmeticVariable {
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
        default(rt: CRuntime, _templateType: [], _l: ArithmeticVariable): InitArithmeticVariable {
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
        default(_rt, _templateType: [], _l, r) {
            return r as InitVariable;
        }
    },
    {
        op: "o(~_)",
        type: "FUNCTION Arithmetic ( CLREF Arithmetic )",
        default(rt: CRuntime, _templateType: [], l: ArithmeticVariable): InitArithmeticVariable {
            const ret = variables.arithmetic(l.t.sig, ~rt.arithmeticValue(l), null);
            rt.adjustArithmeticValue(ret);
            return ret;
        }
    },
    {
        op: "o(!_)",
        type: "FUNCTION BOOL ( CLREF Arithmetic )",
        default(rt: CRuntime, _templateType: [], l: ArithmeticVariable): InitArithmeticVariable {
            return variables.arithmetic("BOOL", rt.arithmeticValue(l) ? 0 : 1, null);
        }
    },
    {
        op: "o(_bool)",
        type: "FUNCTION BOOL ( CLREF Arithmetic )",
        default(rt: CRuntime, _templateType: [], l: ArithmeticVariable): InitArithmeticVariable {
            return variables.arithmetic("BOOL", rt.arithmeticValue(l) ? 1 : 0, null);
        }
    },
    {
        op: "o(_==_)",
        type: "!Pointer FUNCTION BOOL ( ?0 ?0 )",
        default(rt: CRuntime, _templateType: [], _l: PointerVariable<PointeeVariable>, _r: PointerVariable<PointeeVariable>): InitArithmeticVariable {
            const l = rt.expectValue(_l) as InitPointerVariable<PointeeVariable>;
            const r = rt.expectValue(_r) as InitPointerVariable<PointeeVariable>;
            if (l.v.subtype === "DIRECT" && r.v.subtype === "DIRECT") {
                // this works because pointers are always created from the same Variable["v"] object
                return variables.arithmetic("BOOL", l.v.pointee === r.v.pointee ? 1 : 0, null);
            } else if (l.v.subtype === "INDEX" && r.v.subtype === "INDEX") {
                return variables.arithmetic("BOOL", l.v.pointee === r.v.pointee && l.v.index === r.v.index ? 1 : 0, null);
            } else {
                return variables.arithmetic("BOOL", 0, null);
            }
        }
    },
    {
        op: "o(_!=_)",
        type: "!Pointer FUNCTION BOOL ( ?0 ?0 )",
        default(rt: CRuntime, _templateType: [], _l: PointerVariable<PointeeVariable>, _r: PointerVariable<PointeeVariable>): InitArithmeticVariable {
            const l = rt.expectValue(_l) as InitPointerVariable<PointeeVariable>;
            const r = rt.expectValue(_r) as InitPointerVariable<PointeeVariable>;
            if (l.v.subtype === "DIRECT" && r.v.subtype === "DIRECT") {
                return variables.arithmetic("BOOL", !(l.v.pointee === r.v.pointee) ? 1 : 0, null);
            } else if (l.v.subtype === "INDEX" && r.v.subtype === "INDEX") {
                return variables.arithmetic("BOOL", !(l.v.pointee === r.v.pointee && l.v.index === r.v.index) ? 1 : 0, null);
            } else {
                return variables.arithmetic("BOOL", 1, null);
            }
        }
    },
    {
        op: "o(_=_)",
        type: "!Pointer FUNCTION ?0 ( LREF ?0 ?0 )",
        default(rt, _templateType: [], _l: PointerVariable<PointeeVariable>, _r: PointerVariable<PointeeVariable>): InitPointerVariable<PointeeVariable> {
            const l = rt.expectValue(_l) as InitPointerVariable<PointeeVariable>;
            const r = rt.expectValue(_r) as InitPointerVariable<PointeeVariable>;
            if (!(l.t.sizeConstraint === null || l.t.sizeConstraint === r.t.sizeConstraint)) {
                rt.raiseException("Assignment between pointers of invalid sizes");
            }
            if (r.v.subtype === "INDEX") {
                if (variables.asFunctionType(l.t.pointee) !== null) {
                    rt.raiseException("Function-pointer assignment invalid inside arrays");
                }
                variables.indexPointerAssign(l as InitPointerVariable<Variable>, (r as InitIndexPointerVariable<Variable>).v.pointee, r.v.index, rt.raiseException);
            } else if (r.v.subtype === "DIRECT") {
                variables.directPointerAssign(l, r, rt.raiseException);
            }
            return l;
        }
    },
    {
        op: "o(_=_)",
        type: "!Class FUNCTION ?0 ( LREF ?0 CLREF ?0 )",
        default(rt, _templateType: [], l: ClassVariable, r: ClassVariable): ClassVariable {
            Object.entries(r.v.members).map(([k, v]) => l.v.members[k] = variables.clone(v, "SELF", false, rt.raiseException, true));
            return l;
        }
    },
    {
        op: "o(&_)",
        type: "!LValue FUNCTION PTR ?0 ( LREF ?0 )",
        default(rt: CRuntime, _templateType: [], l: Variable | Function): InitDirectPointerVariable<PointeeVariable> | InitIndexPointerVariable<Variable> {
            if (l.v.lvHolder === null) {
                rt.raiseException("Cannot refer to a non-lvalue"); // unreachable
            } else if (l.v.lvHolder === "SELF") {
                return variables.directPointer(l, null);
            }
            if (variables.asFunction(l) !== null) {
                rt.raiseException("Assertion failed: `l` must not be a Function"); // unreachable?
            }
            const holder = l.v.lvHolder;
            return variables.indexPointer<Variable>(holder.array, holder.index, false, null);
        }
    },
    {
        op: "o(&_)",
        type: "!Function FUNCTION PTR ?0 ( CLREF ?0 )",
        default(_rt: CRuntime, _templateType: [], l: Function): InitDirectPointerVariable<Function> {
            return variables.directPointer(l, null);
        }
    },
    {
        op: "o(*_)",
        type: "!LValue FUNCTION LREF ?0 ( PTR ?0 )",
        default(rt: CRuntime, _templateType: [], _l: PointerVariable<PointeeVariable>): MaybeUnboundVariable {
            if (variables.asFunctionType(_l.t.pointee) !== null) {
                rt.raiseException("Cannot dereference a function pointer");
            }
            const l = rt.expectValue(_l) as InitPointerVariable<Variable>;
            return variables.deref<Variable>(l) as MaybeUnboundVariable;
        }
    },
    {
        op: "o(_[_])",
        type: "!LValue FUNCTION LREF ?0 ( PTR ?0 Arithmetic )",
        default(rt: CRuntime, _templateType: [], _l: PointerVariable<PointeeVariable>, index: ArithmeticVariable): MaybeUnboundVariable {
            if (variables.asFunctionType(_l.t.pointee) !== null) {
                rt.raiseException("Cannot dereference a function pointer");
            }
            const l = rt.expectValue(_l) as InitPointerVariable<Variable>;
            const i = rt.arithmeticValue(index);
            if (i === 0) {
                return variables.deref(l) as MaybeUnboundVariable;
            }
            if (l.v.subtype === "INDEX") {
                return variables.arrayMember<Variable>(l.v.pointee, i + l.v.index) as MaybeUnboundVariable;
            }
            rt.raiseException("(Segmentation fault) attempt to access a non-array pointer member outside the bounds")
        }
    },
    {
        op: "o(_+_)",
        type: "!Pointer FUNCTION ?0 ( ?0 Arithmetic )",
        default(rt: CRuntime, _templateType: [], _l: PointerVariable<PointeeVariable>, index: ArithmeticVariable): PointerVariable<PointeeVariable> {
            if (variables.asFunctionType(_l.t.pointee) !== null) {
                rt.raiseException("Cannot move out of function pointer index");
            }
            const l = rt.expectValue(_l) as InitPointerVariable<Variable>;
            const i = rt.arithmeticValue(index);
            if (i === 0) {
                return variables.clone(l, null, false, rt.raiseException);
            }
            if (l.v.subtype === "INDEX") {
                return variables.indexPointer(l.v.pointee, l.v.index + i, false, null, false);
            }
            rt.raiseException("Not yet implemented");
        }
    },
    {
        op: "o(_||_)",
        type: "FUNCTION BOOL ( BOOL BOOL )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return variables.arithmetic("BOOL", rt.arithmeticValue(l) | rt.arithmeticValue(r), null, false)

        }
    },
    {
        op: "o(_&&_)",
        type: "FUNCTION BOOL ( BOOL BOOL )",
        default(rt, _templateType: [], l: ArithmeticVariable, r: ArithmeticVariable): InitArithmeticVariable {
            return variables.arithmetic("BOOL", rt.arithmeticValue(l) & rt.arithmeticValue(r), null, false)
        }
    },
];

export function addDefaultOperations(rt: CRuntime): void {
    initializerListInit(rt);

    defaultOpHandler.forEach((x: OpHandler) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), []);
    })
}

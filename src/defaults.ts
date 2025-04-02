import { CRuntime, OpSignature } from "./rt";
import { ArithmeticVariable, IndexPointerVariable, PointerVariable, Variable, variables } from "./variables";

function raiseSupportException(rt: CRuntime, l: Variable, r: Variable, op: string): never {
    rt.raiseException(`${rt.makeTypeString(l)} does not support ${op} on ${rt.makeTypeString(r)}`);
}

type OpHandler = {
    type: string,
    op: OpSignature,
    // no operators known to me return void
    default: ((rt: CRuntime, ...args: Variable[]) => Variable)
};

function binaryArithmeticOp(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): ArithmeticVariable {
    const retType = rt.promoteNumeric(l.t, r.t);
    const ret = variables.arithmetic(retType.sig, op(l.v.value, r.v.value), null);
    rt.adjustArithmeticValue(ret);
    return ret;
}


function binaryArithmeticAssign(rt: CRuntime, l: ArithmeticVariable, r: ArithmeticVariable, op: (a: number, b: number) => number): ArithmeticVariable {
    if (l.v.lvHolder === null) {
        rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
    }
    if (l.readonly) {
        rt.raiseException("Attempted assignment to a constant");
    }
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
    if (l.v.lvHolder === null) {
        rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
    }
    if (l.readonly) {
        rt.raiseException("Attempted assignment to a constant");
    }
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
        // FUNCTION Arithmetic ( Arithmetic Arithmetic )
        default(rt, l: ArithmeticVariable, r: ArithmeticVariable): ArithmeticVariable {
            return binaryArithmeticOp(rt, l, r, (x, y) => x - y);
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
            return binaryArithmeticAssign(rt, l, r, (_x, y) => y);
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
            if (l.v.lvHolder === null) {
                rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
            }
            if (!l.readonly) {
                rt.raiseException("Attempted assignment to a constant value")
            }
            const ret = variables.arithmetic(l.t.sig, rt.value(l), null);
            if (rt.inrange(l.v.value, l.t, () => `overflow during post-increment '${rt.makeValueString(l)}' of type '${rt.makeTypeString(l)}'`)) {
                rt.adjustArithmeticValue(ret);
                l.v.value = ret.v.value + 1;
                return ret;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        op: "o(_--)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            if (l.v.lvHolder === null) {
                rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
            }
            if (!l.readonly) {
                rt.raiseException("Attempted assignment to a constant value")
            }
            const ret = variables.arithmetic(l.t.sig, rt.value(l), null);
            if (rt.inrange(l.v.value, l.t, () => `overflow during post-decrement '${rt.makeValueString(l)}' of type '${rt.makeTypeString(l)}'`)) {
                rt.adjustArithmeticValue(ret);
                l.v.value = ret.v.value - 1;
                return ret;
            }
            rt.raiseException("Unreachable");
        }
    },
    {
        op: "o(++_)",
        type: "FUNCTION Arithmetic ( LREF Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
            if (l.v.lvHolder === null) {
                rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
            }
            if (!l.readonly) {
                rt.raiseException("Attempted assignment to a constant value")
            }
            const ret = variables.arithmetic(l.t.sig, rt.value(l) + 1, null);
            if (rt.inrange(l.v.value, l.t, () => `overflow during pre-increment '${rt.makeValueString(l)}' of type '${rt.makeTypeString(l)}'`)) {
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
            if (l.v.lvHolder === null) {
                rt.raiseException("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
            }
            if (!l.readonly) {
                rt.raiseException("Attempted assignment to a constant value")
            }
            const ret = variables.arithmetic(l.t.sig, rt.value(l) - 1, null);
            if (rt.inrange(l.v.value, l.t, () => `overflow during pre-decrement '${rt.makeValueString(l)}' of type '${rt.makeTypeString(l)}'`)) {
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
        type: "FUNCTION Object ( Object Object )",
        default(_rt, _l, r) {
            return r;
        }
    },
    {
        op: "o(~_)",
        type: "FUNCTION Arithmetic ( Arithmetic )",
        default(rt: CRuntime, l: ArithmeticVariable): ArithmeticVariable {
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
        type: "!Pointee FUNCTION BOOL ( ?0 ?0 )",
        default(_rt: CRuntime, l: PointerVariable | IndexPointerVariable, r: PointerVariable | IndexPointerVariable): ArithmeticVariable {
            return variables.arithmetic("BOOL", l.v.pointee === r.v.pointee ? 1 : 0, null);
        }
    },
    {
        op: "o(_!=_)",
        type: "!Pointee FUNCTION BOOL ( ?0 ?0 )",
        default(_rt: CRuntime, l: PointerVariable | IndexPointerVariable, r: PointerVariable | IndexPointerVariable): ArithmeticVariable {
            return variables.arithmetic("BOOL", !(l.v.pointee === r.v.pointee) ? 1 : 0, null);
        }
    },
];

export function addDefaultOperations(rt: CRuntime): void {
    defaultOpHandler.forEach((x: OpHandler) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type.split(" ")));
    })
}

/*const types_pointer : OpHandler[] = [
    {
        op: "o(_=_)",
        default(rt, l, r) {
            if (l.v.lvHolder === null) {
                rt.raiseException(rt.makeValString(l) + " is not a left value");
            } else if (l.readonly) {
                rt.raiseException(`assignment of read-only variable ${rt.makeValString(l)}`);
            }
            const t = rt.cast(l.t, r);
            l.t = t.t;
            l.v = t.v;
            return l;
        }
    },
    {
        op: "o(&_)",
        default(rt, l, r) {
            if (r === undefined) {
             s["function"]   if (rt.isArrayElementType(l)) {
                    if (l.array) {
                        return rt.val(rt.arrayPointerType(l.t, l.array.length), rt.makeArrayPointerValue(l.array, l.arrayIndex));
                    } else {
                        const t = rt.normalPointerType(l.t);
                        return rt.val(t, rt.makeNormalPointerValue(l));
                    }
                } else {
                    raiseSupportException(rt, l, r, "&");
                }
            } else {
                rt.raiseException("you cannot cast bitwise and on pointer");
            }
        }
    },
    {
        op: "o(_call)",
        default(rt, l, bindThis, ...args) {
            if (!rt.isPointerType(l) || !rt.isFunctionPointerType(l)) {
                rt.raiseException(`pointer target(${rt.makeValueString(l)}) is not a function`);
            } else {
                return rt.types["function"].handlers["o(())"].default(rt, l.v.target, bindThis, ...args);
            }
        }
    }
];
const types_function = [
    {
        op: "o(_call)",
        default(rt, l, bindThis: Variable, ...args) {
            if (!rt.isFunctionType(l)) {
                rt.raiseException(rt.makeTypeString(l?.t) + " does not support ()");
            } else {
                if (rt.isFunctionPointerType(l)) {
                    l = l.v.target;
                }
                if (l.v.target === null) {
                    rt.raiseException(`function ${l.v.name} does not seem to be implemented`);
                } else {
                    return rt.getCompatibleFunc(l.v.defineType, l.v.name, args)(rt, bindThis, ...args);
                }
            }
        }
    },
    {
        op: "o(&_)",
        default(rt, l) {
            if (rt.isFunctionType(l)) {
                const lt = l.t;
                if ("retType" in lt) {
                    const t = rt.functionPointerType(lt.retType, lt.signature);
                    return rt.val(t, rt.makeFunctionPointerValue(l, l.v.name, l.v.defineType, lt.signature, lt.retType));
                } else {
                    rt.raiseException(rt.makeTypeString(lt) + " is an operator function");
                }
            } else {
                rt.raiseException(rt.makeValueString(l) + " is not a function");
            }
        }
    }
];
const types_pointer_normal : OpHandler[] = [
    {
        op: "o(*_)",
        type: "!Pointee FUNCTION ?0 ( PTR ?0 )",
        default(rt, l, r) {
            if (r === undefined) {
                if (!rt.isNormalPointerType(l)) {
                    rt.raiseException(`pointer (${rt.makeValueString(l)}) is not a normal pointer`);
                } else {
                    if (l.v.target === null) {
                        rt.raiseException("you cannot dereference an unitialized pointer");
                    }
                    return l.v.target;
                }
            } else {
                rt.raiseException("you cannot multiply a pointer");
            }
        }
    },
    {
        op: "o(_->_)",
        type: "FUNCTION ObjectOrFunction ( PTR Class )",
        default(rt, l) {
            if (!rt.isNormalPointerType(l)) {
                rt.raiseException(`pointer (${rt.makeValueString(l)}) is not a normal pointer`);
            } else {
                return l.v.target;
            }
        }
    }
];
const types_pointer_array: OpHandler[] = [
    {
        op: "o(*_)",
        type: "!Pointee FUNCTION ?0 ( PTR ?0 )",
        default(rt, l, r) {
            if (r === undefined) {
                if (!rt.isArrayType(l)) {
                    rt.raiseException(`pointer (${rt.makeValueString(l)}) is not a normal pointer`);
                } else {
                    const arr = l.v.target;
                    const ret = {
                        type: "pointer",
                        left: true,
                        t: l.t.eleType,
                        array: arr,
                        arrayIndex: l.v.position,
                    }
                    return ret;
                }
            } else {
                rt.raiseException("you cannot multiply a pointer");
            }
        }
    },
    {
        op: "o(_[])",
        default(rt, l, r: Variable) {
            l = rt.captureValue(l);
            r = rt.types["pointer_array"].handlers["o(+)"].default(rt, l, r);
            return rt.types["pointer_array"].handlers["o(*)"].default(rt, r);
        }
    },
    {
        op: "o(_->_)",
        default(rt, l) {
            l = rt.types["pointer_array"].handlers["o(*)"].default(rt, l);
            return l;
        }
    },
    {
        op: "o(_-_)",
        default(rt, l, r) {
            if (rt.isArrayType(l)) {
                if (rt.isNumericType(r)) {
                    const i = rt.cast(rt.intTypeLiteral, r).v;
                    return rt.val(l.t, rt.makeArrayPointerValue(l.v.target, l.v.position - i));
                } else if (rt.isArrayType(r)) {
                    if (l.v.target === r.v.target) {
                        return l.v.position - r.v.position;
                    } else {
                        rt.raiseException("you cannot perform minus on pointers pointing to different arrays"); void
                        }
                } else {
                    rt.raiseException(rt.makeTypeString(r?.t) + " is not an array pointer type");
                }
            } else {
                rt.raiseException(rt.makeTypeString(l?.t) + " is not an array pointer type");
            }
        }
    },
    {
        op: "o(_<_)",
        default(rt, l, r) {
            if (rt.isArrayType(l) && rt.isArrayType(r)) {
                if (l.v.target === r.v.target) {
                    return l.v.position < r.v.position;
                } else {
                    rt.raiseException("you cannot perform compare on pointers pointing to different arrays");
                }
            } else {
                rt.raiseException(rt.makeTypeString(r?.t) + " is not an array pointer type");
            }
        }
    },
    {
        op: "o(_>_)",
        default(rt, l, r) {
            if (rt.isArrayType(l) && rt.isArrayType(r)) {
                if (l.v.target === r.v.target) {
                    return l.v.position > r.v.position;
                } else {
                    rt.raiseException("you cannot perform compare on pointers pointing to different arrays");
                }
            } else {
                rt.raiseException(rt.makeTypeString(r?.t) + " is not an array pointer type");
            }
        }
    },
    {
        op: "o(_<=_)",
        default(rt, l, r) {
            if (rt.isArrayType(l) && rt.isArrayType(r)) {
                if (l.v.target === r.v.target) {
                    return l.v.position <= r.v.position;
                } else {
                    rt.raiseException("you cannot perform compare on pointers pointing to different arrays");
                }
            } else {
                rt.raiseException(rt.makeTypeString(r?.t) + " is not an array pointer type");
            }
        }
    },
    {
        op: "o(_>=_)",
        default(rt, l, r) {
            if (rt.isArrayType(l) && rt.isArrayType(r)) {
                itypef (l.v.target === r.v.target) {
                    return l.v.position >= r.v.position;
                } else {
                    rt.raiseException("you cannot perform compare on pointers pointing to different arrays");
                }
            } else {
                rt.raiseException(rt.makeTypeString(r?.t) + " is not an array pointer type");
            }
        }
    },
    {
        op: "o(_+_)",
        default(rt, l, r) {
            if (rt.isArrayType(l) && rt.isNumericType(r)) {
                const i = rt.cast(rt.intTypeLiteral, r).v;
                return rt.val(l.t, rt.makeArrayPointerValue(l.v.target, l.v.position + i));
            } else if (rt.isStringType(l) && rt.isStringType(r as ArrayVariable)) {
                return rt.makeCharArrayFromString(rt.getStringFromCharArray(l) + rt.getStringFromCharArray(r as ArrayVariable));
            } else {
                rt.raiseException("cannot add non-numeric to an array pointer");
            }
        }
    },
    {
        op: "o(_+=_)",
        default(rt, l, r) {
            r = rt.types["pointer_array"].handlers["o(+)"].default(rt, l, r);
            return rt.types["pointer"].handlers["="].default(rt, l, r);
        }
    },
    {
        op: "o(_-=_)",
        default(rt, l, r) {
            r = rt.types["pointer_array"].handlers["o(-)"].default(rt, l, r);
            return rt.types["pointer"].handlers["="].default(rt, l, r);
        }
    },
    {
        op: "o(_++)",
        default(rt, l, dummy) {
            if (l.v.lvHolder === null) {
                rt.raiseException(rt.makeValString(l) + " is not a left value");
            }
            if (!rt.isArrayType(l)) {
                rt.raiseException(rt.makeTypeString(l?.t) + " is not an array pointer type");
            } else {
                if (dummy) {
                    return rt.val(l.t, rt.makeArrayPointerValue(l.v.target, l.v.position++));
                } else {
                    l.v.position++;
                    return l;
                }
            }
        }
    },
    {
        op: "o(_--)",
        default(rt, l, dummy) {
            if (l.v.lvHolder === null) {
                rt.raiseException(rt.makeValString(l) + " is not a left value");
            }
            if (!rt.isArrayType(l)) {
                rt.raiseException(rt.makeTypeString(l?.t) + " is not an array pointer type");
            } else {
                if (dummy) {
                    return rt.val(l.t, rt.makeArrayPointerValue(l.v.target, l.v.position--));
                } else {
                    l.v.position--;
                    return l;
                }
            }
        }
    }
];*/

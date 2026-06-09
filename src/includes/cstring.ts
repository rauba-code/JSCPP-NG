import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { strcmp } from "../shared/string_utils";
import { ArithmeticNumVariable, InitArithmeticBigVariable, InitArithmeticNumVariable, InitIndexPointerVariable, PointerVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("cstddef");
        common.regGlobalFuncs(rt, [{
            type: "FUNCTION I64 ( PTR I8 )",
            op: "strlen",
            default(rt: CRuntime, _templateTypes: [], _ptr: PointerVariable<ArithmeticNumVariable>): InitArithmeticBigVariable {
                const ptr = variables.asInitIndexPointerOfElem(_ptr, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                let cnt = 0;
                while (rt.arithmeticValue(variables.arrayMember(ptr.v.pointee, ptr.v.index + cnt)) !== 0) {
                    cnt++;
                }
                return variables.arithmeticBig("I64", BigInt(cnt), null, false);
            }
        }, {
            type: "FUNCTION I32 ( PTR I8 PTR I8 )",
            op: "strcmp",
            default(rt: CRuntime, _templateTypes: [], _a: PointerVariable<ArithmeticNumVariable>, _b: PointerVariable<ArithmeticNumVariable>): InitArithmeticNumVariable {
                const a = variables.asInitIndexPointerOfElem(_a, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                const b = variables.asInitIndexPointerOfElem(_b, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable b is not an initialised index pointer");
                return variables.arithmeticNum("I32", strcmp(rt, a, b), null, false);
            }
        }, {
            type: "FUNCTION PTR I8 ( PTR I8 PTR I8 )",
            op: "strcat",
            default(rt: CRuntime, _templateTypes: [], _a: PointerVariable<ArithmeticNumVariable>, _b: PointerVariable<ArithmeticNumVariable>): InitIndexPointerVariable<ArithmeticNumVariable> {
                const a = variables.asInitIndexPointerOfElem(_a, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                const b = variables.asInitIndexPointerOfElem(_b, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable b is not an initialised index pointer");
                let ai = 0;
                while (rt.arithmeticValue(variables.arrayMember(a.v.pointee, a.v.index + ai)) !== 0) {
                    ai++;
                }
                let bv : number;
                for (let bi = 0; (bv = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index + bi)) as number) !== 0; bi++) {
                    variables.arithmeticValueAssign(rt, (rt.unbound(variables.arrayMember(a.v.pointee, a.v.index + ai)) as ArithmeticNumVariable).v, bv);
                    ai++;
                }
                variables.arithmeticValueAssign(rt, (rt.unbound(variables.arrayMember(a.v.pointee, a.v.index + ai)) as ArithmeticNumVariable).v, 0);
                return b;
            }
        }, {
            type: "FUNCTION PTR I8 ( PTR I8 PTR I8 )",
            op: "strcpy",
            default(rt: CRuntime, _templateTypes: [], _a: PointerVariable<ArithmeticNumVariable>, _b: PointerVariable<ArithmeticNumVariable>): InitIndexPointerVariable<ArithmeticNumVariable> {
                const a = variables.asInitIndexPointerOfElem(_a, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                const b = variables.asInitIndexPointerOfElem(_b, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable b is not an initialised index pointer");
                let bv : number;
                let i : number;
                for (i = 0; (bv = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index + i)) as number) !== 0; i++) {
                    variables.arithmeticValueAssign(rt, (rt.unbound(variables.arrayMember(a.v.pointee, a.v.index + i)) as ArithmeticNumVariable).v, bv);
                }
                variables.arithmeticValueAssign(rt, (rt.unbound(variables.arrayMember(a.v.pointee, a.v.index + i)) as ArithmeticNumVariable).v, 0);
                return variables.indexPointer(a.v.pointee, a.v.index + i, false, null);
            }
        }]);

    }
}


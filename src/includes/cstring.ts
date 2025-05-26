import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticVariable, InitArithmeticVariable, PointerVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        common.regGlobalFuncs(rt, [{
            type: "FUNCTION I64 ( PTR I8 )",
            op: "strlen",
            default(rt: CRuntime, _ptr: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                const ptr = variables.asInitIndexPointerOfElem(_ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                let cnt = 0;
                while (rt.arithmeticValue(variables.arrayMember(ptr.v.pointee, ptr.v.index + cnt)) !== 0) {
                    cnt++;
                }
                return variables.arithmetic("I64", cnt, "SELF", false);
            }
        }]);

    }
}


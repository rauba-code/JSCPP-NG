import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticVariable, InitArithmeticVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        common.regGlobalFuncs(rt, [{
            type: "FUNCTION I64 ( I64 )",
            op: "time",
            default(rt: CRuntime, l: ArithmeticVariable): InitArithmeticVariable {
                if (rt.arithmeticValue(l) !== 0) {
                    rt.raiseException("time(): non-zero/non-nullptr argument is unsupported")
                }
                const unixTime = Math.floor(Date.now() / 1000);
                return variables.arithmetic("I64", unixTime, null, false);
            }
        }]);
    }
}



import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { ArithmeticBigVariable, InitArithmeticBigVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        common.regGlobalFuncs(rt, [{
            type: "FUNCTION I64 ( I64 )",
            op: "time",
            default(rt: CRuntime, _templateTypes: [], l: ArithmeticBigVariable): InitArithmeticBigVariable {
                if (rt.arithmeticValue(l) != 0) {
                    rt.raiseException("time(): non-zero/non-nullptr argument is unsupported")
                }
                const unixTime = BigInt(Math.floor(Date.now() / 1000));
                return variables.arithmeticBig("I64", unixTime, null, false);
            }
        }]);
    }
}



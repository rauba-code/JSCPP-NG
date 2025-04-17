import { CRuntime } from "../rt";
import { ArithmeticVariable, IndexPointerVariable, InitIndexPointerVariable, Variable, variables } from "../variables";

export = function (rt: CRuntime, _this: Variable, _dest: Variable, _src: Variable): IndexPointerVariable<ArithmeticVariable> {
    const _arithmetic = variables.uninitArithmetic("I8", null);
    const dest: InitIndexPointerVariable<ArithmeticVariable> | null = variables.asInitIndexPointerOfElem(_dest, _arithmetic);
    const src: InitIndexPointerVariable<ArithmeticVariable> | null = variables.asInitIndexPointerOfElem(_src, _arithmetic);
    if (src !== null && dest !== null) {
        const srcarr = src.v.pointee.values;
        let i = src.v.index;
        const destarr = dest.v.pointee.values;
        let j = dest.v.index;
        while (i < srcarr.length && j < destarr.length) {
            const srcval = srcarr[i];
            if (srcval.state !== "INIT") {
                rt.raiseException("source array contains uninitialised values");
            }
            variables.arithmeticValueAssign(destarr[j], srcval.value, rt.raiseException);
            if (srcval.value === 0) {
                break;
            }
            i++;
            j++;
        }
        if (i === srcarr.length) {
            rt.raiseException("source string does not have a pending null-terminator ('\\0')");
        } else if (j === destarr.length) {
            rt.raiseException("destination array is not big enough");
        } else {
            variables.arithmeticValueAssign(destarr[j], 0, rt.raiseException);
        }
        return dest;
    } else {
        rt.raiseException("destination or source is not an indexed pointer");
    }
};

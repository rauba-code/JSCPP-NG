import { CRuntime } from "../rt";
import { ArithmeticNumVariable, InitIndexPointerVariable, variables } from "../variables";

export = function (rt: CRuntime, _dest: InitIndexPointerVariable<ArithmeticNumVariable>, _src: InitIndexPointerVariable<ArithmeticNumVariable>): InitIndexPointerVariable<ArithmeticNumVariable> {
    const _arithmetic = variables.uninitArithmeticNum("I8", null);
    const dest: InitIndexPointerVariable<ArithmeticNumVariable> | null = variables.asInitIndexPointerOfElem(_dest, _arithmetic);
    const src: InitIndexPointerVariable<ArithmeticNumVariable> | null = variables.asInitIndexPointerOfElem(_src, _arithmetic);
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
            variables.arithmeticNumValueAssign(rt, destarr[j], srcval.value);
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
            variables.arithmeticNumValueAssign(rt, destarr[j], 0);
        }
        return dest;
    } else {
        rt.raiseException("destination or source is not an indexed pointer");
    }
};

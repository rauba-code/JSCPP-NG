import { CRuntime } from "../rt";
import { ArithmeticValue, ArithmeticVariable, IndexPointerVariable, Variable, variables } from "../variables";

export = function (rt: CRuntime, _this: Variable, _dest: Variable, _src: Variable): IndexPointerVariable {
    const dest: IndexPointerVariable | null = variables.asIndexPointer(_dest);
    const src: IndexPointerVariable | null = variables.asIndexPointer(_src);
    const elemType = dest.t.array.object;
    if (variables.asArithmeticType(elemType) === null || variables.asArithmeticType(src.t.array.object) === null) {
        rt.raiseException("Invalid array element types passed to internal function 'cstring_strcpy'");
    }
    if (src !== null && dest !== null) {
        const srcarr = src.v.pointee.values as ArithmeticValue[];
        let i = src.v.index;
        const destarr = dest.v.pointee.values as ArithmeticValue[];
        let j = dest.v.index;
        while (i < srcarr.length && j < destarr.length && srcarr[i].value !== 0) {
            variables.arithmeticAssign(destarr[j], srcarr[j].value, rt.raiseException);
            i++;
            j++;
        }
        if (i === srcarr.length) {
            rt.raiseException("source string does not have a pending \"\\0\"");
        } else if (j === destarr.length) {
            rt.raiseException("destination array is not big enough");
        } else {
            destarr[j] = variables.arithmetic(rt.charTypeLiteral, 0);
        }
    } else {
        rt.raiseException("destination or source is not an array");
    }
    return dest;
};

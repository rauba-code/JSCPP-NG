import { CRuntime } from "../rt";
import { ArithmeticVariable, IndexPointerVariable, Variable, variables } from "../variables";

export = function (rt: CRuntime, _this: Variable, _dest: Variable, _src: Variable): IndexPointerVariable<ArithmeticVariable> {
    const _dest0: IndexPointerVariable<Variable> | null = variables.asIndexPointer(_dest);
    const _src0: IndexPointerVariable<Variable> | null = variables.asIndexPointer(_src);
    if (_src0 !== null && _dest0 !== null) {
        const elemType = _dest0.t.array.object;
        if (variables.asArithmeticType(elemType) === null || variables.asArithmeticType(_src0.t.array.object) === null) {
            rt.raiseException("Invalid array element types passed to internal function 'cstring_strcpy'");
        }
        const dest = _dest0 as IndexPointerVariable<ArithmeticVariable>;
        const src = _src0 as IndexPointerVariable<ArithmeticVariable>;
        const srcarr = src.v.pointee.values;
        let i = src.v.index;
        const destarr = dest.v.pointee.values;
        let j = dest.v.index;
        while (i < srcarr.length && j < destarr.length && srcarr[i].value !== 0) {
            variables.arithmeticValueAssign(destarr[j], srcarr[j].value, rt.raiseException);
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

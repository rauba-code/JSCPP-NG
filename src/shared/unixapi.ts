import { CRuntime } from "../rt";
import { InitArithmeticVariable, InitIndexPointerVariable, ArithmeticVariable } from "../variables";

export const FD_STDIN: number = 0;
export const FD_STDOUT: number = 1;
export const FD_STDERR: number = 2;

export function write(rt: CRuntime, fd: InitArithmeticVariable, sz: InitIndexPointerVariable<ArithmeticVariable>): "VOID" {
    const stdio = rt.stdio();
    if (fd.v.value === FD_STDOUT) {
        debugger;
        stdio.write(rt.getStringFromCharArray(sz));
    } else {
        rt.raiseException("Non-stdout file descriptors are not yet implemented")
    }
    return "VOID";
}


import { CRuntime } from "../rt";
import { InitArithmeticVariable, InitIndexPointerVariable, ArithmeticVariable, variables } from "../variables";
import { sizeUntil } from "./string_utils";

export const FD_STDIN: number = 0;
export const FD_STDOUT: number = 1;
export const FD_STDERR: number = 2;

export function write(rt: CRuntime, fd: InitArithmeticVariable, sz: InitIndexPointerVariable<ArithmeticVariable>): "VOID" {
    if (fd.v.value === FD_STDOUT) {
        const stdio = rt.stdio();
        stdio.write(rt.getStringFromCharArray(sz, sizeUntil(rt, sz, variables.arithmetic("I8", 0, null))));
    } else if (fd.v.value >= 4) {
        rt.fileWrite(fd, sz);
    } else {
        rt.raiseException("Invalid file descriptor");
    }
    return "VOID";
}


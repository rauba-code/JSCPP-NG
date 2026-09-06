import { CRuntime } from "../rt";
import { InitIndexPointerVariable, InitArithmeticNumVariable, ArithmeticNumVariable } from "../variables";

export const FD_STDIN: number = 0;
export const FD_STDOUT: number = 1;
export const FD_STDERR: number = 2;

export function write(rt: CRuntime, _templateTypes: [], fd: InitArithmeticNumVariable, buf: InitIndexPointerVariable<ArithmeticNumVariable>, len: InitArithmeticNumVariable): "VOID" {
    if (fd.value === FD_STDOUT) {
        const stdio = rt.stdio();
        stdio.write(rt.getStringFromCharArray(buf, len.value));
    } else if (fd.value >= 4) {
        rt.fileWrite(fd, buf);
    } else {
        rt.raiseException("Invalid file descriptor");
    }
    return "VOID";
}


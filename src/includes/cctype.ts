import { CRuntime } from "../rt";
import * as common from "../shared/common"
import { ArithmeticVariable, InitArithmeticVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        function commonFormat(name: string, fn: ((x: number) => boolean)): common.FunHandler {
            return {
                op: name,
                type: "FUNCTION I32 ( I32 )",
                default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): InitArithmeticVariable {
                    return variables.arithmetic("I32", fn(rt.arithmeticValue(l)) ? 1 : 0, null);
                }
            };
        }
        function commonConvert(name: string, fn: ((x: number) => number)): common.FunHandler {
            return {
                op: name,
                type: "FUNCTION I32 ( I32 )",
                default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): InitArithmeticVariable {
                    return variables.arithmetic("I32", fn(rt.arithmeticValue(l)), null);
                }
            };
        }
        const ascii_tab: number = 0x7;
        const ascii_newline: number = 0x0A;
        const ascii_verticalTab: number = 0x0B;
        const ascii_formFeed: number = 0x0C;
        const ascii_carriageReturn: number = 0x0D;
        const ascii_space: number = 0x20;
        const ascii_0: number = 0x30;
        const ascii_9: number = 0x39;
        const ascii_A: number = 0x41;
        const ascii_F: number = 0x46;
        const ascii_Z: number = 0x5a;
        const ascii_a: number = 0x61;
        const ascii_f: number = 0x66;
        const ascii_z: number = 0x7a;
        common.regGlobalFuncs(rt, [
            commonFormat("isdigit", (x) => (x >= ascii_0 && x <= ascii_9)),
            commonFormat("isupper", (x) => (x >= ascii_A && x <= ascii_Z)),
            commonFormat("islower", (x) => (x >= ascii_a && x <= ascii_z)),
            commonFormat("isalpha", (x) => (x >= ascii_A && x <= ascii_Z) || (x >= ascii_a && x <= ascii_z)),
            commonFormat("isalnum", (x) => (x >= ascii_A && x <= ascii_Z) || (x >= ascii_a && x <= ascii_z) || (x >= ascii_0 && x <= ascii_9)),
            commonFormat("isascii", (x) => (x >= 0 && x <= 127)),
            commonFormat("isblank", (x) => (x === ascii_space || x === ascii_tab)),
            commonFormat("iscntrl", (x) => (x >= 0 || x < ascii_space) || x === 127),
            commonFormat("isprint", (x) => !((x >= 0 || x <= ascii_space) || x === 127)),
            commonFormat("ispunct", (x) => (x > ascii_space && x < ascii_0) || (x > ascii_9 && x < ascii_A) || (x > ascii_Z && x < ascii_a) || (x > ascii_z && x < 127)),
            commonFormat("isspace", (x) => [ascii_tab, ascii_newline, ascii_verticalTab, ascii_formFeed, ascii_carriageReturn, ascii_space].includes(x)),
            commonFormat("isxdigit", (x) => (x >= ascii_A && x <= ascii_F) || (x >= ascii_a && x <= ascii_f) || (x >= ascii_0 && x <= ascii_9)),
            commonConvert("toupper", (x) => (x >= ascii_a && x <= ascii_z) ? ((x - ascii_a) + ascii_A) : x),
            commonConvert("tolower", (x) => (x >= ascii_A && x <= ascii_Z) ? ((x - ascii_A) + ascii_a) : x),
        ])
    }
}

import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { AbstractVariable, ArithmeticVariable, InitArithmeticValue, InitArithmeticVariable, InitValue, PointerVariable, Variable, variables } from "../variables";
import * as utf8 from "../utf8";

interface DivType {
    readonly sig: "CLASS",
    readonly identifier: "div_t" | "ldiv_t" | "lldiv_t",
    readonly templateSpec: [],
    readonly memberOf: null,
};

type DivVariable = AbstractVariable<DivType, DivValue>;

interface DivValue extends InitValue<DivVariable> {
    members: {
        "quot": InitArithmeticVariable,
        "rem": InitArithmeticVariable,
    }
}

export = {
    load(rt: CRuntime) {
        common.regGlobalFuncs(rt, [
            {
                type: "FUNCTION I32 ( PTR I8 FunctionParamOrEnd",
                op: "printf",
                default(rt: CRuntime, _l: PointerVariable<ArithmeticVariable>, ...args: Variable[]): InitArithmeticVariable {
                    const l = variables.asInitIndexPointerOfElem(_l, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                    const ascii_space: number = 0x20;
                    const ascii_percentSign: number = 0x25;
                    const ascii_plusSign: number = 0x2B;
                    const ascii_minusSign: number = 0x2D;
                    const ascii_fullStop: number = 0x2E;
                    const ascii_0: number = 0x30;
                    const ascii_1: number = 0x31;
                    const ascii_2: number = 0x32;
                    const ascii_3: number = 0x33;
                    const ascii_4: number = 0x34;
                    const ascii_5: number = 0x35;
                    const ascii_6: number = 0x36;
                    const ascii_7: number = 0x37;
                    const ascii_8: number = 0x38;
                    const ascii_9: number = 0x39;
                    const ascii_c: number = 0x63;
                    const ascii_d: number = 0x64;
                    const ascii_f: number = 0x66;
                    let chr: number;
                    let state: "NORMAL" | "PERCENT" | "LENGTH" | "PRECISION" = "NORMAL";
                    type FormatOptions = {
                        flagAlternateForm: boolean;
                        flagZeroPad: boolean;
                        flagLeftAdjust: boolean;
                        flagSpaceBeforePositive: boolean;
                        flagAlwaysDisplaySign: boolean;
                        length: number | null;
                        precision: number | null;
                    }
                    const defaultFormatOptions: FormatOptions = {
                        flagAlternateForm: false, //       '#'
                        flagZeroPad: false, //             '0'
                        flagLeftAdjust: false, //          '-'
                        flagSpaceBeforePositive: false, // ' '
                        flagAlwaysDisplaySign: false, //   '+'
                        length: null,
                        precision: null,
                    }
                    function formatDecimal(options: FormatOptions, value: number): number[] {
                        if (options.flagAlternateForm) {
                            rt.raiseException("printf format: Not yet implemented");
                        }
                        // precision is always null for non-f formats
                        let sign = Math.sign(value);
                        value = Math.floor(Math.abs(value));
                        let output: number[] = [];
                        if (sign === 0) {
                            output.push(ascii_0);
                        } else {
                            while (value !== 0) {
                                output.push((value % 10) + ascii_0);
                                value = Math.floor(value / 10);
                            }
                            if (sign < 0) {
                                output.push(ascii_minusSign);
                            } else if (options.flagAlwaysDisplaySign) {
                                output.push(ascii_plusSign);
                            } 
                            else if (options.flagSpaceBeforePositive && (options.length === null || output.length >= options.length)) {
                                output.push(ascii_space);
                            }
                        }
                        if (options.length !== null && !options.flagLeftAdjust) {
                            while (options.length > output.length) {
                                output.push(options.flagZeroPad ? ascii_0 : ascii_space);
                            }
                        }
                        output = output.reverse();
                        if (options.length !== null && options.flagLeftAdjust) {
                            while (options.length > output.length) {
                                output.push(ascii_space);
                            }
                        }
                        return output;
                    }
                    let formatOptions: FormatOptions = { ...defaultFormatOptions };
                    let output: number[] = [];
                    for (let i = 0; (chr = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + i))) !== 0; i++) {
                        switch (state) {
                            case "PERCENT":
                                switch (chr) {
                                    case ascii_percentSign:
                                        output.push(ascii_percentSign);
                                        state = "NORMAL";
                                        break;
                                    case ascii_space:
                                        formatOptions.flagSpaceBeforePositive = true;
                                        break;
                                    case ascii_plusSign:
                                        formatOptions.flagAlwaysDisplaySign = true;
                                        break;
                                    case ascii_minusSign:
                                        formatOptions.flagLeftAdjust = true;
                                        break;
                                    case ascii_0:
                                        formatOptions.flagZeroPad = true;
                                        break;
                                    case ascii_1:
                                    case ascii_2:
                                    case ascii_3:
                                    case ascii_4:
                                    case ascii_5:
                                    case ascii_6:
                                    case ascii_7:
                                    case ascii_8:
                                    case ascii_9:
                                        formatOptions.length = chr - ascii_0;
                                        state = "LENGTH";
                                        break;
                                    case ascii_fullStop:
                                        state = "PRECISION";
                                        break;
                                    case ascii_d:
                                        const arithmeticVar = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatDecimal(formatOptions, rt.arithmeticValue(arithmeticVar)))
                                        state = "NORMAL";
                                        break;
                                    default:
                                        rt.raiseException("Malformed printf format sequence");
                                }
                                break;
                            case "LENGTH":
                                switch (chr) {
                                    case ascii_0:
                                    case ascii_1:
                                    case ascii_2:
                                    case ascii_3:
                                    case ascii_4:
                                    case ascii_5:
                                    case ascii_6:
                                    case ascii_7:
                                    case ascii_8:
                                    case ascii_9:
                                        formatOptions.length = ((formatOptions.length ?? 0) * 10) + (chr - ascii_0);
                                        break;
                                    case ascii_fullStop:
                                        state = "PRECISION";
                                        break;
                                    case ascii_d:
                                        const arithmeticVar = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatDecimal(formatOptions, rt.arithmeticValue(arithmeticVar)))
                                        state = "NORMAL";
                                        break;
                                    default:
                                        rt.raiseException("Malformed printf format sequence");
                                }
                                break;
                            case "PRECISION":
                                switch (chr) {
                                    case ascii_0:
                                    case ascii_1:
                                    case ascii_2:
                                    case ascii_3:
                                    case ascii_4:
                                    case ascii_5:
                                    case ascii_6:
                                    case ascii_7:
                                    case ascii_8:
                                    case ascii_9:
                                        formatOptions.precision = ((formatOptions.precision ?? 0) * 10) + (chr - ascii_0);
                                        break;
                                    default:
                                        rt.raiseException("Malformed printf format sequence");
                                }
                                break;
                            case "NORMAL":
                                switch (chr) {
                                    case ascii_percentSign:
                                        state = "PERCENT";
                                        formatOptions = { ...defaultFormatOptions };
                                        break;
                                    default:
                                        output.push(chr);
                                        break;
                                }
                                break;
                        }
                    }
                    if (state !== "NORMAL") {
                        rt.raiseException("Unfinished printf format sequence");
                    }
                    output.push(0);
                    const bytes = new Uint8Array(output);
                    const str = utf8.fromUtf8CharArray(bytes);
                    const stdio = rt.stdio();
                    stdio.write(str);
                    
                    return variables.arithmetic("I32", output.length, null);
                }
            },
        ]);

    }
}



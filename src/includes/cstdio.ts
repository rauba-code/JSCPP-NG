import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { AbstractVariable, ArithmeticVariable, InitArithmeticVariable, InitPointerVariable, InitValue, MaybeUnboundVariable, PointerVariable, Variable, variables } from "../variables";
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
        const ascii_tab: number = 0x7;
        const ascii_newline: number = 0x10;
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
        const ascii_s: number = 0x73;
        common.regGlobalFuncs(rt, [
            {
                type: "FUNCTION I32 ( PTR I8 FunctionParamOrEnd",
                op: "printf",
                default(rt: CRuntime, _templateTypes: [], _l: PointerVariable<ArithmeticVariable>, ...args: Variable[]): InitArithmeticVariable {
                    const l = variables.asInitIndexPointerOfElem(_l, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                    let chr: number;
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
                    function formatNumeric(category: "d" | "f", options: FormatOptions, value: number): number[] {
                        if (options.flagAlternateForm) {
                            rt.raiseException("printf format: Not yet implemented");
                        }
                        let sign = Math.sign(value);
                        value = Math.abs(value);
                        let rem = value - Math.floor(value);
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
                        const precision = options.precision ?? 6;
                        if (options.length !== null && !options.flagLeftAdjust) {
                            const precisionBytes = (category === "f") ? precision + 1 : 0;
                            while (options.length > output.length + precisionBytes) {
                                output.push(options.flagZeroPad ? ascii_0 : ascii_space);
                            }
                        }
                        output = output.reverse();
                        if (category === "f") {
                            output.push(ascii_fullStop);
                            let remOutput: number[] = [];
                            let fraction = Math.round(rem * Math.exp(precision * Math.LN10));
                            for (let i = 0; i < precision; i++) {
                                remOutput.push(Math.floor(fraction % 10) + ascii_0);
                                fraction /= 10;
                            }
                            output.push(...remOutput.reverse());

                        }
                        if (options.length !== null && options.flagLeftAdjust) {
                            while (options.length > output.length) {
                                output.push(ascii_space);
                            }
                        }
                        return output;
                    }
                    let formatOptions: FormatOptions = { ...defaultFormatOptions };
                    let output: number[] = [];
                    let state: "NORMAL" | "PERCENT" | "FLAGS" | "LENGTH" | "PRECISION" = "NORMAL";
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
                                        state = "FLAGS";
                                        break;
                                    case ascii_plusSign:
                                        formatOptions.flagAlwaysDisplaySign = true;
                                        state = "FLAGS";
                                        break;
                                    case ascii_minusSign:
                                        formatOptions.flagLeftAdjust = true;
                                        state = "FLAGS";
                                        break;
                                    case ascii_0:
                                        formatOptions.flagZeroPad = true;
                                        state = "FLAGS";
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
                                    case ascii_c:
                                        const arithmeticVar3 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(Math.floor(rt.arithmeticValue(arithmeticVar3)))
                                        state = "NORMAL";
                                        break;
                                    case ascii_s:
                                        const strVar = variables.asInitIndexPointerOfElem(args[0], variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index char pointer");
                                        let schr: number;
                                        for (let j = 0; (schr = rt.arithmeticValue(variables.arrayMember(strVar.v.pointee, strVar.v.index + j))) !== 0; j++) {
                                            output.push(schr);
                                        }
                                        args = args.slice(1);

                                        state = "NORMAL";
                                        break;
                                    case ascii_d:
                                        const arithmeticVar1 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("d", formatOptions, rt.arithmeticValue(arithmeticVar1)))
                                        state = "NORMAL";
                                        break;
                                    case ascii_f:
                                        const arithmeticVar2 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("f", formatOptions, rt.arithmeticValue(arithmeticVar2)))
                                        state = "NORMAL";
                                        break;
                                    default:
                                        rt.raiseException("Malformed printf format sequence");
                                }
                                break;
                            case "FLAGS":
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
                                        const arithmeticVar1 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("d", formatOptions, rt.arithmeticValue(arithmeticVar1)))
                                        state = "NORMAL";
                                        break;
                                    case ascii_f:
                                        const arithmeticVar2 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("f", formatOptions, rt.arithmeticValue(arithmeticVar2)))
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
                                        const arithmeticVar1 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("d", formatOptions, rt.arithmeticValue(arithmeticVar1)))
                                        state = "NORMAL";
                                        break;
                                    case ascii_f:
                                        const arithmeticVar2 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("f", formatOptions, rt.arithmeticValue(arithmeticVar2)))
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
                                    case ascii_f:
                                        const arithmeticVar2 = variables.asArithmetic(args[0]) ?? rt.raiseException("printf: Expected an arithmetic variable");
                                        args = args.slice(1);
                                        output.push(...formatNumeric("f", formatOptions, rt.arithmeticValue(arithmeticVar2)))
                                        state = "NORMAL";
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
                    //output.push(0);
                    const bytes = new Uint8Array(output);
                    const str = utf8.fromUtf8CharArray(bytes);
                    const stdio = rt.stdio();
                    stdio.write(str);

                    return variables.arithmetic("I32", output.length, null);
                }
            },
            {
                type: "FUNCTION I32 ( I32 )",
                op: "putchar",
                default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): InitArithmeticVariable {
                    const chr = rt.arithmeticValue(l);
                    const bytes = new Uint8Array([chr]);
                    const str = utf8.fromUtf8CharArray(bytes);
                    const stdio = rt.stdio();
                    stdio.write(str);
                    return variables.arithmetic(l.t.sig, chr, null);

                }

            },
            {
                type: "FUNCTION I32 ( PTR I8 )",
                op: "puts",
                default(rt: CRuntime, _templateTypes: [], _l: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                    const l = variables.asInitIndexPointerOfElem(_l, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                    const str = rt.getStringFromCharArray(l);
                    const stdio = rt.stdio();
                    stdio.write(str);
                    return variables.arithmetic("I32", 0, null);
                }

            },
            {
                type: "FUNCTION I32 ( PTR I8 PTR I8 FunctionParamOrEnd",
                op: "sscanf",
                default(rt: CRuntime, _templateTypes: [], _l: PointerVariable<ArithmeticVariable>, _fmt: PointerVariable<ArithmeticVariable>, ...args: Variable[]): InitArithmeticVariable {
                    const l = variables.asInitIndexPointerOfElem(_l, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                    const fmt = variables.asInitIndexPointerOfElem(_fmt, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                    let li = 0;
                    let lc: number = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + li));
                    let fc: number;
                    let state: "NORMAL" | "PERCENT" = "NORMAL";
                    const whitespace = [ascii_space, ascii_newline, ascii_tab];
                    for (let fi = 0; (fc = rt.arithmeticValue(variables.arrayMember(fmt.v.pointee, fmt.v.index + fi))) !== 0; fi++) {
                        if (lc === 0) {
                            rt.raiseException("sscanf: not yet implemented (bad input)");
                        }
                        if (state === "NORMAL") {
                            if (whitespace.includes(fc)) {
                                while (whitespace.includes(lc = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + li)))) {
                                    li++;
                                }
                            } else if (fc === ascii_percentSign) {
                                state = "PERCENT";
                            } else {
                                if (lc !== fc) {
                                    rt.raiseException("sscanf: not yet implemented (bad input)");
                                } else {
                                    li++;
                                    lc = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + li));
                                }
                            }
                        } else { // state === "PERCENT"
                            switch (fc) {
                                case ascii_percentSign:
                                    if (lc !== ascii_percentSign) {
                                        rt.raiseException("sscanf: not yet implemented (bad input)");
                                    } else {
                                        li++;
                                        lc = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + li));
                                    }
                                    break;
                                case ascii_s:
                                    const vstr = variables.asInitIndexPointerOfElem(args[0], variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable a is not an initialised index pointer");
                                    let vi = 0;
                                    args = args.slice(1);
                                    while (!whitespace.includes(lc) && lc !== 0) {
                                        variables.arithmeticAssign(rt.unbound(variables.arrayMember(vstr.v.pointee, vstr.v.index + vi)) as ArithmeticVariable, lc, rt.raiseException);
                                        vi++;
                                        li++;
                                        lc = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + li));
                                    }
                                    variables.arithmeticAssign(rt.unbound(variables.arrayMember(vstr.v.pointee, vstr.v.index + vi)) as ArithmeticVariable, 0, rt.raiseException);
                                    break
                                case ascii_d:
                                    let vtnum = 0;
                                    while (lc >= ascii_0 && lc <= ascii_9) {
                                        vtnum *= 10;
                                        vtnum += lc - ascii_0;
                                        li++;
                                        lc = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index + li));
                                    }
                                    const vptr = variables.asInitPointer(args[0]) ?? rt.raiseException("sscanf: Variable a is not an initialised index pointer");
                                    args = args.slice(1);
                                    if (vptr.t.pointee.sig === "FUNCTION") {
                                        rt.raiseException("sscanf: Expected a pointer to an arithmetic value");
                                    }
                                    const vpointee = variables.asArithmetic(rt.unbound(variables.deref(vptr as InitPointerVariable<Variable>) as MaybeUnboundVariable)) ?? rt.raiseException("sscanf: Expected a pointer to an arithmetic value");
                                    variables.arithmeticAssign(vpointee, vtnum, rt.raiseException);
                                    break
                                default:
                                    rt.raiseException("sscanf: invalid format");
                            }
                            state = "NORMAL";
                        }
                    }

                    return variables.arithmetic("I32", 0, null);
                }
            }
        ]);

    }
}



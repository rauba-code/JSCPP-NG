import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { AbstractVariable, ArithmeticVariable, InitArithmeticVariable, InitValue, PointerVariable, variables } from "../variables";
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
        const RAND_MAX = 32767;
        const rng = {
            m_w: 123456789,
            m_z: 987654321,
            mask: 0xffffffff,

            // Takes any integer
            seed(i: number) { rng.m_w = i },

            // Returns number between 0 (inclusive) and 1.0 (exclusive),
            // just like Math.random().
            random() {
                rng.m_z = ((36969 * (rng.m_z & 65535)) + (rng.m_z >> 16)) & rng.mask;
                rng.m_w = ((18000 * (rng.m_w & 65535)) + (rng.m_w >> 16)) & rng.mask;
                const result = ((rng.m_z << 16) + rng.m_w) & rng.mask;
                return Math.abs(result & RAND_MAX);
            }
        };
        function getWordString(rt: CRuntime, _l: PointerVariable<ArithmeticVariable>): string {
        const l = variables.asInitIndexPointerOfElem(_l, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
            let char = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index));
            while ([9, 10, 32].includes(char)) {
                l.v.index++;
                char = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index))
            }
            let wordValues: number[] = [];
            while (!([0, 9, 10, 32].includes(char))) {
                wordValues.push(char);
                l.v.index++;
                char = rt.arithmeticValue(variables.arrayMember(l.v.pointee, l.v.index))
            }
            return utf8.fromUtf8CharArray(new Uint8Array(wordValues));

        }
        function abs(rt: CRuntime, _templateTypes: [], _l: ArithmeticVariable): InitArithmeticVariable {
            const l = rt.arithmeticValue(_l);
            const retv = variables.arithmetic(_l.t.sig, Math.abs(l), null);
            rt.adjustArithmeticValue(retv);
            return retv;
        }
        rt.defineStruct("{global}", "div_t", [
            {
                name: "quot",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "rem",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
        ], {});
        rt.defineStruct("{global}", "ldiv_t", [
            {
                name: "quot",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "rem",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
        ], {});
        rt.defineStruct("{global}", "lldiv_t", [
            {
                name: "quot",
                variable: variables.uninitArithmetic("I64", "SELF"),
            },
            {
                name: "rem",
                variable: variables.uninitArithmetic("I64", "SELF"),
            },
        ], {});
        common.regGlobalFuncs(rt, [
            {
                type: "FUNCTION F64 ( PTR I8 )",
                op: "atof",
                default(rt: CRuntime, _templateTypes: [], l: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                    const num = Number.parseFloat(getWordString(rt, l));
                    return variables.arithmetic("F64", num, null);
                }
            },
            {
                type: "FUNCTION I32 ( PTR I8 )",
                op: "atoi",
                default(rt: CRuntime, _templateTypes: [], l: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                    const num = Number.parseInt(getWordString(rt, l));
                    return variables.arithmetic("I32", num, null);
                }
            },
            {
                type: "FUNCTION I32 ( PTR I8 )",
                op: "atol",
                default(rt: CRuntime, _templateTypes: [], l: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                    const num = Number.parseInt(getWordString(rt, l));
                    return variables.arithmetic("I32", num, null);
                }
            },
            { type: "FUNCTION I32 ( I32 )", op: "abs", default: abs },
            { type: "FUNCTION I64 ( I64 )", op: "abs", default: abs },
            { type: "FUNCTION I32 ( I32 )", op: "labs", default: abs },
            { type: "FUNCTION I64 ( I64 )", op: "llabs", default: abs },
            {
                type: "FUNCTION CLASS div_t < > ( I32 I32 )",
                op: "div",
                default(rt: CRuntime, _templateTypes: [], _l: ArithmeticVariable, _r: ArithmeticVariable): DivVariable {
                    const l = rt.arithmeticValue(_l);
                    const r = rt.arithmeticValue(_r);
                    if (r === 0) {
                        rt.raiseException("Integer division by zero");
                    }
                    const quot = Math.sign(l * r) * Math.floor(Math.abs(l / r));
                    const rem = l - (quot * r);
                    return variables.class(variables.classType("div_t", [], null), {
                        "quot": variables.arithmetic("I32", quot, null),
                        "rem": variables.arithmetic("I32", rem, null),
                    }, null) as DivVariable
                }
            },
            {
                type: "FUNCTION CLASS ldiv_t < > ( I32 I32 )",
                op: "ldiv",
                default(rt: CRuntime, _templateTypes: [], _l: ArithmeticVariable, _r: ArithmeticVariable): DivVariable {
                    const l = rt.arithmeticValue(_l);
                    const r = rt.arithmeticValue(_r);
                    if (r === 0) {
                        rt.raiseException("Integer division by zero");
                    }
                    const quot = Math.sign(l * r) * Math.floor(Math.abs(l / r));
                    const rem = l - (quot * r);
                    return variables.class(variables.classType("ldiv_t", [], null), {
                        "quot": variables.arithmetic("I32", quot, null),
                        "rem": variables.arithmetic("I32", rem, null),
                    }, null) as DivVariable
                }
            },
            {
                type: "FUNCTION CLASS lldiv_t < > ( I64 I64 )",
                op: "lldiv",
                default(rt: CRuntime, _templateTypes: [], _l: ArithmeticVariable, _r: ArithmeticVariable): DivVariable {
                    const l = rt.arithmeticValue(_l);
                    const r = rt.arithmeticValue(_r);
                    if (r === 0) {
                        rt.raiseException("Integer division by zero");
                    }
                    const quot = Math.sign(l * r) * Math.floor(Math.abs(l / r));
                    const rem = l - (quot * r);
                    return variables.class(variables.classType("lldiv_t", [], null), {
                        "quot": variables.arithmetic("I64", quot, null),
                        "rem": variables.arithmetic("I64", rem, null),
                    }, null) as DivVariable
                }
            },
            {
                type: "FUNCTION VOID ( U32 )",
                op: "srand",
                default(rt: CRuntime, _templateTypes: [], _l: ArithmeticVariable): "VOID" {
                    const l = rt.arithmeticValue(_l);
                    rng.seed(l);
                    return "VOID";
                }
            },
            {
                type: "FUNCTION I32 ( )",
                op: "rand",
                default(_rt: CRuntime, _templateTypes: []): InitArithmeticVariable {
                     return variables.arithmetic("I32", rng.random(), null, false);
                }
            },
        ]);
        rt.defVar("RAND_MAX", variables.arithmetic("I32", RAND_MAX, null, true));

    }
}



import { CRuntime } from "../rt";
import { InitArithmeticNumVariable, MaybeLeft, variables } from "../variables";
import { IOManipTokenType, IOManipTokenVariable, iomanip_token_mode, IStreamVariable, OStreamVariable } from "../shared/ios_base";
import { FunHandler, OpHandler } from "../shared/common";

function overloadIomanip(rt: CRuntime, structName: string) {
    const opHandlers: OpHandler[] = [{
        op: "o(_<<_)",
        type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > CLASS iomanip_token < > )`,
        default(rt: CRuntime, _templateTypes: [], l: OStreamVariable, r: IOManipTokenVariable): OStreamVariable {
            switch (r.members.mode.value) {
                case iomanip_token_mode.setbase:
                    const base = rt.arithmeticValue(r.members.param);
                    if (base !== 8 && base !== 10 && base !== 16) {
                        l.members.base.value = 10;
                    } else {
                        l.members.base.value = base;
                    }
                    break;
                case iomanip_token_mode.setfill:
                    l.members.fill.value = rt.arithmeticNumValue(r.members.param);
                    break;
                case iomanip_token_mode.setprecision:
                    l.members.precision.value = rt.arithmeticNumValue(r.members.param);
                    break;
                case iomanip_token_mode.setw:
                    l.members.width.value = rt.arithmeticNumValue(r.members.param);
                    break;
                case iomanip_token_mode.fixed:
                case iomanip_token_mode.scientific:
                case iomanip_token_mode.hexfloat:
                case iomanip_token_mode.defaultfloat:
                    l.members.float_display_mode.value = r.members.mode.value;
                    break;
                case iomanip_token_mode.left:
                case iomanip_token_mode.right:
                case iomanip_token_mode.internal:
                    l.members.position_mode.value = r.members.mode.value;
                    break;
                case iomanip_token_mode.boolalpha:
                    l.members.boolalpha.value = 1;
                    break;
                case iomanip_token_mode.noboolalpha:
                    l.members.boolalpha.value = 0;
                    break;
                default:
                    rt.raiseException("Unknown iomanip token mode");
            }

            return l;
        }
    }];

    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), [], null);
    });

}

function overloadIomanipInput(rt: CRuntime, structName: string) {
    const opHandlers: OpHandler[] = [{
        op: "o(_>>_)",
        type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > CLASS iomanip_token < > )`,
        default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, r: IOManipTokenVariable): any {
            switch (r.members.mode.value) {
                case iomanip_token_mode.setbase:
                    rt.raiseException("Not yet implemented")
                /*const base = rt.arithmeticValue(r.members.param);
                if (base !== 8 && base !== 10 && base !== 16) {
                    l.members.base.value = 10;
                } else {
                    l.members.base.value = base;
                }
                break;*/
                case iomanip_token_mode.setfill:
                    rt.raiseException("Not yet implemented")
                /*l.members.fill.value = rt.arithmeticValue(r.members.param);
                break;*/
                case iomanip_token_mode.setprecision:
                    rt.raiseException("Not yet implemented")
                /*l.members.precision.value = rt.arithmeticValue(r.members.param);
                break;*/
                case iomanip_token_mode.setw:
                    rt.raiseException("Not yet implemented")
                /*l.members.width.value = rt.arithmeticValue(r.members.param);
                break;*/
                case iomanip_token_mode.setfill:
                    rt.raiseException("Not yet implemented")
                /*l.members.fill.value = rt.arithmeticValue(r.members.param);
                break;*/
                case iomanip_token_mode.fixed:
                case iomanip_token_mode.scientific:
                case iomanip_token_mode.hexfloat:
                case iomanip_token_mode.defaultfloat:
                    rt.raiseException("Not yet implemented")
                /*l.members.float_display_mode.value = r.members.mode.value;
                break;*/
                case iomanip_token_mode.left:
                case iomanip_token_mode.right:
                case iomanip_token_mode.internal:
                    rt.raiseException("Not yet implemented")
                /*l.members.position_mode.value = r.members.mode.value;
                break;*/
                case iomanip_token_mode.boolalpha:
                    l.members.boolalpha.value = 1;
                    break;
                case iomanip_token_mode.noboolalpha:
                    l.members.boolalpha.value = 0;
                    break;
                case iomanip_token_mode.skipws:
                    l.members.skipws.value = 1;
                    break;
                case iomanip_token_mode.noskipws:
                    l.members.skipws.value = 0;
                    break;
                default:
                    rt.raiseException("Unknown iomanip token mode");
            }

            return l;
        }
    }];

    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), [], null);
    });
}

export = {
    load(rt: CRuntime) {

        rt.defineStruct("{global}", "iomanip_token", [
            {
                name: "mode",
                variable: variables.uninitArithmeticNum("I32", "SELF"),
            },
            {
                name: "param",
                variable: variables.uninitArithmeticNum("I32", "SELF"),
            },
        ], {});

        ["ostream", "ofstream"].forEach((x) => { if (x in rt.typeMap) { overloadIomanip(rt, x) } });
        ["istream", "ifstream"].forEach((x) => { if (x in rt.typeMap) { overloadIomanipInput(rt, x) } });

        const iomanipTokenType = rt.simpleType(["iomanip_token"]) as MaybeLeft<IOManipTokenType>;

        function createIOManipToken(rt: CRuntime, mode: number, param: number | null): IOManipTokenVariable {
            const iomanip_token = rt.defaultValue(iomanipTokenType.t, null) as IOManipTokenVariable;
            variables.arithmeticNumAssign(rt, iomanip_token.members.mode, mode);
            if (param !== null) {
                variables.arithmeticNumAssign(rt, iomanip_token.members.param, param);
            }
            return iomanip_token;

        }

        const funHandlers: FunHandler[] = [
            {
                op: "setbase",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticNumVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setbase, r.value);
                }
            },
            {
                op: "setfill",
                type: "FUNCTION CLASS iomanip_token < > ( I8 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticNumVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setfill, r.value);
                }
            },
            {
                op: "setprecision",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticNumVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setprecision, r.value);
                }
            },
            {
                op: "setw",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticNumVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setw, r.value);
                }
            },
        ]

        funHandlers.forEach((x) => {
            rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), [], null);
        });

        ["fixed", "scientific", "hexfloat", "defaultfloat", "left", "right", "internal", "boolalpha", "noboolalpha", "noskipws", "skipws"].forEach((x: keyof typeof iomanip_token_mode) => {
            const token = createIOManipToken(rt, iomanip_token_mode[x], null);
            rt.addToNamespace("std", x, token, true);
        })

        rt.addToNamespace("std", "oct", createIOManipToken(rt, iomanip_token_mode.setbase, 8), true);
        rt.addToNamespace("std", "dec", createIOManipToken(rt, iomanip_token_mode.setbase, 10), true);
        rt.addToNamespace("std", "hex", createIOManipToken(rt, iomanip_token_mode.setbase, 16), true);


    }
}


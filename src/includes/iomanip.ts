import { CRuntime } from "../rt";
import { InitArithmeticVariable, MaybeLeft, variables } from "../variables";
import { IOManipTokenType, IOManipTokenVariable, iomanip_token_mode, OStreamVariable } from "../shared/ios_base";
import { FunHandler, OpHandler } from "../shared/common";

function overloadIomanip(rt: CRuntime, structName: string) {
    const opHandlers: OpHandler[] = [{
        op: "o(_<<_)",
        type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > CLASS iomanip_token < > )`,
        default(rt: CRuntime, _templateTypes: [], l: OStreamVariable, r: IOManipTokenVariable): OStreamVariable {
            switch (r.v.members.mode.v.value) {
                case iomanip_token_mode.setbase:
                    const base = rt.arithmeticValue(r.v.members.param);
                    if (base !== 8 && base !== 10 && base !== 16) {
                        variables.arithmeticAssign(l.v.members.base, 10, rt.raiseException);
                    } else {
                        variables.arithmeticAssign(l.v.members.base, base, rt.raiseException);
                    }
                    break;
                case iomanip_token_mode.setfill:
                    variables.arithmeticAssign(l.v.members.fill, rt.arithmeticValue(r.v.members.param), rt.raiseException);
                    break;
                case iomanip_token_mode.setprecision:
                    variables.arithmeticAssign(l.v.members.precision, rt.arithmeticValue(r.v.members.param), rt.raiseException);
                    break;
                case iomanip_token_mode.setw:
                    variables.arithmeticAssign(l.v.members.width, rt.arithmeticValue(r.v.members.param), rt.raiseException);
                    break;
                case iomanip_token_mode.setfill:
                    variables.arithmeticAssign(l.v.members.fill, rt.arithmeticValue(r.v.members.param), rt.raiseException);
                    break;
                case iomanip_token_mode.fixed:
                case iomanip_token_mode.scientific:
                case iomanip_token_mode.hexfloat:
                case iomanip_token_mode.defaultfloat:
                    variables.arithmeticAssign(l.v.members.float_display_mode, r.v.members.mode.v.value, rt.raiseException);
                    break;
                case iomanip_token_mode.left:
                case iomanip_token_mode.right:
                case iomanip_token_mode.internal:
                    variables.arithmeticAssign(l.v.members.position_mode, r.v.members.mode.v.value, rt.raiseException);
                    break;
                default:
                    rt.raiseException("Unknown iomanip token mode");
            }

            return l;
        }
    }];

    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), []);
    });

}

export = {
    load(rt: CRuntime) {

        rt.defineStruct("{global}", "iomanip_token", [
            {
                name: "mode",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "param",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
        ]);

        ["ostream", "ofstream"].forEach((x) => { if (x in rt.typeMap) { overloadIomanip(rt, x) } });

        const iomanipTokenType = rt.simpleType(["iomanip_token"]) as MaybeLeft<IOManipTokenType>;

        function createIOManipToken(rt: CRuntime, mode: number, param: number | null): IOManipTokenVariable {
            const iomanip_token = rt.defaultValue(iomanipTokenType.t, null) as IOManipTokenVariable;
            variables.arithmeticAssign(iomanip_token.v.members.mode, mode, rt.raiseException);
            if (param !== null) {
                variables.arithmeticAssign(iomanip_token.v.members.param, param, rt.raiseException);
            }
            return iomanip_token;

        }

        const funHandlers: FunHandler[] = [
            {
                op: "setbase",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setbase, r.v.value);
                }
            },
            {
                op: "setfill",
                type: "FUNCTION CLASS iomanip_token < > ( I8 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setfill, r.v.value);
                }
            },
            {
                op: "setprecision",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setprecision, r.v.value);
                }
            },
            {
                op: "setw",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setw, r.v.value);
                }
            },
        ]

        funHandlers.forEach((x) => {
            rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), []);
        });

        ["fixed", "scientific", "hexfloat", "defaultfloat", "left", "right", "internal"].forEach((x: keyof typeof iomanip_token_mode) => {
            const token = createIOManipToken(rt, iomanip_token_mode[x], null);
            rt.addToNamespace("std", x, token);
        })

        rt.addToNamespace("std", "oct", createIOManipToken(rt, iomanip_token_mode.setbase, 8));
        rt.addToNamespace("std", "dec", createIOManipToken(rt, iomanip_token_mode.setbase, 10));
        rt.addToNamespace("std", "hex", createIOManipToken(rt, iomanip_token_mode.setbase, 16));


    }
}


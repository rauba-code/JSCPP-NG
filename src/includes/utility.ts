import { asResult } from "../interpreter";
import { CRuntime, OpSignature } from "../rt";
import * as common from "../shared/common";
import { PairType, PairVariable } from "../shared/utility";
import { Gen, InitArithmeticVariable, MaybeUnboundVariable, ObjectType, Variable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.defineStruct2("{global}", "pair", {
            numTemplateArgs: 2, factory: function*(dataItem: PairType<ObjectType, ObjectType>) {
                const firstVarYield = rt.defaultValue(dataItem.templateSpec[0], "SELF");
                const secondVarYield = rt.defaultValue(dataItem.templateSpec[1], "SELF");
                return [
                    {
                        name: "first",
                        variable: asResult(firstVarYield) ?? (yield* firstVarYield as Gen<Variable>),
                    },
                    {
                        name: "second",
                        variable: asResult(secondVarYield) ?? (yield* secondVarYield as Gen<Variable>),
                    },
                ]
            }
        }, ["first", "second"], {});
        rt.ct.list["pair"].src.push("CLASS __list_prototype < ?0 ?1 >".split(" "));
        common.regGlobalFuncs(rt, [
            {
                op: "make_pair",
                type: "!ParamObject !ParamObject FUNCTION CLASS pair < ?0 ?1 > ( ?0 ?1 )",
                default(rt: CRuntime, _templateTypes: [], lhs: Variable, rhs: Variable): PairVariable<Variable, Variable> {
                    return {
                        t: {
                            sig: "CLASS",
                            identifier: "pair",
                            memberOf: null,
                            templateSpec: [lhs.t, rhs.t]
                        },
                        v: {
                            isConst: false,
                            lvHolder: null,
                            state: "INIT",
                            members: {
                                first: variables.clone(rt, lhs, "SELF", false, true),
                                second: variables.clone(rt, rhs, "SELF", false, true),
                            }
                        }
                    }
                }
            }
        ])
        type __pair = PairVariable<Variable, Variable>;
        function* do_op(rt: CRuntime, lhs: Variable, rhs: Variable, op: OpSignature): Gen<number> {
            const opInst = rt.getOpByParams("{global}", op, [lhs, rhs], []);
            const opYield = rt.invokeCall(opInst, [], lhs, rhs);
            const opResultOrVoid = asResult(opYield) ?? (yield* opYield as Gen<MaybeUnboundVariable | "VOID">);
            const opResult = (opYield !== "VOID") ? opResultOrVoid : rt.raiseException(`operator${op}: Expected a non-void value`);
            return rt.arithmeticValue(opResult as MaybeUnboundVariable);
        }
        function* lex_cmp(rt: CRuntime, lhs: __pair, rhs: __pair): Gen<-1 | 0 | 1> {
            // side note: zero does not mean equality
            if ((yield* do_op(rt, lhs.v.members.first, rhs.v.members.first, "o(_<_)")) !== 0) {
                return -1;
            }
            if ((yield* do_op(rt, lhs.v.members.first, rhs.v.members.first, "o(_>_)")) !== 0) {
                return 1;
            }
            if ((yield* do_op(rt, lhs.v.members.second, rhs.v.members.second, "o(_<_)")) !== 0) {
                return -1;
            }
            if ((yield* do_op(rt, lhs.v.members.second, rhs.v.members.second, "o(_>_)")) !== 0) {
                return 1;
            }
            return 0;
        }
        function* lex_eq(rt: CRuntime, lhs: __pair, rhs: __pair): Gen<boolean> {
            if ((yield* do_op(rt, lhs.v.members.first, rhs.v.members.second, "o(_==_)")) === 0) {
                return false;
            }
            return ((yield* do_op(rt, lhs.v.members.second, rhs.v.members.second, "o(_==_)")) !== 0);
        }
        common.regOps(rt, [
            {
                op: "o(_<_)",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?2 ?3 > )",
                *default(rt: CRuntime, _templateTypes: [], lhs: __pair, rhs: __pair) {
                    return variables.arithmetic("BOOL", ((yield* lex_cmp(rt, lhs, rhs)) < 0) ? 1 : 0, null);
                }
            },
            {
                op: "o(_>_)",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?2 ?3 > )",
                *default(rt: CRuntime, _templateTypes: [], lhs: __pair, rhs: __pair) {
                    return variables.arithmetic("BOOL", ((yield* lex_cmp(rt, lhs, rhs)) > 0) ? 1 : 0, null);
                }
            },
            {
                op: "o(_<=_)",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?2 ?3 > )",
                *default(rt: CRuntime, _templateTypes: [], lhs: __pair, rhs: __pair) {
                    return variables.arithmetic("BOOL", ((yield* lex_cmp(rt, lhs, rhs)) < 0 || (yield* lex_eq(rt, lhs, rhs))) ? 1 : 0, null);
                }
            },
            {
                op: "o(_>=_)",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?2 ?3 > )",
                *default(rt: CRuntime, _templateTypes: [], lhs: __pair, rhs: __pair) {
                    return variables.arithmetic("BOOL", ((yield* lex_cmp(rt, lhs, rhs)) > 0 || (yield* lex_eq(rt, lhs, rhs))) ? 1 : 0, null);
                }
            },
            {
                op: "o(_==_)",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?2 ?3 > )",
                *default(rt: CRuntime, _templateTypes: [], lhs: __pair, rhs: __pair) {
                    return variables.arithmetic("BOOL", (yield* lex_eq(rt, lhs, rhs)) ? 1 : 0, null);
                }
            },
            {
                op: "o(_!=_)",
                type: "!ParamObject !ParamObject !ParamObject !ParamObject FUNCTION BOOL ( CLREF CLASS pair < ?0 ?1 > CLREF CLASS pair < ?2 ?3 > )",
                *default(rt: CRuntime, _templateTypes: [], lhs: __pair, rhs: __pair) {
                    return variables.arithmetic("BOOL", (yield* lex_eq(rt, lhs, rhs)) ? 0 : 1, null);
                }
            },
        ])
    }
};

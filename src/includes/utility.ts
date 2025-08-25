import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PairType, PairVariable } from "../shared/utility";
import { Gen, ObjectType, Variable, variables } from "../variables";

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
        });
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
                                first: variables.clone(lhs, "SELF", false, rt.raiseException, true),
                                second: variables.clone(rhs, "SELF", false, rt.raiseException, true),
                            }
                        }
                    }
                }
            }
        ])
    }
};

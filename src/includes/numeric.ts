import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { PointeeVariable, PointerVariable, Variable, variables, Gen, MaybeUnboundVariable, ResultOrGen } from "../variables";

export = {
    load(rt: CRuntime) {
        common.regGlobalFuncs(rt, [
            {
                op: "accumulate",
                type: "!ParamObject FUNCTION PTR ?0 ( PTR ?0 PTR ?0 ?0 )",
                *default(rt: CRuntime, _templateTypes: [], _first: PointerVariable<PointeeVariable>, _last: PointerVariable<PointeeVariable>, init: Variable): Gen<Variable> {
                    if (_first.t.pointee.sig === "FUNCTION" || _last.t.pointee.sig === "FUNCTION") {
                        rt.raiseException("accumulate(): Expected a pointer to an object variable");
                    }
                    const first = variables.asInitIndexPointer(_first) ?? rt.raiseException("find(): Expected 'first' to point to an element");
                    const last = variables.asInitIndexPointer(_last) ?? rt.raiseException("find(): Expected 'last' to point to an element");
                    if (first.v.pointee !== last.v.pointee) {
                        rt.raiseException("accumulate(): Expected 'first' and 'last' to point to an element of the same memory region");
                    }
                    const addInst = rt.getOpByParams("{global}", "o(_+_)", [init, init], []);
                    const setInst = rt.getOpByParams("{global}", "o(_=_)", [init, init], []);
                    for (; first.v.index < last.v.index; first.v.index++) {
                        const sumYield = rt.invokeCall(addInst, [], rt.unbound(variables.deref(first) as MaybeUnboundVariable), init) as ResultOrGen<Variable>;
                        const sumResult = asResult(sumYield) ?? (yield* sumYield as Gen<Variable>);
                        const setYield = rt.invokeCall(setInst, [], init, sumResult) as ResultOrGen<"VOID">;
                        asResult(setYield) ?? (yield* setYield as Gen<"VOID">);
                    }
                    return init;
                }
            }
        ]);
    }
};

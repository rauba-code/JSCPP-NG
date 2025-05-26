import { CRuntime, OpSignature } from "../rt";
import { ClassType, ResultOrGen, Variable, variables } from "../variables";

export type OpHandler = {
    type: string,
    op: OpSignature,
    default: ((rt: CRuntime, ...args: Variable[]) => ResultOrGen<Variable>)
};

export type FunHandler = {
    type: string,
    op: string,
    default: ((rt: CRuntime, ...args: Variable[]) => ResultOrGen<Variable | "VOID">)
};

export function regOps(rt: CRuntime, opHandlers: OpHandler[]) {
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type));
    });
}

export function regGlobalFuncs(rt: CRuntime, opHandlers: FunHandler[]) {
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type));
    });
}

export function regMemberFuncs(rt: CRuntime, structName: string, opHandlers: FunHandler[]) {
    const simpleType = rt.simpleType([structName]);
    let structType : ClassType | null;
    if (simpleType === "VOID" || (structType = variables.asClassType(simpleType.t)) === null) {
        rt.raiseException(`Type '${structName}' is not a class name`);
    }
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, structType as ClassType, x.op, rt.typeSignature(x.type));
    });
}

import { CRuntime, OpSignature } from "../rt";
import { ClassType, ObjectType, ResultOrGen, Variable, variables } from "../variables";

export type OpHandler = {
    type: string,
    op: OpSignature,
    default: ((rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]) => ResultOrGen<Variable>),
    /**
     * List of template specifier wildcard indices. 
     * Negative indices represent template types not bound to parameters.
     * Undefined value represents an empty array.
     * Example 1:
     * * C++ style: `template <typename T> void sort(T *first, T *last)`
     * * Internal representation: `!Pointee FUNCTION VOID ( PTR ?0 PTR ?0 )`
     * * templateTypes: `[ 0 ]` (`T` is bound to `!Pointee`, the 0th wildcard)
     * Example 2:
     * * C++ style: `template <typename T> T* new_array(unsigned long long int *n)`
     * * Internal representation: `!Pointee FUNCTION PTR ?0 ( u64 )`
     * * However, since parameters are checked at function match, it becomes: `FUNCTION Return ( u64 )`
     * * Therefore, templateTypes: `[ -1 ]`.
     */
    templateTypes?: number[],
};

export type FunHandler = {
    type: string,
    op: string,
    default: ((rt: CRuntime, templateTypes: ObjectType[], ...args: Variable[]) => ResultOrGen<Variable | "VOID">)
    /**
     * List of template specifier wildcard indices. 
     * Negative indices represent template types not bound to parameters.
     * Undefined value represents an empty array.
     * Example 1:
     * * C++ style: `template <typename T> void sort(T *first, T *last)`
     * * Internal representation: `!Pointee FUNCTION VOID ( PTR ?0 PTR ?0 )`
     * * templateTypes: `[ 0 ]` (`T` is bound to `!Pointee`, the 0th wildcard)
     * Example 2:
     * * C++ style: `template <typename T> T* new_array(unsigned long long int *n)`
     * * Internal representation: `!Pointee FUNCTION PTR ?0 ( u64 )`
     * * However, since parameters are checked at function match, it becomes: `FUNCTION Return ( u64 )`
     * * Therefore, templateTypes: `[ -1 ]`.
     */
    templateTypes?: number[],
};

export function regOps(rt: CRuntime, opHandlers: OpHandler[]) {
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), x.templateTypes ?? []);
    });
}

export function regGlobalFuncs(rt: CRuntime, opHandlers: FunHandler[]) {
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), x.templateTypes ?? []);
    });
}

export function regMemberFuncs(rt: CRuntime, structName: string, opHandlers: FunHandler[]) {
    const simpleType = rt.simpleType([structName]);
    let structType : ClassType | null;
    if (simpleType === "VOID" || (structType = variables.asClassType(simpleType.t)) === null) {
        rt.raiseException(`Type '${structName}' is not a class name`);
    }
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, structType as ClassType, x.op, rt.typeSignature(x.type), x.templateTypes ?? []);
    });
}

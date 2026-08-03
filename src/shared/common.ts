import { asResult } from "../interpreter";
import { CRuntime, FunctionCallInstance, OpSignature } from "../rt";
import { ArithmeticVariable, ClassType, Gen, InitIndexPointerVariable, MaybeUnboundVariable, ObjectType, ResultOrGen, Variable, variables } from "../variables";

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
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type, false), x.templateTypes ?? []);
    });
}

export function regGlobalFuncs(rt: CRuntime, opHandlers: FunHandler[]) {
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type, false), x.templateTypes ?? []);
    });
}

export function regMemberFuncs(rt: CRuntime, structName: string, opHandlers: FunHandler[]) {
    const simpleType = rt.simpleType([structName]);
    let structType: ClassType | null;
    if (simpleType === "VOID" || (structType = variables.asClassType(simpleType.t)) === null) {
        rt.raiseException(`Type '${structName}' is not a class name`);
    }
    opHandlers.forEach((x) => {
        rt.regFunc(x.default, structType as ClassType, x.op, rt.typeSignature(x.type, false), x.templateTypes ?? []);
    });
}

// invokeable operations

export function* invokeCmp(rt: CRuntime, cmpInst: FunctionCallInstance, lhs: Variable, rhs: Variable): Gen<boolean> {
    const cmpYield = rt.invokeCall(cmpInst, [], lhs, rhs) as ResultOrGen<ArithmeticVariable>;
    const cmpResult = rt.arithmeticValue(asResult(cmpYield) ?? (yield* cmpYield as Gen<ArithmeticVariable>))
    return cmpResult !== 0;
}

export function* invokeDeref(rt: CRuntime, fname: string, derefInst: FunctionCallInstance, reference: Variable): Gen<Variable> {
    const derefYield = rt.invokeCall(derefInst, [], reference);
    const derefResultOrVoid = asResult(derefYield) ?? (yield* derefYield as Gen<MaybeUnboundVariable | "VOID">);
    if (derefResultOrVoid === "VOID") {
        const typeOfPpResult = rt.makeTypeStringOfVar(reference);
        rt.raiseException(`${fname}(): expected '${typeOfPpResult}::operator*' to return an object, got void`);
    }
    const derefResult: Variable = rt.unbound(derefResultOrVoid);
    return derefResult;
}

export function* invokePp(rt: CRuntime, fname: string, ppInst: FunctionCallInstance, arg: Variable): Gen<Variable> {
    const ppYield = rt.invokeCall(ppInst, [], arg);
    const ppResultOrVoid = asResult(ppYield) ?? (yield* ppYield as Gen<MaybeUnboundVariable | "VOID">);
    if (ppResultOrVoid === "VOID") {
        const typeOfFirst = rt.makeTypeStringOfVar(arg);
        rt.raiseException(`${fname}(): expected '${typeOfFirst}::operator++' to return an object, got void`);
    }
    const ppResult: Variable = rt.unbound(ppResultOrVoid);
    return ppResult;
}

export function* invokeSet(rt: CRuntime, fname: string, setInst: FunctionCallInstance, lhs: Variable, rhs: Variable): Gen<Variable> {
    const setYield = rt.invokeCall(setInst, [], lhs, rhs);
    const setResultOrVoid = asResult(setYield) ?? (yield* setYield as Gen<MaybeUnboundVariable | "VOID">);
    if (setResultOrVoid === "VOID") {
        const typeOfSetResult = rt.makeTypeStringOfVar(lhs);
        rt.raiseException(`${fname}(): expected '${typeOfSetResult}::operator=' to return an object, got void`);
    }
    const setResult: Variable = rt.unbound(setResultOrVoid);
    return setResult;
}

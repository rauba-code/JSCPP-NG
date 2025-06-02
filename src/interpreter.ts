import { resolveIdentifier } from "./shared/string_utils";
import { CRuntime, FunctionCallInstance, OpSignature, RuntimeScope } from "./rt";
import { ArithmeticVariable, ClassType, Function, ClassVariable, InitArithmeticVariable, MaybeLeft, MaybeUnboundArithmeticVariable, ObjectType, ObjectValue, PointerType, Variable, variables, LValueIndexHolder, MaybeUnboundVariable, InitIndexPointerVariable, ArrayMemory, FunctionType, ResultOrGen, Gen, MaybeLeftCV, AnyType, PointerVariable, PointerValue, PointeeVariable, ArithmeticValue } from "./variables";

const sampleGeneratorFunction = function*(): Generator<null, void, void> {
    return yield null;
};

const sampleGenerator = sampleGeneratorFunction();

const isGenerator = (g: any): boolean => {
    return (g != null ? g.constructor : undefined) === sampleGenerator.constructor;
};

export function asResult<T>(g: ResultOrGen<T> | null): T | null {
    if (g !== null && (g as Gen<T>).constructor === sampleGenerator.constructor) {
        return null;
    }
    return g as T | null;
};

const isGeneratorFunction = (f: any): boolean => {
    return (f != null ? f.constructor : undefined) === sampleGeneratorFunction.constructor;
};

export class BaseInterpreter<TNode> {
    rt: CRuntime;
    currentNode: TNode;
    source: string;
    constructor(rt: CRuntime) {
        this.rt = rt;
    }
}

function isIterable(obj: any) {
    // checks for null and undefined
    if (obj == null) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

export interface StatementMeta {
    sLine: number,
    sColumn: number,
    sOffset: number,
    eLine: number,
    eColumn: number,
    eOffset: number
};
export interface XIdentifier extends StatementMeta {
    type: "Identifier",
    Identifier: string
};
export interface XIdentifierExpression extends StatementMeta {
    type: "IdentifierExpression",
    Identifier: string
};
export interface XCompoundStatement extends StatementMeta {
    type: "CompoundStatement",
    Statements: object[]
}
export interface XFunctionDefinition extends StatementMeta {
    type: "FunctionDefinition",
    Declarator: XDirectDeclarator,
    DeclarationSpecifiers: string[],
    CompoundStatement: XCompoundStatement,
};
export interface XPostfixExpression_MethodInvocation extends StatementMeta {
    type: "PostfixExpression_MethodInvocation",
    Expression: XIdentifierExpression | PostfixExpression,
    args: object[],
};
export interface XPostfixExpression_ArrayAccess extends StatementMeta {
    type: "PostfixExpression_ArrayAccess",
    Expression: XIdentifierExpression,
    index: XConstantExpression,
};
export interface XPostfixExpression_MemberAccess extends StatementMeta {
    type: "PostfixExpression_MemberAccess",
    Expression: XIdentifierExpression,
    member: string,
};
export type PostfixExpression = XPostfixExpression_MethodInvocation | XPostfixExpression_ArrayAccess | XPostfixExpression_MemberAccess;

export interface XInitDeclarator extends StatementMeta {
    type: "InitDeclarator",
    Declarator: XDirectDeclarator,
    Initializers: XInitializerExpr | XInitializerArray | null,
}
export interface XParameterDeclaration extends StatementMeta {
    type: "ParameterDeclaration"
    DeclarationSpecifiers: string[],
    Declarator: XInitDeclarator | XAbstractDeclarator | null,
}
export interface XParameterTypeList extends StatementMeta {
    type: "ParameterTypeList",
    ParameterList: XParameterDeclaration[],
    varargs: boolean,
}
export interface XDirectDeclarator extends StatementMeta {
    type: "DirectDeclarator",
    left: XIdentifier | XDirectDeclarator,
    right: XDirectDeclarator_modifier_ParameterTypeList | XDirectDeclarator_modifier_IdentifierList | DirectDeclaratorModifier[],
    Reference?: any[][],
    Pointer: any[][] | null,
}
type DirectDeclaratorModifier = XDirectDeclarator_modifier_ParameterTypeList | XDirectDeclarator_modifier_IdentifierList | XDirectDeclarator_modifier_Array;
export interface XDirectDeclarator_modifier_Array extends StatementMeta {
    type: "DirectDeclarator_modifier_array",
    /** Array length specifier */
    Expression: XConstantExpression | null,
    Modifier: any[],
}
export interface XDirectDeclarator_modifier_ParameterTypeList extends StatementMeta {
    type: "DirectDeclarator_modifier_ParameterTypeList",
    ParameterTypeList: XParameterTypeList,
}
export interface XDirectDeclarator_modifier_IdentifierList extends StatementMeta {
    type: "DirectDeclarator_modifier_IdentifierList",
    IdentifierList: any,
}
export interface XDeclaration extends StatementMeta {
    type: "Declaration",
    DeclarationSpecifiers: string[],
    InitDeclaratorList: XInitDeclarator[],
}
export interface XTypedefDeclaration extends StatementMeta {
    type: "Declaration",
    DeclarationSpecifiers: string[],
    Declarators: XDirectDeclarator[],
}
export interface XDecimalConstant extends StatementMeta {
    type: "DecimalConstant",
    value: string
}
export interface XOctalConstant extends StatementMeta {
    type: "OctalConstant",
    value: string
}
export interface XConstantExpression extends StatementMeta {
    type: "ConstantExpression",
    Expression: XDecimalConstant | XOctalConstant,
}
export interface XInitializerExpr extends StatementMeta {
    type: "Initializer_expr",
    Expression: XConstantExpression,
    shorthand?: InitArithmeticVariable,
}
export interface XInitializerArray extends StatementMeta {
    type: "Initializer_array",
    Initializers: XInitializerExpr[],
}
export interface XStructDeclaration extends StatementMeta {
    type: "StructDeclaration",
    DeclarationIdentifiers: string[],
    StructMemberList: XStructMember[],
    InitVariables: boolean,
}
export interface XStructMember extends StatementMeta {
    type: "StructMember",
    MemberType: string[],
    Declarators: XInitDeclarator[],
}
export interface XBinOpExpression extends StatementMeta {
    type: "BinOpExpression" | "LogicalANDExpression" | "LogicalORExpression",
    op: string,
    left: XIdentifierExpression | XPostfixExpression_ArrayAccess,
    right: XConstantExpression | XPostfixExpression_ArrayAccess,
}
export interface XStringLiteral extends StatementMeta {
    type: "StringLiteral",
    value: string,
    prefix: string | null;
}
export interface XStringLiteralExpression extends StatementMeta {
    type: "StringLiteralExpression",
    value: XStringLiteral,
}
export interface XTypeName extends StatementMeta {
    type: "TypeName",
    base: string[],
    extra: XAbstractDeclarator | null,
}
export interface XAbstractDeclarator extends StatementMeta {
    type: "AbstractDeclarator",
    Pointer: any[][] | null,
}
export interface XCastExpression extends StatementMeta {
    type: "CastExpression",
    TypeName: XTypeName,
    Expression: XIdentifierExpression | PostfixExpression
}
export interface XUnaryExpression_Sizeof_Type extends StatementMeta {
    type: "UnaryExpression_Sizeof_Type",
    TypeName: XTypeName,
}
export interface XUnknown {
    type: "<stub>"
}
type DeclaratorYield = { name: string, type: MaybeLeft<ObjectType> };

type InterpStatement = any;

type ParameterTypeListResult = {
    argTypes: MaybeLeftCV<ObjectType>[],
    argNames: string[],
    optionalArgs: MemberObject[],
}

export interface MemberObject {
    name: string,
    variable: Variable
}

type DirectDeclaratorResult = {
    type: MaybeLeft<ObjectType>,
    name: string
}

export class Interpreter extends BaseInterpreter<InterpStatement> {
    visitors: { [name: string]: (interp: Interpreter, s: InterpStatement, param?: any) => any };
    constructor(rt: CRuntime) {
        super(rt);
        this.visitors = {
            *TranslationUnit(interp, s, _param) {
                ({ rt } = interp);
                let i = 0;
                while (i < s.ExternalDeclarations.length) {
                    const dec = s.ExternalDeclarations[i];
                    yield* interp.visit(interp, dec);
                    i++;
                }
            },
            *DirectDeclarator(interp, s: XDirectDeclarator, param: { basetype: MaybeLeft<ObjectType> }): Gen<DirectDeclaratorResult> {
                ({ rt } = interp);
                let { basetype } = param;
                basetype = interp.buildRecursivePointerType(rt, s.Pointer, basetype, 0) as MaybeLeft<ObjectType>;
                if (!(s.right instanceof Array)) {
                    rt.raiseException("Direct declarator error: Type error or not yet implemented");
                }
                if (s.right.length === 1) {
                    let varargs;
                    const right = s.right[0];
                    let ptl = null;
                    if (right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                        ptl = right.ParameterTypeList;
                        ({ varargs } = ptl);
                    } else if ((right.type === "DirectDeclarator_modifier_IdentifierList") && (right.IdentifierList === null)) {
                        rt.raiseException("Direct declarator error: Type error or not yet implemented");
                        //ptl = right.ParameterTypeList;
                        //varargs = false;
                    }
                    if (ptl != null) {
                        const argTypes: (MaybeLeftCV<ObjectType>)[] = [];
                        for (const _param of ptl.ParameterList) {
                            const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                            let _type: MaybeLeft<ObjectType> | "VOID";
                            if (_param.Declarator != null) {
                                if (_param.Declarator.type === "InitDeclarator" && "Pointer" in _param.Declarator) {
                                    rt.raiseException("Direct declarator error: Not yet implemented");
                                }
                                const _pointer = (_param.Declarator.type === "AbstractDeclarator") ? _param.Declarator.Pointer : null;
                                _type = interp.buildRecursivePointerType(rt, _pointer, _basetype, 0);
                                if ("right" in _param.Declarator) {
                                    rt.raiseException("Direct declarator error: Not yet implemented");
                                }
                                /*if ((_param.Declarator.right != null) && (_param.Declarator.right.length > 0)) {
                                    const dimensions = [];
                                    for (let j = 0; j < _param.Declarator.right.length; j++) {
                                        let dim = _param.Declarator.right[j];
                                        if (dim.type !== "DirectDeclarator_modifier_array") {
                                            rt.raiseException("Direct declarator error: unacceptable array initialization", dim);
                                        }
                                        if (dim.Expression !== null) {
                                            dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dim.Expression, param))) as ArithmeticVariable).v.value;
                                        } else if (j > 0) {
                                            rt.raiseException("Direct declarator error: multidimensional array must have bounds for all dimensions except the first", dim);
                                        } else {
                                            dim = -1;
                                        }
                                        dimensions.push(dim);
                                    }
                                    _type = interp.arrayType(dimensions, _type);
                                }*/
                            } else {
                                _type = _basetype;
                            }
                            if (_type === "VOID") {
                                rt.raiseException("Direct declarator error: function arguments cannot have void type");
                            }
                            argTypes.push({ t: _type.t, v: { isConst: false, ..._type.v } });
                        }
                        basetype = { t: variables.pointerType(variables.functionType(rt.createFunctionTypeSignature("{global}", basetype, argTypes).array), null), v: { lvHolder: null } };
                    }
                }
                if ((s.right.length > 0) && (s.right[0].type === "DirectDeclarator_modifier_array")) {
                    const dimensions = [];
                    for (let j = 0; j < s.right.length; j++) {
                        const Xdim = s.right[j];
                        if (Xdim.type !== "DirectDeclarator_modifier_array") {
                            rt.raiseException("Direct declarator error: unacceptable array initialization", Xdim);
                        }
                        let dim: number;
                        if (Xdim.Expression !== null) {
                            const castResult = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, Xdim.Expression, param))) as ArithmeticVariable);
                            dim = castResult.v.state === "INIT" ? castResult.v.value : -1;
                        } else if (j > 0) {
                            rt.raiseException("Direct declarator error: multidimensional array must have bounds for all dimensions except the first", Xdim);
                        } else {
                            dim = -1;
                        }
                        dimensions.push(dim);
                    }
                    let top: number | undefined;
                    while ((top = dimensions.pop()) !== undefined) {
                        basetype = { t: variables.pointerType(basetype.t, (top !== -1) ? top : null), v: basetype.v };
                    }
                }

                if (s.left.type === "Identifier") {
                    return { type: basetype, name: s.left.Identifier };
                } else {
                    const _basetype = param.basetype;
                    param.basetype = basetype;
                    const ret = (yield* interp.visit(interp, s.left, param)) as DirectDeclaratorResult;
                    param.basetype = _basetype;
                    return ret;
                }
            },
            *TypedefDeclaration(interp, s: XTypedefDeclaration, param): Gen<void> {
                ({
                    rt
                } = interp);
                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                const _basetype = param.basetype;
                param.basetype = basetype;
                for (const declarator of s.Declarators) {
                    const { type, name } = (yield* interp.visit(interp, declarator, param)) as DirectDeclaratorResult;
                    rt.registerTypedef(type, name);
                }
                param.basetype = _basetype;
            },
            *ParameterTypeList(interp, s: XParameterTypeList, param): Gen<ParameterTypeListResult> {
                const argTypes: MaybeLeftCV<ObjectType>[] = [];
                const argNames: string[] = [];
                const optionalArgs: MemberObject[] = [];

                for (const _param of s.ParameterList) {
                    let _type: MaybeLeftCV<ObjectType>;
                    let _init: XInitializerArray | XInitializerExpr | null = null;
                    let _name: string | null = null;
                    let isConst = false;
                    if (param.insideDirectDeclarator_modifier_ParameterTypeList) {
                        const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                        if (_basetype === "VOID") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        _type = { t: _basetype.t, v: { isConst: false, ..._basetype.v } };
                    } else {
                        if (_param.Declarator == null) {
                            rt.raiseException("Parameter type list error: missing declarator for argument", _param);
                        }
                        if (_param.Declarator.type === "AbstractDeclarator") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        _init = _param.Declarator.Initializers;

                        const _declarationSpecifiers = _param.DeclarationSpecifiers.flatMap((specifier: string | { DeclarationSpecifiers: string[] }) => (typeof specifier === "string") ? specifier : specifier.DeclarationSpecifiers);
                        const _basetype = rt.simpleType(_declarationSpecifiers);
                        if (_basetype === "VOID") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        const _reference = _param.Declarator.Declarator.Reference;
                        isConst = _declarationSpecifiers.some((specifier) => ["const", "static"].includes(specifier));

                        if (_reference) {
                            _type = { t: _basetype.t, v: { isConst, lvHolder: "SELF" } };
                        } else {
                            const _pointer = _param.Declarator.Declarator.Pointer;
                            const __type = interp.buildRecursivePointerType(rt, _pointer, _basetype, 0);
                            if (__type === "VOID") {
                                rt.raiseException("Parameter type list error: Type error or not yet implemented");
                            }
                            _type = { t: __type.t, v: { isConst, ...__type.v } };
                        }

                        if (_param.Declarator.Declarator.left.type === "DirectDeclarator") {
                            const __basetype = param.basetype;
                            param.basetype = _basetype;
                            const { name } = (yield* interp.visit(interp, _param.Declarator.Declarator.left, param)) as DeclaratorYield;
                            param.basetype = __basetype;
                            _name = name;
                        } else {
                            if (_param.Declarator.Declarator.left.type !== "Identifier") {
                                rt.raiseException("Parameter type list error: Type error or not yet implemented");
                            }
                            _name = _param.Declarator.Declarator.left.Identifier;
                        }
                        if (!(_param.Declarator.Declarator.right instanceof Array)) {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        if (_param.Declarator.Declarator.right.length > 0) {
                            if (_param.Declarator.Declarator.right[0].type === "DirectDeclarator_modifier_ParameterTypeList") {
                                const dim = _param.Declarator.Declarator.right[0];
                                param.insideDirectDeclarator_modifier_ParameterTypeList = true;
                                const { argTypes: _argTypes, argNames: _argNames, optionalArgs: _optionalArgs } = yield* interp.visit(interp, dim.ParameterTypeList, param);
                                param.insideDirectDeclarator_modifier_ParameterTypeList = false;
                                rt.raiseException("Parameter type list error: Not yet implemented");
                                //_type = variables.pointerType(variables.functionType(_type, _argTypes));
                            } else {
                                for (let j = _param.Declarator.Declarator.right.length - 1; j >= 0; j--) {
                                    const dimObj = _param.Declarator.Declarator.right[j];
                                    if (dimObj.type !== "DirectDeclarator_modifier_array") {
                                        rt.raiseException("Parameter type list error: Unacceptable array initialization", dimObj);
                                    }
                                    if (dimObj.Expression !== null) {
                                        const sizeConstraint = rt.arithmeticValue(rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dimObj.Expression, param))) as ArithmeticVariable);
                                        _type = { t: variables.pointerType(_type.t, sizeConstraint), v: { isConst, lvHolder: _type.v.lvHolder } };
                                    } else if (j > 0) {
                                        rt.raiseException("Parameter type list error: Multidimensional array must have bounds for all dimensions except the first", dimObj);
                                    } else {
                                        _type = { t: variables.pointerType(_type.t, null), v: { isConst, lvHolder: _type.v.lvHolder } };
                                    }
                                }
                            }
                        }
                    }
                    const name = _name ?? rt.raiseException("Parameter type list error: expected a name");
                    if (_init !== null) {
                        if (_init.type !== "Initializer_expr") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        const initvarYield = interp.visit(interp, _init.Expression) as Gen<Variable>;
                        const initvar = asResult(initvarYield) ?? (yield* (initvarYield as Gen<Variable>));
                        optionalArgs.push({
                            name,
                            variable: variables.clone(initvar, null, false, rt.raiseException)
                        });
                    } else {
                        if (optionalArgs.length > 0) {
                            rt.raiseException("Parameter type list error: All default arguments must be at the end of arguments list", _param);
                        }
                        argTypes.push(_type);
                        argNames.push(name);
                    }
                };
                return { argTypes, argNames, optionalArgs };
            },
            *FunctionDefinition(interp, s: XFunctionDefinition, param) {
                ({
                    rt
                } = interp);
                const {
                    scope
                } = param;
                const typedScope = scope === "{global}" ? "{global}" : rt.raiseException("Function definition error: Not yet implemented");
                if (s.Declarator.left.type !== "Identifier") {
                    rt.raiseException("Function definition error: Not yet implemented");
                }
                const name = s.Declarator.left.Identifier;
                let basetype = rt.simpleType(s.DeclarationSpecifiers);
                const pointer = s.Declarator.Pointer;
                basetype = interp.buildRecursivePointerType(rt, pointer, basetype, 0);
                let ptl: XParameterTypeList | { ParameterList: [] };
                let varargs;
                if (s.Declarator.right instanceof Array) {
                    rt.raiseException("Function definition error: unacceptable argument list", s.Declarator.right);
                }
                if (s.Declarator.right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                    ptl = s.Declarator.right.ParameterTypeList;
                    ({
                        varargs
                    } = ptl);
                } else if ((s.Declarator.right.type === "DirectDeclarator_modifier_IdentifierList") && (s.Declarator.right.IdentifierList === null)) {
                    ptl = { ParameterList: [] };
                    varargs = false;
                } else {
                    rt.raiseException("Function definition error: unacceptable argument list", s.Declarator.right);
                }
                const { argTypes, argNames, optionalArgs }: ParameterTypeListResult = yield* interp.visit(interp, ptl, param);
                const stat = s.CompoundStatement;
                rt.defFunc(typedScope, name, basetype, argTypes, argNames, optionalArgs, stat, interp);
            },
            *Declaration(interp, s: XDeclaration, param: { deducedType: MaybeLeft<ObjectType>, basetype?: MaybeLeft<ObjectType>, node?: XInitializerExpr | XInitializerArray | null }): ResultOrGen<void> {
                const { rt } = interp;
                const deducedType = s.DeclarationSpecifiers.includes("auto");
                const isConst = s.DeclarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));
                const _basetype: ResultOrGen<MaybeLeft<ObjectType> | "VOID"> = deducedType ? (param.deducedType ?? interp.visit(interp, s.InitDeclaratorList[0].Initializers, param) as Gen<MaybeLeft<ObjectType>>) : rt.simpleType(s.DeclarationSpecifiers);
                const basetype = (_basetype === "VOID") ? rt.raiseException("Declaration error: Type error or not yet implemented") : _basetype;

                for (const dec of s.InitDeclaratorList) {
                    let visitResult: DeclaratorYield;
                    {
                        const _basetype = param.basetype;
                        param.basetype = basetype;
                        visitResult = (yield* interp.visit(interp, dec.Declarator, param)) as DeclaratorYield;
                        param.basetype = _basetype;
                    }
                    const decType: MaybeLeft<ObjectType> = (dec.Declarator.Pointer instanceof Array) ? variables.uninitPointer(basetype.t, null, "SELF") : basetype;
                    const { name, type } = visitResult;
                    let initSpec = dec.Initializers;

                    if (!(dec.Declarator.right instanceof Array)) {
                        rt.raiseException("Declaration error: Not yet implemented");
                    }
                    const rhs = dec.Declarator.right as DirectDeclaratorModifier[];
                    const ptrType: PointerType<ObjectType | FunctionType> | null = variables.asPointerType(type.t);
                    if (ptrType !== null) {
                        if (initSpec !== null) {
                            if (initSpec.type === "Initializer_expr") {
                                rt.raiseException("Declaration error: not yet implemented");
                                /*const initializer: Variable = yield* interp.visit(interp, initSpec, param);
                                // if basetype is char and initializer.t is char*
                                const initializerAsIndexPtr = variables.asInitIndexPointerOfElem(initializer, variables.uninitArithmetic("I8", null))
                                if (basetype.t.sig === "I8" && initializerAsIndexPtr !== null) {
                                    // string init
                                    initSpec = {
                                        type: "Initializer_array",
                                        Initializers: initializerAsIndexPtr.v.pointee.values.map(e => ((e.state === "INIT") ? {
                                            type: "Initializer_expr",
                                            shorthand: variables.arithmetic("I8", e.value, null)
                                        } as XInitializerExpr : rt.raiseException("Declaration error: expected expression")))
                                    } as XInitializerArray;
                                } else {
                                    rt.raiseException("Declaration error: cannot initialize an array to " + rt.makeValueString(initializer), initSpec);
                                }*/
                            }
                        }

                        param.node = initSpec;
                        let ptrBaseType = ptrType.pointee;
                        while (ptrBaseType.sig === "PTR") {
                            ptrBaseType = ptrBaseType.pointee;
                        }
                        if (ptrBaseType.sig === "FUNCTION") {
                            rt.raiseException("Declaration error: not yet implemented");
                        }
                        const arrayYield = interp.arrayInit2(rt, ptrType as PointerType<ObjectType>, initSpec);
                        const arrayInit = asResult(arrayYield) ?? (yield* arrayYield as Gen<InitIndexPointerVariable<Variable>>);
                        delete param.node;

                        rt.defVar(name, arrayInit);
                    } else if (rhs.length > 0 && rhs[0].type as string === "DirectDeclarator_modifier_Constructor") {
                        const constructorArgs = [];
                        for (const dim of rhs) {
                            if ((dim as any).Expressions !== null) {
                                for (const argumentExpression of (dim as any).Expressions) {
                                    const resolvedArgument = yield* interp.visit(interp, argumentExpression, param);
                                    constructorArgs.push(resolvedArgument);
                                }
                            }
                        }
                        const _classType = variables.asClassType(type.t);
                        const classType = (_classType === null) ? rt.raiseException("Declaration error: Not yet implemented / Type Error") : _classType;

                        //const initClass = variables.class(classType, {}, "SELF");
                        const xinitYield = rt.invokeCall(rt.getFuncByParams(classType, "o(_ctor)", constructorArgs), ...constructorArgs);
                        const xinitOrVoid = asResult(xinitYield) ?? (yield* (xinitYield as Gen<MaybeUnboundVariable | "VOID">))
                        if (xinitOrVoid === "VOID") {
                            rt.raiseException("Declaration error: Expected a non-void value");
                        } else {
                            rt.defVar(name, rt.unbound(xinitOrVoid));
                        }
                    } else {
                        if (initSpec !== null && initSpec.type === "Initializer_array") {
                            rt.raiseException("Declaration error: type error");
                        }
                        const initVarYield = (initSpec === null) ? rt.defaultValue(type.t, "SELF") : interp.visit(interp, (initSpec as XInitializerExpr).Expression) as Gen<MaybeUnboundVariable | "VOID">;
                        const initVarOrVoid = asResult(initVarYield) ?? (yield* (initVarYield as Gen<MaybeUnboundVariable | "VOID">));
                        if (initVarOrVoid === "VOID") {
                            rt.raiseException("Declaration error: Expected a non-void value");
                        } else {
                            let initVar = rt.unbound(initVarOrVoid);

                            if (dec.Declarator.Reference === undefined && initVar.v.lvHolder !== null) {
                                initVar = variables.clone(initVar, "SELF", false, rt.raiseException, true);
                            }

                            if (!variables.typesEqual(initVar.t, decType.t)) {
                                const castVar = rt.cast(decType.t, rt.expectValue(initVar));
                                initVar = rt.expectValue(asResult(castVar) ?? (yield* castVar as Gen<Variable>));
                            }
                            if (isConst) {
                                rt.raiseException("Declaration error: Not yet implemented");
                            }
                            rt.defVar(name, initVar);
                        }
                    }
                }
            },
            *STLDeclaration(interp, s, param) {
                ({ rt } = interp);

                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                rt.raiseException("Template declaration error: Not yet implemented");
                /*if (!rt.isVectorClass(basetype))
                    rt.raiseException("Template declaration error: Only vectors are currently supported for STL Declaration!");

                const vectorClass: any = rt.defaultValue(basetype, true);

                const STLType = rt.simpleType(s.Type);
                if (s.Initializer != null) {
                    const initializer: any = yield* interp.arrayInit([s.Initializer.Initializers.length], s.Initializer, STLType, param);
                    vectorClass.v.members.element_container.elements = initializer.v.target;
                }

                vectorClass.dataType = vectorClass.v.members.element_container.dataType = STLType;
                vectorClass.readonly = false;
                rt.defVar(s.Identifier, basetype, vectorClass);*/
            },
            *StructDeclaration(interp, s: XStructDeclaration, param) {
                ({ rt } = interp);

                for (const identifier of s.DeclarationIdentifiers) {
                    const structMemberList: MemberObject[] = [];
                    for (const structMember of s.StructMemberList) {
                        for (const dec of structMember.Declarators) {
                            const init = dec.Initializers;

                            if (init !== null && init.type === "Initializer_array") {
                                rt.raiseException("Struct declaration error: type error");
                            }

                            const _simpleTypeYield = rt.simpleType(structMember.MemberType);
                            param.basetype = _simpleTypeYield;
                            const { name, type } = (yield* interp.visit(interp, dec.Declarator, param)) as DeclaratorYield;

                            const initvarYield = (init == null) ? rt.defaultValue(type.t, "SELF") : interp.visit(interp, init.Expression) as Gen<Variable>;
                            const initvar = asResult(initvarYield) ?? (yield* (initvarYield as Gen<Variable>));

                            structMemberList.push({
                                name,
                                variable: variables.clone(initvar, "SELF", false, rt.raiseException)
                            });
                        }
                    }

                    if (s.InitVariables) {
                        rt.raiseException("Struct declaration error: not yet implemented");
                        //const structType = rt.newStruct(`initialized_struct_${identifier}`, structMemberList);
                        //rt.defVar(identifier, rt.defaultValue(structType));
                    } else {
                        if (rt.scope.length !== 1) {
                            rt.raiseException("Struct declaration error: Nested classes are not yet implemented");
                        }
                        rt.defineStruct("{global}", identifier, structMemberList);
                    }
                }
            },
            *Initializer_expr(interp, s: XInitializerExpr, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *Label_case(interp, s, param) {
                ({
                    rt
                } = interp);
                const ce = yield* interp.visit(interp, s.ConstantExpression);
                if (param["switch"] === undefined) {
                    rt.raiseException("Label 'case' error: you cannot use case outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        (rt.cast(ce.t, param["switch"]) as Variable).v === ce.v
                    ];
                } else {
                    rt.raiseException("Label 'case' error: you can only use case directly in a switch block");
                }
            },
            Label_default(interp, _s, param) {
                ({
                    rt
                } = interp);
                if (param["switch"] === undefined) {
                    rt.raiseException("Label 'default' error: you cannot use default outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        true
                    ];
                } else {
                    rt.raiseException("Label 'default' error: you can only use default directly in a switch block");
                }
            },
            *CompoundStatement(interp, s, param) {
                let stmt;
                ({
                    rt
                } = interp);
                const stmts = s.Statements;
                let r;
                let i;
                const _scope = param.scope;
                if (param.scope === "SelectionStatement_switch") {
                    param.scope = "SelectionStatement_switch_cs";
                    rt.enterScope(param.scope);
                    let switchon = false;
                    i = 0;
                    while (i < stmts.length) {
                        stmt = stmts[i];
                        if ((stmt.type === "Label_case") || (stmt.type === "Label_default")) {
                            r = yield* interp.visit(interp, stmt, param);
                            if (r[1]) {
                                switchon = true;
                            }
                        } else if (switchon) {
                            r = yield* interp.visit(interp, stmt, param);
                            if (r instanceof Array) {
                                return r;
                            }
                        }
                        i++;
                    }
                    rt.exitScope(param.scope);
                    param.scope = _scope;
                } else {
                    param.scope = "CompoundStatement";
                    rt.enterScope(param.scope);
                    for (stmt of stmts) {
                        r = yield* interp.visit(interp, stmt, param);
                        if (r instanceof Array) {
                            break;
                        }
                    }
                    rt.exitScope(param.scope);
                    param.scope = _scope;
                    return r;
                }
            },
            *ExpressionStatement(interp, s, param) {
                ({
                    rt
                } = interp);
                if (s.Expression != null) {
                    yield* interp.visit(interp, s.Expression, param);
                }
            },
            *SelectionStatement_if(interp, s, param) {
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "SelectionStatement_if";
                rt.enterScope(param.scope);
                const e = yield* interp.visit(interp, s.Expression, param);
                let ret;
                let castYield = rt.cast(variables.arithmeticType("BOOL"), e) as ResultOrGen<ArithmeticVariable>;
                if (rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>))) {
                    ret = yield* interp.visit(interp, s.Statement, param);
                } else if (s.ElseStatement) {
                    ret = yield* interp.visit(interp, s.ElseStatement, param);
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return ret;
            },
            *SelectionStatement_switch(interp, s, param) {
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "SelectionStatement_switch";
                rt.enterScope(param.scope);
                const e = yield* interp.visit(interp, s.Expression, param);
                const switch_bak = param["switch"];
                param["switch"] = e;
                const r = yield* interp.visit(interp, s.Statement, param);
                param["switch"] = switch_bak;
                let ret;
                if (r instanceof Array) {
                    if (r[0] !== "break") {
                        ret = r;
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return ret;
            },
            *IterationStatement_while(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_while";
                rt.enterScope(param.scope);
                while (true) {
                    if (s.Expression != null) {
                        const cond = yield* interp.visit(interp, s.Expression, param);
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<ArithmeticVariable>;
                        const castBool = rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
                        if (!castBool) { break; }
                    }
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_do(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_do";
                rt.enterScope(param.scope);
                while (true) {
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                    if (s.Expression != null) {
                        const cond = yield* interp.visit(interp, s.Expression, param);
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<MaybeUnboundArithmeticVariable>;
                        const castBool = rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<MaybeUnboundArithmeticVariable>));
                        if (!castBool) { break; }
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_foreach(interp, s, param) {
                let return_val;
                ({ rt } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_foreach";
                rt.enterScope(param.scope);

                const iterable = yield* interp.visit(interp, s.Expression, param);

                if (s.Initializer) {
                    param.deducedType = iterable.dataType ?? iterable.t;

                    yield* interp.visit(interp, s.Initializer, param);
                }

                const variable = rt.readVar(s.Initializer.InitDeclaratorList[0].Declarator.left.Identifier);
                let iterator = null;
                try {
                    const sym = rt.getFuncByParams(iterable.t, "__iterator", []);
                    iterator = rt.invokeCall(sym, iterable);
                } catch (ex) {
                    // ???
                    rt.raiseException("For-each iteration statement error: not yet implemented");
                    //if (variables.asArrayType !== null) {
                    //    iterator = iterable.v.target[Symbol.iterator]();
                    //}
                }

                if (!iterator) {
                    rt.raiseException(`For-each iteration statement error: Variable '${s.Expression.Identifier}' is not iterator type.`);
                }

                rt.raiseException("For-each iteration statement error: not yet implemented");

                /*for (const element of iterator) {
                    variable.v = element.v;

                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                }

                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;*/
            },
            *IterationStatement_for(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_for";
                rt.enterScope(param.scope);
                if (s.Initializer) {
                    if (s.Initializer.type === "Declaration") {
                        yield* interp.visit(interp, s.Initializer, param);
                    } else {
                        yield* interp.visit(interp, s.Initializer, param);
                    }
                }
                while (true) {
                    if (s.Expression != null) {
                        const cond = yield* interp.visit(interp, s.Expression, param);
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<ArithmeticVariable>;
                        const castBool = rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
                        if (!castBool) { break; }
                    }
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                    if (s.Loop) {
                        yield* interp.visit(interp, s.Loop, param);
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            JumpStatement_goto(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Go-to statement error: not implemented");
            },
            JumpStatement_continue(interp, _s, _param) {
                ({
                    rt
                } = interp);
                return ["continue"];
            },
            JumpStatement_break(interp, _s, _param) {
                ({
                    rt
                } = interp);
                return ["break"];
            },
            *JumpStatement_return(interp, s, param) {
                ({
                    rt
                } = interp);
                if (s.Expression) {
                    let ret = yield* interp.visit(interp, s.Expression, param);

                    return [
                        "return",
                        ret
                    ];
                }
                return ["return"];
            },
            IdentifierExpression(interp, s, param: { functionArgs?: MaybeLeft<ObjectType>[] }) {
                ({ rt } = interp);

                const globalScope = rt.scope.find((scope) => scope.$name === "{global}");
                const currentScope = rt.scope[rt.scope.length - 1];
                const declarationScope = rt.scope.slice().reverse().find((scope, idx) => scope.$name.includes("function") && rt.scope[idx + 1].$name === "CompoundStatement") || ({ variables: {} }) as RuntimeScope;

                const varname = resolveIdentifier(s.Identifier);
                if (param.functionArgs === undefined) {
                    return rt.readScopedVar(currentScope, varname) || rt.readScopedVar(declarationScope, varname) || (globalScope !== undefined && rt.readScopedVar(globalScope, varname)) || rt.getFromNamespace(varname) || rt.readVar(varname);
                } else {
                    const funsym = rt.getFuncByParams("{global}", varname, param.functionArgs);
                    return funsym//variables.function(funsym.type, varname, funsym.target, null, null);
                }
            },
            *ParenthesesExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *PostfixExpression_ArrayAccess(interp, s: XPostfixExpression_ArrayAccess, param) {
                ({
                    rt
                } = interp);
                debugger;
                const _ret = (yield* interp.visit(interp, s.Expression, param)) as PointerVariable<Variable | Function>;
                if (variables.asFunctionType(_ret.t.pointee) !== null) {
                    rt.raiseException("Array access statement error: Function pointer is not an array");
                }
                const ret = _ret as PointerVariable<Variable>;
                const index = variables.asArithmetic(yield* interp.visit(interp, s.index, param)) ?? rt.raiseException("Array access statement error: Expected an arithmetic value");

                param.structType = ret.t;
                const funsym = rt.getOpByParams("{global}", "o(_[_])", [ret, index]);
                const r = rt.invokeCall(funsym, ret, index);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *PostfixExpression_MethodInvocation(interp, s: XPostfixExpression_MethodInvocation, param): ResultOrGen<MaybeUnboundVariable | "VOID"> {
                ({
                    rt
                } = interp);
                let args: Variable[] = yield* (function*() {
                    const result = [];
                    for (const e of s.args) {
                        const thisArg = yield* interp.visit(interp, e, param);
                        if (thisArg === "VOID") {
                            rt.raiseException("Method invocation error: Expected a non-void value in parameter");
                        }
                        result.push(rt.unbound(thisArg));
                    }
                    return result;
                }).call(this);
                if (s.Expression.type === "PostfixExpression_MemberAccess") {
                    // TODO: optimise (remove double visitation)
                    const holderClass = variables.asClass(rt.unbound(yield* interp.visit(interp, s.Expression.Expression, {})));
                    if (holderClass === null) {
                        rt.raiseException("Method invocation error: Could not visit holder class");
                    }
                    args = [holderClass, ...args];
                }
                const ret: Variable | FunctionCallInstance = yield* interp.visit(interp, s.Expression, { functionArgs: args });

                if ("actions" in ret) {
                    const resultOrGen = rt.invokeCall(ret, ...args);
                    const result = asResult(resultOrGen) ?? (yield* resultOrGen as Gen<MaybeUnboundVariable | "VOID">);
                    if (result === "VOID") {
                        return "VOID";
                    }
                    return rt.expectValue(result);
                } else {
                    const fret = variables.asFunction(ret);
                    if (fret !== null) {
                        rt.raiseException("Method invocation error: Not yet implemented");

                        /*const r = rt.invokeCall(, ...args);
                        const result = asResult(r) ?? (yield* r as Gen<MaybeUnboundVariable | "VOID">);
                        if (result === "VOID") {
                            return "VOID";
                        }
                        return rt.expectValue(asResult<MaybeUnboundVariable>(result) ?? (yield* r as Gen<MaybeUnboundVariable>));*/
                    }
                }
            },
            *PostfixExpression_MemberAccess(interp, s: XPostfixExpression_MemberAccess, param: { functionArgs?: MaybeLeft<ObjectType>[] }): ResultOrGen<Variable | FunctionCallInstance> {
                ({
                    rt
                } = interp);
                const functionArgs = param.functionArgs;
                param.functionArgs = undefined;
                const ret = (yield* interp.visit(interp, s.Expression, param)) as MaybeUnboundVariable | "VOID";
                if (ret === "VOID") {
                    rt.raiseException("Member access error: Expected a non-void value")
                }
                const rclass = variables.asClass(rt.unbound(ret));
                if (rclass === null) {
                    rt.raiseException("Member access error: Expected a class/struct object");
                }
                param.functionArgs = functionArgs;
                if (param.functionArgs === undefined) {
                    return rt.getMember(rclass, s.member);
                } else {
                    return rt.getFuncByParams(rclass.t, s.member, param.functionArgs)
                }
            },
            *PostfixExpression_MemberPointerAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                const retc = variables.asClass(ret);
                if (retc === null) {
                    rt.raiseException("Member pointer access error: Expected a class or struct");
                }
                const maybePtrType = variables.asPointerType(ret.t);
                if (maybePtrType !== null && variables.asFunctionType(maybePtrType.pointee) === null) {
                    const { member } = s;
                    const target = rt.invokeCall(rt.getOpByParams("{global}", "o(_->_)", [retc]), retc) as Generator;
                    if (isGenerator(ret)) {
                        return rt.getMember(yield* target as Generator, member);
                    } else {
                        rt.raiseException("Member pointer access error: Expected a generator");
                    }
                } else {
                    const member = yield* interp.visit(interp, {
                        type: "IdentifierExpression",
                        Identifier: s.member
                    }, param);
                    const target = rt.invokeCall(rt.getOpByParams("{global}", "o(_->_)", [retc]), retc) as Generator;
                    if (isGenerator(ret)) {
                        return rt.getMember(yield* target as Generator, member);
                    } else {
                        rt.raiseException("Member pointer access error: Expected a generator");
                    }
                }
            },
            *PostfixExpression_PostIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(_++)", [ret]), ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *PostfixExpression_PostDecrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(_--)", [ret]), ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression_PreIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(++_)", [ret]), ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression_PreDecrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(--_)", [ret]), ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", `o(${s.op}_)` as OpSignature, [ret]), ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression_Sizeof_Expr(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                return variables.arithmetic("I32", rt.getSizeByType(ret.t), null);
            },
            *UnaryExpression_Sizeof_Type(interp, s: XUnaryExpression_Sizeof_Type, param) {
                ({
                    rt
                } = interp);
                const type = (yield* interp.visit(interp, s.TypeName, param)) as MaybeLeft<ObjectType> | "VOID";
                if (type === "VOID") {
                    rt.raiseException("Sizeof statement error: Cannot apply sizeof to void");
                }
                return variables.arithmetic("I32", rt.getSizeByType(type.t), null);
            },
            *CastExpression(interp, s: XCastExpression, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                ret = variables.clone(ret, null, false, rt.raiseException);
                const type = (yield* interp.visit(interp, s.TypeName, param)) as MaybeLeft<ObjectType> | "VOID";
                if (type === "VOID") {
                    rt.raiseException("Cast error: Cannot cast to void");
                }
                return rt.cast(type.t, ret, true);
            },
            TypeName(interp, s: XTypeName, _param): MaybeLeft<ObjectType> | "VOID" {
                ({
                    rt
                } = interp);
                const typename = [];
                for (const baseType of s.base) {
                    if (baseType !== "const") {
                        typename.push(baseType);
                    }
                }
                if (s.extra) {
                    return interp.buildRecursivePointerType(rt, s.extra.Pointer, rt.simpleType(typename), 0);
                }
                return rt.simpleType(typename);
            },
            *BinOpExpression(interp, s: XBinOpExpression, param) {
                ({
                    rt
                } = interp);
                const {
                    op
                } = s;
                if (op === "&&") {
                    s.type = "LogicalANDExpression";
                    return yield* interp.visit(interp, s, param);
                } else if (op === "||") {
                    s.type = "LogicalORExpression";
                    return yield* interp.visit(interp, s, param);
                } else {
                    const _left: MaybeUnboundVariable | "VOID" = yield* interp.visit(interp, s.left, param);
                    if (_left === "VOID") {
                        rt.raiseException("Binary operation expression error: Expected a non-void value on the left-hand side of operation");
                    }
                    const left = rt.unbound(_left);
                    const _right: MaybeUnboundVariable | "VOID" = yield* interp.visit(interp, s.right, param);
                    if (_right === "VOID") {
                        rt.raiseException("Binary operation expression error: Expected a non-void value on the right-hand side of operation");
                    }
                    const right = rt.unbound(_right);

                    const r = rt.invokeCall(rt.getFuncByParams("{global}", rt.makeBinaryOperatorFuncName(op), [left, right]), left, right);
                    if (isGenerator(r)) {
                        return yield* r as Generator;
                    } else {
                        return r;
                    }
                }
            },
            *LogicalANDExpression(interp, s: XBinOpExpression, param): ResultOrGen<InitArithmeticVariable> {
                const left = rt.expectValue((yield* interp.visit(interp, s.left, param)) as Variable);
                const leftArithmetic = variables.asArithmetic(left) as InitArithmeticVariable;
                let lhsVal: InitArithmeticVariable;
                if (leftArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    lhsVal = rt.expectValue(asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    lhsVal = leftArithmetic;
                }
                if (lhsVal.v.value === 0) {
                    return variables.arithmetic("BOOL", 0, null);
                }
                const right = rt.expectValue((yield* interp.visit(interp, s.right, param)) as Variable);
                const rightArithmetic = variables.asArithmetic(right) as InitArithmeticVariable;
                let rhsVal: InitArithmeticVariable;
                if (rightArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const rhsBoolYield = rt.cast(boolType, right);
                    rhsVal = rt.expectValue(asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    rhsVal = rightArithmetic;
                }
                return variables.arithmetic("BOOL", ((lhsVal.v.value & rhsVal.v.value) !== 0) ? 1 : 0, null);
            },
            *LogicalORExpression(interp, s: XBinOpExpression, param): ResultOrGen<InitArithmeticVariable> {
                const left = rt.expectValue((yield* interp.visit(interp, s.left, param)) as Variable);
                const leftArithmetic = variables.asArithmetic(left) as InitArithmeticVariable;
                let lhsVal: InitArithmeticVariable;
                if (leftArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    lhsVal = rt.expectValue(asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    lhsVal = leftArithmetic;
                }
                if (lhsVal.v.value === 1) {
                    return variables.arithmetic("BOOL", 1, null);
                }
                const right = rt.expectValue((yield* interp.visit(interp, s.right, param)) as Variable);
                const rightArithmetic = variables.asArithmetic(right) as InitArithmeticVariable;
                let rhsVal: InitArithmeticVariable;
                if (rightArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const rhsBoolYield = rt.cast(boolType, right);
                    rhsVal = rt.expectValue(asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    rhsVal = rightArithmetic;
                }
                return variables.arithmetic("BOOL", ((lhsVal.v.value | rhsVal.v.value) !== 0) ? 1 : 0, null);
            },
            *ConditionalExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const obj = yield* interp.visit(interp, s.cond, param);
                const boolType = variables.arithmeticType("BOOL");
                const boolYield = rt.cast(boolType, obj) as ResultOrGen<ArithmeticVariable>;
                const cond = rt.expectValue((asResult(boolYield) ?? (yield* boolYield as Gen<ArithmeticVariable>)));
                return yield* interp.visit(interp, rt.arithmeticValue(cond as ArithmeticVariable) ? s.t : s.f, param);
            },
            *ConstantExpression(interp, s: XConstantExpression, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *StringLiteralExpression(interp, s: XStringLiteralExpression, param) {
                return yield* interp.visit(interp, s.value, param);
            },
            *StructExpression(interp, s, param: { structType: ClassType }) {
                ({ rt } = interp);

                const convertToObjectArray = function*(expr: any) {
                    if (expr.type === 'StructExpression') {
                        return expr.values.map((value: any) => convertToObjectArray(value.Expression).next().value);
                    } else {
                        return yield* interp.visit(interp, expr, param);
                    }
                };

                const valuesToStruct = function*(arrayValues: any) {
                    const fillerStructYield = rt.defaultValue(param.structType, null) as ResultOrGen<ClassVariable>;
                    const fillerStruct = rt.unbound(asResult(fillerStructYield) ?? (yield* (fillerStructYield as Gen<ClassVariable>))) as ClassVariable;
                    const orderedKeys = Object.keys(fillerStruct.v.members);

                    for (let k = 0; k < arrayValues.length; k++) {
                        const memberName = orderedKeys[k];
                        const memberValue = arrayValues[k];
                        fillerStruct.v.members[memberName].v = memberValue.v;
                    }

                    return fillerStruct;
                };

                const arrayValues = yield* convertToObjectArray(s);

                if (Array.isArray(arrayValues[0])) {
                    const structArray = [];
                    for (const valueArray of arrayValues) {
                        structArray.push(valuesToStruct(valueArray));
                    }
                    rt.raiseException("Struct expression error: Not yet implemented");
                    //return variables.indexPointer(param.structType, structArray.length), rt.makeArrayPointerValue(structArray, 0));
                }

                return valuesToStruct(arrayValues);
            },
            StringLiteral(interp, s: XStringLiteral, _param): InitIndexPointerVariable<ArithmeticVariable> {
                ({
                    rt
                } = interp);
                // TODO: fix a bug that treats single-byte escape literals beyond \x7f as Unicode code points.
                switch (s.prefix) {
                    case null:
                        return rt.getCharArrayFromString(s.value);
                    case "L":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "wchar_t");
                    case "u8":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "char");
                    case "u":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "char16_t");
                    case "U":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "char32_t");
                }
                rt.raiseException(`Invalid string prefix error: '${s.prefix}'`);
            },
            BooleanConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("BOOL", s.value === "true" ? 1 : 0, null);
            },
            CharacterConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const a = s.Char;
                if (a.length !== 1) {
                    rt.raiseException("Character constant error: a character constant must have and only have one character.");
                }
                return variables.arithmetic("I8", a[0].charCodeAt(0), null);
            },
            *FloatConstant(interp, s, param): ResultOrGen<ArithmeticVariable> {
                ({
                    rt
                } = interp);
                const val = yield* interp.visit(interp, s.Expression, param);
                return variables.arithmetic("F64", val.v.value, null);
            },
            DecimalFloatConstant(interp, s, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                return variables.arithmetic("F64", parseFloat(s.value), null);
            },
            HexFloatConstant(interp, s, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                return variables.arithmetic("F64", parseInt(s.value, 16), null);
            },
            DecimalConstant(interp, s: XDecimalConstant, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 10);
                const intProps = variables.arithmeticProperties["I32"];
                const uintProps = variables.arithmeticProperties["U32"];
                if (Number.isNaN(num) || num > uintProps.maxv || num < intProps.minv) {
                    rt.raiseException(`Decimal constant error: Constant integer expression '${num}' is not in a signed 32-bit integer range`);
                }
                if (num > intProps.maxv) {
                    return variables.arithmetic("U32", (uintProps.maxv + 1) - num, null);
                }
                return variables.arithmetic("I32", num, null);
            },
            HexConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 16);
                const intProps = variables.arithmeticProperties["I32"];
                const uintProps = variables.arithmeticProperties["U32"];
                if (Number.isNaN(num) || num > uintProps.maxv || num < intProps.minv) {
                    rt.raiseException(`Hexadecimal constant error: Constant integer expression '${num}' is not in a signed 32-bit integer range`);
                }
                if (num > intProps.maxv) {
                    return variables.arithmetic("U32", num, null);
                }
                return variables.arithmetic("I32", num, null);
            },
            BinaryConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 2);
                const intProps = variables.arithmeticProperties["I32"];
                const uintProps = variables.arithmeticProperties["U32"];
                if (Number.isNaN(num) || num > uintProps.maxv || num < intProps.minv) {
                    rt.raiseException(`Binary constant error: Constant integer expression '${num}' is not in a signed 32-bit integer range`);
                }
                if (num > intProps.maxv) {
                    return variables.arithmetic("U32", num, null);
                }
                return variables.arithmetic("I32", num, null);
            },
            OctalConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 8);
                const intProps = variables.arithmeticProperties["I32"];
                const uintProps = variables.arithmeticProperties["U32"];
                if (Number.isNaN(num) || num > uintProps.maxv || num < intProps.minv) {
                    rt.raiseException(`Octal constant error: Constant integer expression '${num}' is not in a signed 32-bit integer range`);
                }
                if (num > intProps.maxv) {
                    return variables.arithmetic("U32", num, null);
                }
                return variables.arithmetic("I32", num, null);
            },
            NamespaceDefinition(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Namespace definition error: not implemented");
            },
            UsingDirective(interp, s, _param) {
                ({ rt } = interp);

                const id = s.Identifier;
                const currentScope = rt.scope[rt.scope.length - 1];

                Object.assign(currentScope.variables, { ...rt.namespace[id], [id]: rt.namespace[id] });
            },
            UsingDeclaration(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Using-declaration error: not implemented");
            },
            NamespaceAliasDefinition(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Namespace alias definition error: not implemented");
            },
            unknown(interp, s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("unhandled syntax " + s.type);
            }
        };
    }

    *visit(interp: Interpreter, s: any, param?: any) {
        let ret;
        //const { rt } = interp;
        //console.log(`${s.sLine}: visiting ${s.type}`);
        if ("type" in s) {
            if (param === undefined) {
                param = { scope: "{global}" };
            }
            const _node = this.currentNode;
            this.currentNode = s;
            if (s.type in this.visitors) {
                const f = this.visitors[s.type];
                if (isGeneratorFunction(f)) {
                    const x = f(interp, s, param);
                    if (x != null) {
                        if (isIterable(x)) {
                            ret = yield* x;
                        } else {
                            ret = yield x;
                        }
                    } else {
                        ret = yield null;
                    }
                } else {
                    yield (ret = f(interp, s, param));
                }
            } else {
                ret = this.visitors["unknown"](interp, s, param);
            }
            this.currentNode = _node;
        } else {
            this.currentNode = s;
            interp.rt.raiseException("untyped syntax structure");
        }
        return ret;
    };

    *run(tree: any, source: string, param?: any) {
        if (tree.type === "TranslationUnit")
            this.processIncludes();

        this.rt.interp = this;
        this.source = source;
        return yield* this.visit(this, tree, param);
    };

    processIncludes() {
        const lastToLoad = ["iomanip"];
        if (this.rt.config.includes === undefined) {
            this.rt.raiseException("[Interpreter].rt.config.includes is undefined");
        }
        const { includes, loadedLibraries } = this.rt.config;

        for (const lib of loadedLibraries) {
            if (lastToLoad.includes(lib))
                continue;

            includes[lib].load(this.rt);
        }

        for (const lib of lastToLoad) {
            if (!loadedLibraries.includes(lib))
                continue;

            includes[lib].load(this.rt);
        }
    };
    *arrayInit2(rt: CRuntime, type: PointerType<ObjectType>, init: XInitializerExpr | XInitializerArray | null): ResultOrGen<InitIndexPointerVariable<Variable>> {
        debugger;
        function *arrayInitInner(type: PointerType<ObjectType>, _init: XInitializerExpr | XInitializerArray | null): ResultOrGen<PointerValue<PointeeVariable>> {
            const arithmeticPointeeType = variables.asArithmeticType(type.pointee);
            if (type.sizeConstraint === null) {
                rt.raiseException("arrayInit2: not yet implemented");
            }
            if (arithmeticPointeeType !== null) {
                let memoryObject = variables.arrayMemory<ArithmeticVariable>(arithmeticPointeeType, []);
                for (let i = 0; i < type.sizeConstraint; i++) {
                    const lvHolder: LValueIndexHolder<ArithmeticVariable> = { array: memoryObject, index: i };
                    memoryObject.values.push(variables.uninitArithmetic(arithmeticPointeeType.sig, lvHolder, false).v);
                }
                return variables.indexPointer(memoryObject, 0, true, null, false).v;
            }
            rt.raiseException("arrayInit2: not yet implemented");
        }
        const retv = arrayInitInner(type, init);
        return { t: type, v: asResult(retv) ?? (yield *(retv as Gen<PointerValue<PointeeVariable>>)) }
    }

    *arrayInit(dimensions: number[], init: XInitializerExpr | XInitializerArray | null, type: ObjectType, param: any): ResultOrGen<InitIndexPointerVariable<Variable>> {
        if (dimensions.length > 0) {
            const curDim = dimensions[0];
            const arrType: PointerType<ObjectType> = (() => {
                let _arrType = type;
                for (let i = dimensions.length - 1; i >= 0; i--) {
                    // will happen at least once
                    _arrType = variables.pointerType(_arrType, dimensions[i]);
                }
                return _arrType as PointerType<ObjectType>
            })();
            const childType = arrType.pointee;
            if (init) {
                debugger;
                if ((init.type === "Initializer_array") && (init.Initializers != null && curDim >= init.Initializers.length)) {
                    const arithmeticType = variables.asArithmeticType(type);
                    // last level, short hand init
                    if (init.Initializers.length === 0) {
                        const arr = new Array(curDim);
                        let i = 0;
                        while (i < curDim) {
                            const defaultValueYield = this.rt.defaultValue(type, null);
                            const shorthand = asResult(defaultValueYield) ?? (yield* (defaultValueYield as Gen<Variable>));
                            arr[i] = {
                                type: "Initializer_expr",
                                shorthand
                            };
                            i++;
                        }
                        init.Initializers = arr;
                    } else if ((init.Initializers.length === 1) && arithmeticType !== null && !variables.arithmeticProperties[arithmeticType.sig].isFloat) {
                        const val = this.rt.cast(arithmeticType, (yield* this.visit(this, init.Initializers[0].Expression, param))) as InitArithmeticVariable;
                        if ((val.v.value === -1) || (val.v.value === 0)) {
                            const arr = new Array<XInitializerExpr>(curDim);
                            let i = 0;
                            while (i < curDim) {
                                arr[i] = {
                                    type: "Initializer_expr",
                                    shorthand: variables.arithmetic(arithmeticType.sig, val.v.value, null)
                                } as XInitializerExpr;
                                i++;
                            }
                            init.Initializers = arr;
                        } else {
                            const arr = new Array(curDim);
                            arr[0] = variables.arithmetic(arithmeticType.sig, -1, null);
                            let i = 1;
                            while (i < curDim) {
                                const defaultValueYield = this.rt.defaultValue(type, null);
                                const shorthand = asResult(defaultValueYield) ?? (yield* (defaultValueYield as Gen<Variable>));
                                arr[i] = {
                                    type: "Initializer_expr",
                                    shorthand
                                } as XInitializerExpr;
                                i++;
                            }
                            init.Initializers = arr;
                        }
                    } else {
                        const arr = new Array(curDim);
                        let i = 0;
                        while (i < init.Initializers.length) {
                            const _init = init.Initializers[i];
                            let initval;
                            if ("shorthand" in _init) {
                                initval = _init;
                            } else {
                                if (_init.type === "Initializer_expr") {
                                    initval = {
                                        type: "Initializer_expr",
                                        shorthand: (yield* this.visit(this, _init.Expression, param))
                                    };
                                } else if (_init.type === "Initializer_array") {
                                    initval = {
                                        type: "Initializer_expr",
                                        shorthand: (yield* this.arrayInit(dimensions.slice(1), _init, type, param))
                                    };
                                } else {
                                    this.rt.raiseException("Not implemented initializer type error: " + _init.type);
                                }
                            }
                            arr[i] = initval;
                            i++;
                        }
                        i = init.Initializers.length;
                        while (i < curDim) {
                            const defaultValueYield = this.rt.defaultValue(type, null);
                            const shorthand = asResult(defaultValueYield) ?? (yield* (defaultValueYield as Gen<Variable>));
                            arr[i] = {
                                type: "Initializer_expr",
                                shorthand
                            };
                            i++;
                        }
                        init.Initializers = arr;
                    }
                } else if (init.type === "Initializer_expr") {
                    this.rt.raiseException("Array initialisation error: not yet implemented");
                    /*let initializer: Variable;
                    if ("shorthand" in init) {
                        initializer = init.shorthand;
                    } else {
                        param.structType = type;
                        initializer = yield* this.visit(this, init, param);
                    }
                    const arrayInitializer: ArrayVariable<Variable> | null = variables.asArray(initializer);
                    if (arrayInitializer !== null && variables.typesEqual(type, arrayInitializer.t.object)) {
                        init = {
                            type: "Initializer_array",
                            Initializers: arrayInitializer.v.values.map(e => ({
                                type: "Initializer_expr",
                                shorthand: e
                            }))
                        };
                    } else {
                        this.rt.raiseException(`cannot initialize an array to (${this.rt.makeValueString(initializer)}) of type '${this.rt.makeTypeStringOfVar(initializer)}'`, param.node);
                    }*/
                } else {
                    this.rt.raiseException("dimensions do not agree, " + curDim + " != " + init.Initializers.length, param.node);
                }
            }
            {
                let memoryObject = variables.arrayMemory(childType, new Array<ObjectValue>());
                let i = 0;
                while (i < curDim) {
                    let top: Variable;
                    top = yield* this.arrayInit(dimensions.slice(1), init?.Initializers[i] ?? null, type, param);
                    if (!variables.typesEqual(childType, top.t)) {
                        this.rt.raiseException("Array initialisation error: Invalid array element type");
                    }
                    const lvHolder: LValueIndexHolder<Variable> = { array: memoryObject as ArrayMemory<Variable>, index: i };
                    memoryObject.values.push(variables.clone(top, lvHolder, false, this.rt.raiseException, true).v);
                    i++;
                }
                return variables.indexPointer(memoryObject, 0, true, null, false);
            }
        } else {
            if (init && (init.type !== "Initializer_expr")) {
                this.rt.raiseException("Array initialisation error: dimensions do not agree, too few initializers", param.node);
            }
            let initval: Variable;
            if (init) {
                initval = (init.shorthand !== undefined) ? init.shorthand : (yield* this.visit(this, init.Expression, param)) as Variable;
            } else {
                const defaultValueYield = this.rt.defaultValue(type, null);
                initval = asResult(defaultValueYield) ?? (yield* (defaultValueYield as Gen<Variable>));
            }
            return initval;
        }
    };

    buildRecursivePointerType(rt: CRuntime, pointer: any[] | null, basetype: MaybeLeft<ObjectType> | "VOID", level: number): MaybeLeft<ObjectType> | "VOID" {
        if (pointer && (pointer.length > level)) {
            if (basetype === "VOID") {
                rt.raiseException("Array initialisation error: not yet implemented");
            }
            const type = { t: variables.pointerType(basetype.t, null), v: { lvHolder: null } } as MaybeLeft<PointerType<ObjectType | FunctionType>>;
            return this.buildRecursivePointerType(rt, pointer, type, level + 1);
        } else {
            return basetype;
        }
    };
}

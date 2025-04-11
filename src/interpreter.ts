import { resolveIdentifier } from "./shared/string_utils";
import { CRuntime, OpSignature, RuntimeScope } from "./rt";
import { ArithmeticVariable, ArrayVariable, ClassType, ClassVariable, MaybeLeft, ObjectType, ObjectValue, PointerType, StaticArrayVariable, Variable, variables } from "./variables";

const sampleGeneratorFunction = function*(): Generator<null, void, void> {
    return yield null;
};

const sampleGenerator = sampleGeneratorFunction();

const isGenerator = (g: any): boolean => {
    return (g != null ? g.constructor : undefined) === sampleGenerator.constructor;
};

export type Gen<T> = Generator<unknown, T, unknown>;
export type ResultOrGen<T> = T | Gen<T>;
function asResult<T>(g: ResultOrGen<T> | null): T | null {
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
export interface IdentifierSpec extends StatementMeta {
    type: "Identifier",
    Identifier: string
};
export interface IdentifierExpressionSpec extends StatementMeta {
    type: "IdentifierExpression",
    Identifier: string
};
export interface CompoundStatementSpec extends StatementMeta {
    type: "CompoundStatement",
    Statements: object[]
}
export interface FunctionDefinitionSpec extends StatementMeta {
    type: "FunctionDefinition",
    Declarator: DirectDeclaratorSpec,
    DeclarationSpecifiers: string[],
    CompoundStatement: CompoundStatementSpec,
};
export interface PostfixExpressionMethodInvocationSpec extends StatementMeta {
    type: "PostfixExpression_MethodInvocation",
    Expression: object,
    args: object[],
};
export interface InitDeclaratorSpec extends StatementMeta {
    type: "InitDeclarator",
    Declarator: DirectDeclaratorSpec,
    Initializers: InitializerExprSpec | null,
}
export interface ParameterDeclarationSpec extends StatementMeta {
    type: "ParameterDeclaration"
    DeclarationSpecifiers: string[],
    Declarator: InitDeclaratorSpec,
}
export interface ParameterTypeListSpec extends StatementMeta {
    type: "ParameterTypeList",
    ParameterList: ParameterDeclarationSpec[],
    varargs: boolean,
}
export interface DirectDeclaratorSpec extends StatementMeta {
    type: "DirectDeclarator",
    left: IdentifierSpec | DirectDeclaratorSpec,
    right: DirectDeclaratorModifierParameterTypeListSpec | DirectDeclaratorModifierIdentifierListSpec | DirectDeclaratorModifier[],
    Reference?: any[][],
    Pointer: any[][] | null,
}
type DirectDeclaratorModifier = DirectDeclaratorModifierParameterTypeListSpec | DirectDeclaratorModifierIdentifierListSpec | DirectDeclaratorModifierArraySpec;
export interface DirectDeclaratorModifierArraySpec extends StatementMeta {
    type: "DirectDeclarator_modifier_array",
    Expression: UnknownSpec | null,
}
export interface DirectDeclaratorModifierParameterTypeListSpec extends StatementMeta {
    type: "DirectDeclarator_modifier_ParameterTypeList",
    ParameterTypeList: ParameterTypeListSpec,
}
export interface DirectDeclaratorModifierIdentifierListSpec extends StatementMeta {
    type: "DirectDeclarator_modifier_IdentifierList",
    IdentifierList: any,
}
export interface DeclarationSpec extends StatementMeta {
    type: "Declaration",
    DeclarationSpecifiers: string[],
    InitDeclaratorList: InitDeclaratorSpec[],
}
export interface DecimalConstantSpec extends StatementMeta {
    type: "DecimalConstant",
    value: string
}
export interface ConstantExpressionSpec extends StatementMeta {
    type: "ConstantExpression",
    Expression: DecimalConstantSpec,
}
export interface InitializerExprSpec extends StatementMeta {
    type: "Initializer_expr",
    Expression: ConstantExpressionSpec
}
export interface StructDeclarationSpec extends StatementMeta {
    type: "StructDeclaration",
    DeclarationIdentifiers: string[],
    StructMemberList: StructMemberSpec[],
    InitVariables: boolean,
}
export interface StructMemberSpec extends StatementMeta {
    type: "StructMember",
    MemberType: string[],
    Declarators: InitDeclaratorSpec[],
}
export interface UnknownSpec {
    type: "<stub>"
}
type DeclaratorYield = { name: string, type: MaybeLeft<ObjectType> };

type InterpStatement = any;

export interface MemberObject {
    name: string,
    variable: Variable
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
            *DirectDeclarator(interp, s: DirectDeclaratorSpec, param: { basetype: MaybeLeft<ObjectType> }) {
                ({ rt } = interp);
                let { basetype } = param;
                basetype = interp.buildRecursivePointerType(s.Pointer, basetype, 0) as MaybeLeft<ObjectType>;
                if (!(s.right instanceof Array)) {
                    rt.raiseException("Type error or not yet implemented");
                }
                if (s.right.length === 1) {
                    let varargs;
                    const right = s.right[0];
                    let ptl = null;
                    if (right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                        ptl = right.ParameterTypeList;
                        ({ varargs } = ptl);
                    } else if ((right.type === "DirectDeclarator_modifier_IdentifierList") && (right.IdentifierList === null)) {
                        rt.raiseException("Type error or not yet implemented");
                        //ptl = right.ParameterTypeList;
                        //varargs = false;
                    }
                    if (ptl != null) {
                        const argTypes: (MaybeLeft<ObjectType> | "VOID")[] = [];
                        for (const _param of ptl.ParameterList) {
                            const _basetypeYield = rt.simpleType(_param.DeclarationSpecifiers);
                            const _basetype = asResult(_basetypeYield) ?? (yield* (_basetypeYield as Gen<MaybeLeft<ObjectType> | "VOID">))
                            let _type: MaybeLeft<ObjectType> | "VOID";
                            if (_param.Declarator != null) {
                                this.rt.raiseException("Not yet implemented");
                                /*const _pointer = _param.Declarator.Pointer;
                                _type = interp.buildRecursivePointerType(_pointer, _basetype, 0);
                                if ((_param.Declarator.right != null) && (_param.Declarator.right.length > 0)) {
                                    const dimensions = [];
                                    for (let j = 0; j < _param.Declarator.right.length; j++) {
                                        let dim = _param.Declarator.right[j];
                                        if (dim.type !== "DirectDeclarator_modifier_array") {
                                            rt.raiseException("unacceptable array initialization", dim);
                                        }
                                        if (dim.Expression !== null) {
                                            dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dim.Expression, param))) as ArithmeticVariable).v.value;
                                        } else if (j > 0) {
                                            rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
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
                            rt.raiseException("not yet implemented");
                            //argTypes.push(_type);
                        }
                        //basetype = variables.functionType(basetype, argTypes);
                    }
                }
                if ((s.right.length > 0) && (s.right[0].type === "DirectDeclarator_modifier_array")) {
                    const dimensions = [];
                    for (let j = 0; j < s.right.length; j++) {
                        const dimSpec = s.right[j];
                        if (dimSpec.type !== "DirectDeclarator_modifier_array") {
                            rt.raiseException("unacceptable array initialization", dimSpec);
                        }
                        let dim: number;
                        if (dimSpec.Expression !== null) {
                            dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dimSpec.Expression, param))) as ArithmeticVariable).v.value ?? -1;
                        } else if (j > 0) {
                            rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dimSpec);
                        } else {
                            dim = -1;
                        }
                        dimensions.push(dim);
                    }
                }

                if (s.left.type === "Identifier") {
                    return { type: basetype, name: s.left.Identifier };
                } else {
                    const _basetype = param.basetype;
                    param.basetype = basetype;
                    const ret = yield* interp.visit(interp, s.left, param);
                    param.basetype = _basetype;
                    return ret;
                }
            },
            *TypedefDeclaration(interp, s, param) {
                ({
                    rt
                } = interp);
                const basetypeYield = rt.simpleType(s.DeclarationSpecifiers);
                const basetype = asResult(basetypeYield) ?? (yield* (basetypeYield as Gen<MaybeLeft<ObjectType> | "VOID">));
                const _basetype = param.basetype;
                param.basetype = basetype;
                for (const declarator of s.Declarators) {
                    const { type, name } = yield* interp.visit(interp, declarator, param);
                    rt.registerTypedef(type, name);
                }
                param.basetype = _basetype;
            },
            *ParameterTypeList(interp, s: ParameterTypeListSpec, param) {
                const argTypes = [];
                const argNames = [];
                const readonlyArgs: boolean[] = [];
                const optionalArgs = [];

                let i = 0;
                while (i < s.ParameterList.length) {
                    const _param = s.ParameterList[i];

                    let _type: MaybeLeft<ObjectType>;
                    let _init = null;
                    let _name = null;
                    let _readonly = false;
                    if (param.insideDirectDeclarator_modifier_ParameterTypeList) {
                        const _basetypeYield = rt.simpleType(_param.DeclarationSpecifiers);
                        const _basetype = asResult(_basetypeYield) ?? (yield* (_basetypeYield as Gen<MaybeLeft<ObjectType> | "VOID">));
                        if (_basetype === "VOID") {
                            rt.raiseException("Type error or not yet implemented");
                        }
                        _type = _basetype;
                    } else {
                        if (_param.Declarator == null) {
                            rt.raiseException("missing declarator for argument", _param);
                        }
                        _init = _param.Declarator.Initializers;

                        const _declarationSpecifiers = _param.DeclarationSpecifiers.flatMap((specifier: any) => specifier?.DeclarationSpecifiers || specifier);
                        const _basetypeYield = rt.simpleType(_declarationSpecifiers);
                        const _basetype = asResult(_basetypeYield) ?? (yield* (_basetypeYield as Gen<MaybeLeft<ObjectType> | "VOID">));
                        if (_basetype === "VOID") {
                            rt.raiseException("Type error or not yet implemented");
                        }
                        const _reference = _param.Declarator.Declarator.Reference;
                        _readonly = _declarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));

                        if (_reference) {
                            _type = { t: _basetype.t, v: { lvHolder: "SELF" } };
                        } else {
                            const _pointer = _param.Declarator.Declarator.Pointer;
                            const __type = interp.buildRecursivePointerType(_pointer, _basetype, 0);
                            if (__type === "VOID") {
                                rt.raiseException("Type error or not yet implemented");
                            }
                            _type = __type;
                        }

                        if (_param.Declarator.Declarator.left.type === "DirectDeclarator") {
                            const __basetype = param.basetype;
                            param.basetype = _basetype;
                            const { name } = (yield* interp.visit(interp, _param.Declarator.Declarator.left, param)) as DeclaratorYield;
                            param.basetype = __basetype;
                            _name = name;
                        } else {
                            if (_param.Declarator.Declarator.left.type !== "Identifier") {
                                rt.raiseException("Not yet implemented");
                            }
                            _name = _param.Declarator.Declarator.left.Identifier;
                        }
                        if (!(_param.Declarator.Declarator.right instanceof Array)) {
                            rt.raiseException("not yet implemented");
                        }
                        if (_param.Declarator.Declarator.right.length > 0) {
                            if (_param.Declarator.Declarator.right[0].type === "DirectDeclarator_modifier_ParameterTypeList") {
                                const dim = _param.Declarator.Declarator.right[0];
                                param.insideDirectDeclarator_modifier_ParameterTypeList = true;
                                const { argTypes: _argTypes, argNames: _argNames, optionalArgs: _optionalArgs } = yield* interp.visit(interp, dim.ParameterTypeList, param);
                                param.insideDirectDeclarator_modifier_ParameterTypeList = false;
                                rt.raiseException("not yet implemented");
                                //_type = variables.pointerType(variables.functionType(_type, _argTypes));
                            } else {
                                rt.raiseException("not yet implemented");
                                /*const dimensions = [];
                                let j = 0;
                                while (j < _param.Declarator.Declarator.right.length) {
                                    let dim = _param.Declarator.Declarator.right[j];
                                    if (dim.type !== "DirectDeclarator_modifier_array") {
                                        rt.raiseException("unacceptable array initialization", dim);
                                    }
                                    if (dim.Expression !== null) {
                                        dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dim.Expression, param))) as ArithmeticVariable).v.value;
                                    } else if (j > 0) {
                                        rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                                    } else {
                                        dim = -1;
                                    }
                                    dimensions.push(dim);
                                    j++;
                                }
                                _type = interp.arrayType(dimensions, _type);*/
                            }
                        }
                    }
                    /*if (_init !== null) {
                        optionalArgs.push({
                            type: _type,
                            name: _name,
                            expression: _init.Expression
                        });
                    } else */ {
                        if (optionalArgs.length > 0) {
                            rt.raiseException("all default arguments must be at the end of arguments list", _param);
                        }
                        argTypes.push(_type);
                        argNames.push(_name);
                        readonlyArgs.push(_readonly);
                    }
                    i++;
                }
                return { argTypes, argNames, readonlyArgs };
            },
            *FunctionDefinition(interp, s: FunctionDefinitionSpec, param) {
                ({
                    rt
                } = interp);
                const {
                    scope
                } = param;
                const typedScope = scope === "{global}" ? "{global}" : rt.raiseException("Not yet implemented");
                if (s.Declarator.left.type !== "Identifier") {
                    rt.raiseException("Not yet implemented");
                }
                const name = s.Declarator.left.Identifier;
                const _basetypeYield = rt.simpleType(s.DeclarationSpecifiers);
                let basetype = asResult(_basetypeYield) ?? (yield* (_basetypeYield as Gen<MaybeLeft<ObjectType> | "VOID">));
                const pointer = s.Declarator.Pointer;
                basetype = interp.buildRecursivePointerType(pointer, basetype, 0);
                let ptl: any;
                let varargs;
                if (s.Declarator.right instanceof Array) {
                    rt.raiseException("unacceptable argument list", s.Declarator.right);
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
                    rt.raiseException("unacceptable argument list", s.Declarator.right);
                }
                const { argTypes, argNames } = yield* interp.visit(interp, ptl, param);
                const stat = s.CompoundStatement;
                rt.defFunc(typedScope, name, basetype, argTypes, argNames, stat, interp);
            },
            *Declaration(interp, s: DeclarationSpec, param: { deducedType: MaybeLeft<ObjectType>, basetype?: MaybeLeft<ObjectType> }): ResultOrGen<void> {
                const { rt } = interp;
                const deducedType = s.DeclarationSpecifiers.includes("auto");
                const isConst = s.DeclarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));
                const _basetypeYield: ResultOrGen<MaybeLeft<ObjectType> | "VOID"> = deducedType ? (param.deducedType ?? interp.visit(interp, s.InitDeclaratorList[0].Initializers, param) as Gen<MaybeLeft<ObjectType>>) : rt.simpleType(s.DeclarationSpecifiers);
                const _basetype = asResult(_basetypeYield) ?? (yield* (_basetypeYield as Gen<MaybeLeft<ObjectType> | "VOID">));
                const basetype = (_basetype === "VOID") ? rt.raiseException("Type error or not yet implemented") : _basetype;

                for (const dec of s.InitDeclaratorList) {
                    let visitResult: DeclaratorYield;
                    {
                        const _basetype = param.basetype;
                        param.basetype = basetype;
                        visitResult = (yield* interp.visit(interp, dec.Declarator, param)) as DeclaratorYield;
                        param.basetype = _basetype;
                    }
                    const decType: MaybeLeft<ObjectType> = (dec.Declarator.Pointer instanceof Array) ? { t: { sig: "PTR", pointee: basetype.t }, v: { lvHolder: "SELF" } } : basetype;
                    const { name, type } = visitResult;
                    let initSpec = dec.Initializers;

                    if (!(dec.Declarator.right instanceof Array)) {
                        rt.raiseException("Not yet implemented");
                    }
                    const rhs = dec.Declarator.right as DirectDeclaratorModifier[];
                    if (rhs.length > 0) {
                        if (rhs[0].type as string === "DirectDeclarator_modifier_array") {
                            rt.raiseException("Not yet implemented");
                            /*const dimensions = [];
                            for (let j = 0; j < rhs.length; j++) {
                                let dim = rhs[j];
                                if (dim.Expression !== null) {
                                    //rt.raiseException("Not yet implemented");
                                    dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dim.Expression, param))) as ArithmeticVariable).v.value;
                                } else if (j > 0) {
                                    rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                                } else {
                                    if (init.type === "Initializer_expr") {
                                        const initializer: Variable = yield* interp.visit(interp, init, param);
                                        if basetype is char and initializer.t is char*
                                        if (variables.asArithmeticType(basetype)?.sig === "I8" && variables.typesEqual(initializer.t, variables.staticArrayType(variables.initializer.t)) rt.isArrayType(initializer) && rt.isCharType(initializer.t.eleType)) {
                                            // string init
                                            dim = initializer.v.target.length;
                                            init = {
                                                type: "Initializer_array",
                                                Initializers: initializer.v.target.map(e => ({
                                                    type: "Initializer_expr",
                                                    shorthand: e
                                                }))
                                            };
                                        } else {
                                            rt.raiseException("cannot initialize an array to " + rt.makeValString(initializer), init);
                                        }
                                    } else {
                                        dim = init.Initializers.length;
                                    }
                                }
                                dimensions.push(dim);
                            }

                            param.node = init;
                            const arrayYield = interp.arrayInit(dimensions, init, basetype, param);
                            init = asResult(arrayYield) ?? (yield* arrayYield as Gen<StaticArrayVariable<Variable>>);
                            delete param.node;

                            init.dataType = dec.Declarator.left.DataType;
                            init.readonly = readonly;
                            rt.defVar(name, init);*/
                        } else if (rhs[0].type as string === "DirectDeclarator_modifier_Constructor") {
                            //rt.raiseException("Not yet implemented");
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
                            const classType = (_classType === null) ? rt.raiseException("Not yet implemented / Type Error") : _classType;

                            const initClass = variables.class(classType, {}, "SELF");
                            const xinit = rt.getFunctionTarget(rt.getFuncByParams(classType, "o(())", constructorArgs))(this, initClass, ...constructorArgs);
                            rt.raiseException("Not yet implemented");

                            /*xinit.t = (dec.Declarator.left as any).DataType;
                            xinit.v.isConst = readonly;
                            rt.defVar(name, xinit);*/
                        }
                    } else {
                        const initVarYield = (initSpec === null) ? rt.defaultValue(type.t, "SELF") : interp.visit(interp, initSpec.Expression) as Gen<Variable>;
                        let initVar = asResult(initVarYield) ?? (yield* (initVarYield as Gen<Variable>));
                        if (dec.Declarator.Reference === undefined && initVar.v.lvHolder !== null) {
                            initVar = variables.clone(initVar, "SELF", false, rt.raiseException);
                        }

                        if (!variables.typesEqual(initVar.t, decType.t)) {
                            const castVar = rt.cast(decType.t, initVar);
                            initVar = asResult(castVar) ?? (yield* castVar as Gen<Variable>);
                        }
                        if (isConst) {
                            rt.raiseException("Not yet implemented");
                        }
                        rt.defVar(name, initVar);
                    }
                }
            },
            *STLDeclaration(interp, s, param) {
                ({ rt } = interp);

                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                rt.raiseException("Not yet implemented");
                /*if (!rt.isVectorClass(basetype))
                    rt.raiseException("Only vectors are currently supported for STL Declaration!");

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
            *StructDeclaration(interp, s: StructDeclarationSpec, param) {
                ({ rt } = interp);

                for (const identifier of s.DeclarationIdentifiers) {
                    const structMemberList: MemberObject[] = [];
                    for (const structMember of s.StructMemberList) {
                        for (const dec of structMember.Declarators) {
                            let init = dec.Initializers;

                            const _simpleTypeYield = rt.simpleType(structMember.MemberType);
                            param.basetype = asResult(_simpleTypeYield) ?? (yield* (_simpleTypeYield as Gen<MaybeLeft<ObjectType> | "VOID">));
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
                        rt.raiseException("not yet implemented");
                        //const structType = rt.newStruct(`initialized_struct_${identifier}`, structMemberList);
                        //rt.defVar(identifier, rt.defaultValue(structType));
                    } else {
                        if (rt.scope.length !== 1) {
                            rt.raiseException("Nested classes are not yet implemented");
                        }
                        rt.defineStruct("{global}", identifier, structMemberList);
                    }
                }
            },
            *Initializer_expr(interp, s: InitializerExprSpec, param) {
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
                    rt.raiseException("you cannot use case outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        (rt.cast(ce.t, param["switch"]) as Variable).v === ce.v
                    ];
                } else {
                    rt.raiseException("you can only use case directly in a switch block");
                }
            },
            Label_default(interp, _s, param) {
                ({
                    rt
                } = interp);
                if (param["switch"] === undefined) {
                    rt.raiseException("you cannot use default outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        true
                    ];
                } else {
                    rt.raiseException("you can only use default directly in a switch block");
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
                if (rt.value(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>))) {
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
                        const castBool = rt.value(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
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
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<ArithmeticVariable>;
                        const castBool = rt.value(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
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
                    iterator = rt.getFunctionTarget(sym)(rt, iterable);
                } catch (ex) {
                    if (variables.asArrayType !== null) {
                        iterator = iterable.v.target[Symbol.iterator]();
                    }
                }

                if (!iterator) {
                    rt.raiseException(`Variable '${s.Expression.Identifier}' is not iterator type.`);
                }

                for (const element of iterator) {
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
                return return_val;
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
                        const castBool = rt.value(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
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
                rt.raiseException("not implemented");
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
                    ret = interp.rt.asCapturedVariable(ret);

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
                    return variables.function(funsym.type, varname, funsym.target, null, null);
                }
            },
            *ParenthesesExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *PostfixExpression_ArrayAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const index = yield* interp.visit(interp, s.index, param);

                param.structType = ret.t.eleType;
                const funsym = rt.getOpByParams("{global}", "o(_[])", [index.t]);
                const r = rt.getFunctionTarget(funsym)(rt, ret, index);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *PostfixExpression_MethodInvocation(interp, s: PostfixExpressionMethodInvocationSpec, param) {
                ({
                    rt
                } = interp);
                const args: Variable[] = yield* (function*() {
                    const result = [];
                    for (const e of s.args) {
                        let thisArg = yield* interp.visit(interp, e, param);
                        thisArg = interp.rt.asCapturedVariable(thisArg);
                        result.push(thisArg);
                    }
                    return result;
                }).call(this);
                const ret = yield* interp.visit(interp, s.Expression, { functionArgs: args });

                const retfun = variables.asFunction(ret);
                if (retfun !== null) {
                    const resultOrGen = rt.getFunctionTarget(retfun.v)(rt, ...args);
                    return asResult(resultOrGen) ?? (yield* resultOrGen as Gen<Variable>);
                } else {
                    let bindThis;
                    if (ret.v.bindThis != null) {
                        ({
                            bindThis
                        } = ret.v);
                    } else {
                        bindThis = ret;
                    }
                    if (bindThis !== null) {
                        rt.raiseException("not yet implemented");
                    }
                    const r = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(_call)", args))(rt, ...args);
                    return asResult<Variable>(r) ?? (yield* r as Gen<Variable>);
                }
            },
            *PostfixExpression_MemberAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                return rt.getMember(ret, s.member);
            },
            *PostfixExpression_MemberPointerAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                const retc = variables.asClass(ret);
                if (retc === null) {
                    rt.raiseException("Expected a class or struct");
                }
                const maybePtrType = variables.asPointerType(ret.t);
                if (maybePtrType !== null && variables.asFunctionType(maybePtrType.pointee) === null) {
                    const { member } = s;
                    const target = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(_->_)", [retc]))(rt, retc) as Generator;
                    if (isGenerator(ret)) {
                        return rt.getMember(yield* target as Generator, member);
                    } else {
                        rt.raiseException("Expected a generator");
                    }
                } else {
                    const member = yield* interp.visit(interp, {
                        type: "IdentifierExpression",
                        Identifier: s.member
                    }, param);
                    const target = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(_->_)", [retc]))(rt, retc) as Generator;
                    if (isGenerator(ret)) {
                        return rt.getMember(yield* target as Generator, member);
                    } else {
                        rt.raiseException("Expected a generator");
                    }
                }
            },
            *PostfixExpression_PostIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(_++)", [ret]))(rt, ret);
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
                const r = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(_--)", [ret]))(rt, ret);
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
                const r = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(++_)", [ret]))(rt, ret);
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
                const r = rt.getFunctionTarget(rt.getOpByParams("{global}", "o(--_)", [ret]))(rt, ret);
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
                const r = rt.getFunctionTarget(rt.getOpByParams("{global}", `o(${s.op}_)` as OpSignature, [ret]))(rt, ret);
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
            *UnaryExpression_Sizeof_Type(interp, s, param) {
                ({
                    rt
                } = interp);
                const type = yield* interp.visit(interp, s.TypeName, param);
                return variables.arithmetic("I32", rt.getSizeByType(type), null);
            },
            *CastExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                ret = variables.clone(rt.asCapturedVariable(ret), null, false, rt.raiseException);
                const type = (yield* interp.visit(interp, s.TypeName, param)) as MaybeLeft<ObjectType> | "VOID";
                if (type === "VOID") {
                    rt.raiseException("Cannot cast to void");
                }
                return rt.cast(type.t, ret);
            },
            *TypeName(interp, s, _param): Gen<MaybeLeft<ObjectType> | "VOID"> {
                ({
                    rt
                } = interp);
                const typename = [];
                for (const baseType of s.base) {
                    if (baseType !== "const") {
                        typename.push(baseType);
                    }
                }
                const resultYield = rt.simpleType(typename);
                return asResult(resultYield) ?? (yield* (resultYield as Gen<MaybeLeft<ObjectType> | "VOID">));
            },
            *BinOpExpression(interp, s, param) {
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
                    let left = yield* interp.visit(interp, s.left, param);
                    let right = yield* interp.visit(interp, s.right, param);
                    left = rt.asCapturedVariable(left);
                    right = rt.asCapturedVariable(right);
                    const r = rt.getFunctionTarget(rt.getFuncByParams("{global}", rt.makeBinaryOperatorFuncName(op), [left, right]))(rt, left, right);
                    if (isGenerator(r)) {
                        return yield* r as Generator;
                    } else {
                        return r;
                    }
                }
            },
            *LogicalANDExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const op = "o(_&&_)";
                const left = yield* interp.visit(interp, s.left, param);
                const right = yield* interp.visit(interp, s.right, param);
                const directOp = rt.tryGetOpByParams("{global}", op, [left, right]);
                if (directOp !== null) {
                    const target = rt.getFunctionTarget(directOp)(rt, left, right);
                    return (isGenerator(target)) ? (yield* target as Generator) : target;
                } else {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    const rhsBoolYield = rt.cast(boolType, right);
                    const lhsBool = asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>);
                    const rhsBool = asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>);
                    const boolOp = rt.getOpByParams("{global}", op, [lhsBool, rhsBool]);
                    const target = rt.getFunctionTarget(boolOp)(rt, lhsBool, rhsBool);
                    return asResult(target) ?? (yield* target as Gen<ArithmeticVariable>);
                }
            },
            *LogicalORExpression(interp, s, param) {
                const op = "o(_||_)";
                const left = yield* interp.visit(interp, s.left, param);
                const right = yield* interp.visit(interp, s.right, param);
                const directOp = rt.tryGetOpByParams("{global}", op, [left, right]);
                if (directOp !== null) {
                    const target = rt.getFunctionTarget(directOp)(rt, left, right);
                    return (isGenerator(target)) ? (yield* target as Generator) : target;
                } else {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    const rhsBoolYield = rt.cast(boolType, right);
                    const lhsBool = asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>);
                    const rhsBool = asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>);
                    const boolOp = rt.getOpByParams("{global}", op, [lhsBool, rhsBool]);
                    const target = rt.getFunctionTarget(boolOp)(rt, lhsBool, rhsBool);
                    return asResult(target) ?? (yield* target as Gen<ArithmeticVariable>);
                }
            },
            *ConditionalExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const obj = yield* interp.visit(interp, s.cond, param);
                const boolType = variables.arithmeticType("BOOL");
                const boolYield = rt.cast(boolType, obj) as ResultOrGen<ArithmeticVariable>;
                const cond = (asResult(boolYield) ?? (yield* boolYield as Gen<ArithmeticVariable>)).v.value;
                return yield* interp.visit(interp, cond ? s.t : s.f, param);
            },
            *ConstantExpression(interp, s: ConstantExpressionSpec, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, (s as any).Expression, param);
            },
            *StringLiteralExpression(interp, s, param) {
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
                    const fillerStruct = asResult(fillerStructYield) ?? (yield* (fillerStructYield as Gen<ClassVariable>));
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
                    rt.raiseException("Not yet implemented");
                    //return variables.indexPointer(param.structType, structArray.length), rt.makeArrayPointerValue(structArray, 0));
                }

                return valuesToStruct(arrayValues);
            },
            StringLiteral(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Not yet implemented");
                /*switch (s.prefix) {
                    case null:
                        let maxCode = -1;
                        let minCode = 1;
                        for (const i of s.value) {
                            const code = i.charCodeAt(0);
                            if (maxCode < code) { maxCode = code; }
                            if (minCode > code) { minCode = code; }
                        }
                        const {
                            limits
                        } = rt.config;
                        const typeName = (maxCode <= limits["char"].max) && (minCode >= limits["char"].min) ? "char" : "wchar_t";
                        return rt.makeCharArrayFromString(s.value, typeName);
                    case "L":
                        return rt.makeCharArrayFromString(s.value, "wchar_t");
                    case "u8":
                        return rt.makeCharArrayFromString(s.value, "char");
                    case "u":
                        return rt.makeCharArrayFromString(s.value, "char16_t");
                    case "U":
                        return rt.makeCharArrayFromString(s.value, "char32_t");
                }*/
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
                    rt.raiseException("a character constant must have and only have one character.");
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
            DecimalConstant(interp, s: DecimalConstantSpec, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 10);
                const intProps = variables.arithmeticProperties["I32"];
                const uintProps = variables.arithmeticProperties["U32"];
                if (Number.isNaN(num) || num > uintProps.maxv || num < intProps.minv) {
                    rt.raiseException(`Constant integer expression '${num}' is not in a signed 32-bit integer range`);
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
                    rt.raiseException(`Constant integer expression '${num}' is not in a signed 32-bit integer range`);
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
                    rt.raiseException(`Constant integer expression '${num}' is not in a signed 32-bit integer range`);
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
                    rt.raiseException(`Constant integer expression '${num}' is not in a signed 32-bit integer range`);
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
                rt.raiseException("not implemented");
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
                rt.raiseException("not implemented");
            },
            NamespaceAliasDefinition(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("not implemented");
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
        console.log(`${s.sLine}: visiting ${s.type}`);
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
            this.rt.raiseException("untyped syntax structure");
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

    *arrayInit(dimensions: number[], init: any, type: ObjectType, param: any): ResultOrGen<StaticArrayVariable<Variable>> {
        if (dimensions.length > 0) {
            let val;
            const curDim = dimensions[0];
            const arithmeticType = variables.asArithmeticType(type);
            if (init) {
                if ((init.type === "Initializer_array") && (init.Initializers != null && curDim >= init.Initializers.length)) {
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
                        val = this.rt.cast(arithmeticType, (yield* this.visit(this, init.Initializers[0].Expression, param))) as ArithmeticVariable;
                        if ((val.v.value === -1) || (val.v.value === 0)) {
                            const arr = new Array(curDim);
                            let i = 0;
                            while (i < curDim) {
                                arr[i] = {
                                    type: "Initializer_expr",
                                    shorthand: variables.arithmetic(arithmeticType.sig, val.v.value, null)
                                };
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
                                };
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
                                    this.rt.raiseException("Not implemented initializer type: " + _init.type);
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
                    let initializer: Variable;
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
                    }
                } else {
                    this.rt.raiseException("dimensions do not agree, " + curDim + " != " + init.Initializers.length, param.node);
                }
            }
            {
                let arr: ObjectValue[] = [];
                let i = 0;
                while (i < curDim) {
                    let top: Variable;
                    if (init && i < init.Initializers.length) {
                        top = yield* this.arrayInit(dimensions.slice(1), init.Initializers[i], type, param);
                    } else {
                        top = yield* this.arrayInit(dimensions.slice(1), null, type, param);
                    }
                    if (!variables.typesEqual(type, top.t)) {
                        this.rt.raiseException("Invalid array element type");
                    }
                    arr.push(top.v);
                    i++;
                }
                return variables.staticArray(type, arr, null);
            }
        } else {
            if (init && (init.type !== "Initializer_expr")) {
                this.rt.raiseException("dimensions do not agree, too few initializers", param.node);
            }
            let initval: Variable;
            if (init) {
                if ("shorthand" in init) {
                    initval = init.shorthand as Variable;
                } else {
                    initval = (yield* this.visit(this, init.Expression, param)) as Variable;
                }
            } else {
                const defaultValueYield = this.rt.defaultValue(type, null);
                initval = asResult(defaultValueYield) ?? (yield* (defaultValueYield as Gen<Variable>));
            }
            return initval;
        }
    };

    buildRecursivePointerType(pointer: any, basetype: MaybeLeft<ObjectType> | "VOID", level: number): MaybeLeft<ObjectType> | "VOID" {
        if (pointer && (pointer.length > level)) {
            const type = { t: variables.pointerType(basetype === "VOID" ? variables.voidType() : basetype.t), v: { lvHolder: null } } as MaybeLeft<PointerType>;
            return this.buildRecursivePointerType(pointer, type, level + 1);
        } else {
            return basetype;
        }
    };
}

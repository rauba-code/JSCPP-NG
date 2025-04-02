import { resolveIdentifier } from "./shared/string_utils";
import { CRuntime, OpSignature, RuntimeScope } from "./rt";
import { ArithmeticVariable, DynamicArrayVariable, ObjectType, ObjectValue, StaticArrayVariable, Variable, variables } from "./variables";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sampleGeneratorFunction = function*(): Generator<null, void, void> {
    return yield null;
};

const sampleGenerator = sampleGeneratorFunction();

const isGenerator = (g: any): boolean => {
    return (g != null ? g.constructor : undefined) === sampleGenerator.constructor;
};

type Gen<T> = Generator<unknown, T, unknown>;
type ResultOrGen<T> = T | Gen<T>;
function asResult<T>(g: ResultOrGen<T>): T | null {
    if ((g != null ? g.constructor : undefined) === sampleGenerator.constructor) {
        return null;
    }
    return g as T;
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

type InterpStatement = any;

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
            *DirectDeclarator(interp, s, param) {
                ({ rt } = interp);
                let { basetype } = param;
                basetype = interp.buildRecursivePointerType(s.Pointer, basetype, 0);
                if (s.right.length === 1) {
                    let varargs;
                    const right = s.right[0];
                    let ptl = null;
                    if (right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                        ptl = right.ParameterTypeList;
                        ({ varargs } = ptl);
                    } else if ((right.type === "DirectDeclarator_modifier_IdentifierList") && (right.IdentifierList === null)) {
                        ptl = right.ParameterTypeList;
                        varargs = false;
                    }
                    if (ptl != null) {
                        const argTypes = [];
                        for (const _param of ptl.ParameterList) {
                            const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                            let _type;
                            if (_param.Declarator != null) {
                                const _pointer = _param.Declarator.Pointer;
                                this.rt.raiseException("Not yet implemented");
                                /*_type = interp.buildRecursivePointerType(_pointer, _basetype, 0);
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
                            argTypes.push(_type);
                        }
                        rt.raiseException("not yet implemented");
                        //basetype = variables.functionType(basetype, argTypes);
                    }
                }
                if ((s.right.length > 0) && (s.right[0].type === "DirectDeclarator_modifier_array")) {
                    const dimensions = [];
                    for (let j = 0; j < s.right.length; j++) {
                        let dim = s.right[j];
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
                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                const _basetype = param.basetype;
                param.basetype = basetype;
                for (const declarator of s.Declarators) {
                    const { type, name } = yield* interp.visit(interp, declarator, param);
                    rt.registerTypedef(type, name);
                }
                param.basetype = _basetype;
            },
            *ParameterTypeList(interp, s, param) {
                const argTypes = [];
                const argNames = [];
                const readonlyArgs: boolean[] = [];
                const optionalArgs = [];

                let i = 0;
                while (i < s.ParameterList.length) {
                    const _param = s.ParameterList[i];

                    let _type;
                    let _init = null;
                    let _name = null;
                    let _readonly = false;
                    if (param.insideDirectDeclarator_modifier_ParameterTypeList) {
                        const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                        _type = _basetype;
                    } else {
                        if (_param.Declarator == null) {
                            rt.raiseException("missing declarator for argument", _param);
                        }
                        _init = _param.Declarator.Initializers;

                        const _declarationSpecifiers = _param.DeclarationSpecifiers.flatMap((specifier: any) => specifier?.DeclarationSpecifiers || specifier);
                        const _basetype = rt.simpleType(_declarationSpecifiers);
                        const _reference = _param.Declarator.Declarator.Reference;
                        _readonly = _declarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));

                        if (_reference) {
                            rt.raiseException("not yet implemented");
                            //_type = rt.makeReferenceType(_basetype);
                        } else {
                            const _pointer = _param.Declarator.Declarator.Pointer;
                            rt.raiseException("not yet implemented");
                            //_type = interp.buildRecursivePointerType(_pointer, _basetype, 0);
                        }

                        /*if (_param.Declarator.Declarator.left.type === "DirectDeclarator") {
                            const __basetype = param.basetype;
                            param.basetype = _basetype;
                            const { name, type } = yield* interp.visit(interp, _param.Declarator.Declarator.left, param);
                            param.basetype = __basetype;
                            _name = name;
                        } else {
                            _name = _param.Declarator.Declarator.left.Identifier;
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
                                const dimensions = [];
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
                                _type = interp.arrayType(dimensions, _type);
                            }
                        }*/
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
            *FunctionDefinition(interp, s, param) {
                ({
                    rt
                } = interp);
                const {
                    scope
                } = param;
                const name = s.Declarator.left.Identifier;
                let basetype = rt.simpleType(s.DeclarationSpecifiers);
                const pointer = s.Declarator.Pointer;
                rt.raiseException("not yet implemented");
                /*basetype = interp.buildRecursivePointerType(pointer, basetype, 0);
                let ptl;
                let varargs;
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
                //rt.raiseException("Not yet implemented");
                rt.defFunc(scope, name, basetype.sig === "VOID" ? "VOID" : { t: basetype as ObjectType, left: false }, argTypes, argNames, stat, interp);*/
            },
            *Declaration(interp, s, param) {
                const { rt } = interp;
                const deducedType = s.DeclarationSpecifiers.includes("auto");
                const readonly = s.DeclarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));
                const basetype = deducedType ? (param.deducedType ?? (yield* interp.visit(interp, s.InitDeclaratorList[0].Initializers, param)).t) : rt.simpleType(s.DeclarationSpecifiers);

                for (const dec of s.InitDeclaratorList) {
                    let visitResult;
                    {
                        const _basetype = param.basetype;
                        param.basetype = basetype;
                        visitResult = yield* interp.visit(interp, dec.Declarator, param);
                        param.basetype = _basetype;
                    }
                    const { name, type } = visitResult;
                    let init = dec.Initializers;

                    if (dec.Declarator.right.length > 0) {
                        if (dec.Declarator.right[0].type === "DirectDeclarator_modifier_array") {
                            const dimensions = [];
                            for (let j = 0; j < dec.Declarator.right.length; j++) {
                                let dim = dec.Declarator.right[j];
                                if (dim.Expression !== null) {
                                    //rt.raiseException("Not yet implemented");
                                    dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dim.Expression, param))) as ArithmeticVariable).v.value;
                                } else if (j > 0) {
                                    rt.raiseException("multidimensional array must have bounds for all dimensions except the first", dim);
                                } else {
                                    if (init.type === "Initializer_expr") {
                                        const initializer: Variable = yield* interp.visit(interp, init, param);
                                        rt.raiseException("Not yet implemented");
                                        // if basetype is char and initializer.t is char*
                                        /*if (variables.asArithmeticType(basetype)?.sig === "I8" && variables.typesEqual(initializer.t, variables.staticArrayType(variables.initializer.t)) rt.isArrayType(initializer) && rt.isCharType(initializer.t.eleType)) {
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
                                        }*/
                                    } else {
                                        dim = init.Initializers.length;
                                    }
                                }
                                dimensions.push(dim);
                            }

                            param.node = init;
                            const arrayYield = interp.arrayInit(dimensions, init, basetype, param);
                            init = asResult(arrayYield) ?? (yield* arrayYield as Gen<StaticArrayVariable>);
                            delete param.node;

                            init.dataType = dec.Declarator.left.DataType;
                            init.readonly = readonly;
                            rt.defVar(name, init);
                        } else if (dec.Declarator.right[0].type === "DirectDeclarator_modifier_Constructor") {
                            const constructorArgs = [];
                            for (const dim of dec.Declarator.right) {
                                if (dim.Expressions !== null) {
                                    for (const argumentExpression of dim.Expressions) {
                                        const resolvedArgument = yield* interp.visit(interp, argumentExpression, param);
                                        constructorArgs.push(resolvedArgument);
                                    }
                                }
                            }
                            const initClass = variables.class(type, {}, "SELF");
                            init = rt.getFuncByParams(type, "o(())", constructorArgs).target(this, initClass, ...constructorArgs);

                            init.dataType = dec.Declarator.left.DataType;
                            init.readonly = readonly;
                            rt.defVar(name, init);
                        }
                    } else {
                        if (init == null) {
                            init = rt.defaultValue(type, "SELF");
                        } else {
                            init = yield* interp.visit(interp, init.Expression);
                        }

                        init.dataType = dec.Declarator.left.DataType;
                        init.readonly = readonly;
                        rt.defVar(name, init);
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
            *StructDeclaration(interp, s, param) {
                ({ rt } = interp);

                for (const identifier of s.DeclarationIdentifiers) {
                    const structMemberList = [];
                    for (const structMember of s.StructMemberList) {
                        for (const dec of structMember.Declarators) {
                            let init = dec.Initializers;

                            param.basetype = rt.simpleType(structMember.MemberType);
                            const { name, type } = yield* interp.visit(interp, dec.Declarator, param);

                            if (init == null) {
                                init = rt.defaultValue(type, "SELF");
                            } else {
                                init = yield* interp.visit(interp, init.Expression);
                            }

                            structMemberList.push({
                                name,
                                type,
                                initialize(_rt: any, _this: any) {
                                    init.left = true;
                                    return init;
                                }
                            });
                        }
                    }

                    if (s.InitVariables) {
                        rt.raiseException("not yet implemented");
                        //const structType = rt.newStruct(`initialized_struct_${identifier}`, structMemberList);
                        //rt.defVar(identifier, rt.defaultValue(structType));
                    } else {
                        rt.raiseException("not yet implemented");
                        //rt.newStruct(identifier, structMemberList);
                    }
                }
            },
            *Initializer_expr(interp, s, param) {
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
                    iterator = rt.getFuncByParams(iterable.t, "__iterator", []).target(rt, iterable);
                } catch (ex) {
                    if (variables.asStaticArrayType(iterable.t) ?? variables.asDynamicArrayType(iterable.t) !== null) {
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
            IdentifierExpression(interp, s, _param) {
                ({ rt } = interp);

                const globalScope = rt.scope.find((scope) => scope.$name === "global");
                const currentScope = rt.scope[rt.scope.length - 1];
                const declarationScope = rt.scope.slice().reverse().find((scope, idx) => scope.$name.includes("function") && rt.scope[idx + 1].$name === "CompoundStatement") || ({ variables: {} }) as RuntimeScope;

                const varname = resolveIdentifier(s.Identifier);
                return rt.readScopedVar(currentScope, varname) || rt.readScopedVar(declarationScope, varname) || rt.readScopedVar(globalScope, varname) || rt.getFromNamespace(varname) || rt.readVar(varname);
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
                const r = rt.getFuncByParams(ret.t, rt.makeOperatorFuncName("[]"), [index.t]).target(rt, ret, index);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *PostfixExpression_MethodInvocation(interp, s, param) {
                let bindThis;
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                // console.log "==================="
                // console.log "s: " + JSON.stringify(s)
                // console.log "==================="
                const args: Variable[] = yield* (function*() {
                    const result = [];
                    for (const e of s.args) {
                        let thisArg = yield* interp.visit(interp, e, param);
                        thisArg = interp.rt.asCapturedVariable(thisArg);
                        // console.log "-------------------"
                        // console.log "e: " + JSON.stringify(e)
                        // console.log "-------------------"
                        result.push(thisArg);
                    }
                    return result;
                }).call(this);

                // console.log "==================="
                // console.log "ret: " + JSON.stringify(ret)
                // console.log "args: " + JSON.stringify(args)
                // console.log "==================="
                if (ret.v.bindThis != null) {
                    ({
                        bindThis
                    } = ret.v);
                } else {
                    bindThis = ret;
                }
                const r = rt.getFuncByParams(ret.t, rt.makeOperatorFuncName("()"), args).target(rt, ret, bindThis, ...args);
                return asResult<Variable>(r) ?? (yield* r as Gen<Variable>);
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
                    const target = rt.getOpByParams("{global}", "o(_->_)", [retc]).target(rt, retc) as Generator;
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
                    const target = rt.getOpByParams("{global}", "o(_->_)", [retc]).target(rt, retc) as Generator;
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
                const r = rt.getOpByParams(ret.t, "o(_++)", [ret]).target(rt, ret);
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
                const r = rt.getOpByParams(ret.t, "o(_--)", [ret]).target(rt, ret);
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
                const r = rt.getOpByParams(ret.t, "o(++_)", [ret]).target(rt, ret);
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
                const r = rt.getOpByParams(ret.t, "o(--_)", [ret]).target(rt, ret);
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
                debugger;
                const r = rt.getOpByParams(ret.t, `o(${s.op})` as OpSignature, [ret]).target(rt, ret);
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
                const type = yield* interp.visit(interp, s.TypeName, param);
                return rt.cast(type, ret);
            },
            TypeName(interp, s, _param) {
                ({
                    rt
                } = interp);
                const typename = [];
                for (const baseType of s.base) {
                    if (baseType !== "const") {
                        typename.push(baseType);
                    }
                }
                return rt.simpleType(typename);
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
                    const r = rt.getFuncByParams("{global}", rt.makeOperatorFuncName(op), [left, right]).target(rt, left, right);
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
                    if (directOp.target === null) {
                        rt.raiseException("Function is defined but not implemented");
                    }
                    const target = directOp.target(rt, left, right);
                    return (isGenerator(target)) ? (yield* target as Generator) : target;
                } else {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    const rhsBoolYield = rt.cast(boolType, right);
                    const lhsBool = asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>);
                    const rhsBool = asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>);
                    const boolOp = rt.getOpByParams("{global}", op, [lhsBool, rhsBool]);
                    const target = boolOp.target(rt, lhsBool, rhsBool);
                    return asResult(target) ?? (yield* target as Gen<ArithmeticVariable>);
                }
            },
            *LogicalORExpression(interp, s, param) {
                const op = "o(_&&_)";
                const left = yield* interp.visit(interp, s.left, param);
                const right = yield* interp.visit(interp, s.right, param);
                const directOp = rt.tryGetOpByParams("{global}", op, [left, right]);
                if (directOp !== null) {
                    if (directOp.target === null) {
                        rt.raiseException("Function is defined but not implemented");
                    }
                    const target = directOp.target(rt, left, right);
                    return (isGenerator(target)) ? (yield* target as Generator) : target;
                } else {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    const rhsBoolYield = rt.cast(boolType, right);
                    const lhsBool = asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>);
                    const rhsBool = asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>);
                    const boolOp = rt.getOpByParams("{global}", op, [lhsBool, rhsBool]);
                    const target = boolOp.target(rt, lhsBool, rhsBool);
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
            *ConstantExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *StringLiteralExpression(interp, s, param) {
                return yield* interp.visit(interp, s.value, param);
            },
            *StructExpression(interp, s, param) {
                ({ rt } = interp);

                const convertToObjectArray = function*(expr: any) {
                    if (expr.type === 'StructExpression') {
                        return expr.values.map((value: any) => convertToObjectArray(value.Expression).next().value);
                    } else {
                        return yield* interp.visit(interp, expr, param);
                    }
                };

                const valuesToStruct = function(arrayValues: any) {
                    const fillerStruct: any = rt.defaultValue(param.structType, null);
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
            *FloatConstant(interp, s, param) {
                ({
                    rt
                } = interp);
                const val = yield* interp.visit(interp, s.Expression, param);
                return variables.arithmetic("F32", Math.fround(val.v.value), null);
            },
            DecimalConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("U32", parseInt(s.value, 10), null);
            },
            HexConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("U32", parseInt(s.value, 16), null);
            },
            BinaryConstant(interp, s, _param) {

                ({
                    rt
                } = interp);
                return variables.arithmetic("U32", parseInt(s.value, 2), null);
            },
            DecimalFloatConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("F64", parseFloat(s.value), null);
            },
            HexFloatConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("F64", parseInt(s.value, 16), null);
            },
            OctalConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("U32", parseInt(s.value, 8), null);
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
                param = { scope: "global" };
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

    *arrayInit(dimensions: number[], init: any, type: ObjectType, param: any): ResultOrGen<StaticArrayVariable> {
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
                            arr[i] = {
                                type: "Initializer_expr",
                                shorthand: this.rt.defaultValue(type, null)
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
                                arr[i] = {
                                    type: "Initializer_expr",
                                    shorthand: this.rt.defaultValue(type, null)
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
                            arr[i] = {
                                type: "Initializer_expr",
                                shorthand: this.rt.defaultValue(type, null)
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
                    const arrayInitializer: StaticArrayVariable | DynamicArrayVariable | null = variables.asStaticArray(initializer) ?? variables.asDynamicArray(initializer);
                    if (arrayInitializer !== null && variables.typesEqual(type, arrayInitializer.t.object)) {
                        init = {
                            type: "Initializer_array",
                            Initializers: arrayInitializer.v.values.map(e => ({
                                type: "Initializer_expr",
                                shorthand: e
                            }))
                        };
                    } else {
                        this.rt.raiseException("cannot initialize an array to (TBD)"/* + this.rt.makeValString(initializer)*/, param.node);
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
            let initval;
            if (init) {
                if ("shorthand" in init) {
                    initval = init.shorthand;
                } else {
                    initval = yield* this.visit(this, init.Expression, param);
                }
            } else {
                initval = this.rt.defaultValue(type, null);
            }
            this.rt.raiseException("Not yet implemented");
            //return initval;
        }
    };

    buildRecursivePointerType(pointer: any, basetype: ObjectType, level: number): ObjectType {
        if (pointer && (pointer.length > level)) {
            const type = variables.pointerType(basetype);
            return this.buildRecursivePointerType(pointer, type, level + 1);
        } else {
            return basetype;
        }
    };
}

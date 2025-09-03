import { constructTypeParser, LLParser, parse } from './typecheck';
import * as interp from "./interpreter";
import { AnyType, ArithmeticSig, ArithmeticType, ArithmeticValue, ArithmeticVariable, CFunction, ClassType, ClassVariable, Function, FunctionType, Gen, InitArithmeticVariable, InitClassVariable, InitIndexPointerVariable, InitPointerVariable, InitVariable, LValueHolder, LValueIndexHolder, MaybeLeft, MaybeLeftCV, MaybeUnboundArithmeticVariable, MaybeUnboundVariable, ObjectType, PointeeVariable, PointerType, PointerVariable, ResultOrGen, Variable, variables } from "./variables";
import { TypeDB, FunctionMatchResult, abstractFunctionReturnSig } from "./typedb";
import { fromUtf8CharArray, toUtf8CharArray } from "./utf8";
import { sizeUntil } from './shared/string_utils';
import * as typecheck from './typecheck';
import * as ios_base from './shared/ios_base';
import { InitializerListVariable } from './initializer_list';
export type Specifier = "const" | "inline" | "_stdcall" | "extern" | "static" | "auto" | "register";

export interface IncludeModule {
    load(rt: CRuntime): void;
}

export interface Stdio {
    isMochaTest?: boolean;
    promiseError: (promise_error: Error) => void;
    drain?: () => string;
    cinStop: () => void;
    cinProceed: () => void;
    cinState: () => boolean;
    setReadResult: (result: string) => void;
    getReadResult: () => string;
    getInput: () => Promise<string>;
    finishCallback: (ExitCode: number) => void;
    write: (s: string) => void;
}

export interface JSCPPConfig {
    specifiers?: Specifier[];
    arithmeticResolutionMap?: { [x: string]: ArithmeticSig };
    includes?: { [fileName: string]: IncludeModule };
    loadedLibraries: string[];
    fstream?: {
        open: (context: any, fileName: string) => FileInstance;
    };
    stdio?: Stdio;
    unsigned_overflow?: "error" | "warn" | "ignore";

    debug?: boolean;
    maxExecutionSteps?: number;
    maxTimeout?: number;
    eventLoopSteps?: number;
    stopExecutionCheck?: () => boolean;
}

export class CRuntimeError extends Error {
    line: number | null;
    column: number | null;

    constructor(name: string, line: number | null, column: number | null) {
        super(name);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CRuntimeError);
        }
        this.name = "CRuntimeError";
        this.line = line;
        this.column = column;
        Object.setPrototypeOf(this, CRuntimeError.prototype)
    }
}

export type OpSignature = "o(_--)" | "o(--_)" | "o(_-_)" | "o(-_)" | "o(_-=_)" | "o(_->_)" | "o(_,_)" | "o(!_)" | "o(_!=_)" | "o(_[_])" | "o(*_)" | "o(_*_)" | "o(_*=_)" | "o(_/_)" | "o(_/=_)" | "o(_&_)" | "o(&_)" | "o(_&=_)" | "o(_%_)" | "o(_%=_)" | "o(_^_)" | "o(_^=_)" | "o(_+_)" | "o(+_)" | "o(_++)" | "o(++_)" | "o(_+=_)" | "o(_<_)" | "o(_<<_)" | "o(_<<=_)" | "o(_<=_)" | "o(_=_)" | "o(_==_)" | "o(_>_)" | "o(_>=_)" | "o(_>>_)" | "o(_>>=_)" | "o(_|_)" | "o(_|=_)" | "o(~_)" | "o(_&&_)" | "o(_||_)" | "o(_bool)" | "o(_ctor)" | "o(_call)" | "o(_stub)";

export interface Member {
    type: ObjectType;
    name: string;
    initialize?: (rt: CRuntime, _this: Variable) => Variable;
}

export interface RuntimeScope {
    "$name": string;
    variables: {
        [name: string]: Variable;
    };
}

export interface NamespaceScope {
    [namespace: string]: {
        [objectName: string]: Variable;
    };
}

export interface MakeValueStringOptions {
    noArray?: boolean;
    noPointer?: boolean;
}

export function mergeConfig(a: any, b: any) {
    for (const o in b) {
        if (b.hasOwnProperty(o)) {
            if (o in a && (typeof b[o] === "object")) {
                mergeConfig(a[o], b[o]);
            } else {
                a[o] = b[o];
            }
        }
    }
};

export interface FunctionSymbol {
    type: string[],
    target: CFunction | null,
}

export type TypeHandlerMap = {
    functionDB: TypeDB;
    functionsByID: FunctionSymbol[];
    memberObjectListCreator: MemberObjectListCreator;
    dataMemberNames: string[]
};

export type TypeSignature = {
    inline: string,
    array: string[],
};

export type FileInstance = {
    name: string;
    _open: boolean;
    is_open: () => boolean;
    read: (data: string) => string | void;
    clear: () => void;
    write: (data: string) => void;
    close: () => void;
};


export type FileManager = { freefd: number, files: { [fd: number]: FileInstance } };

export type FunctionCallInstance = {
    actions: FunctionMatchResult,
    target: FunctionSymbol,
};

export type MemberObject = {
    name: string,
    variable: Variable
};

export type MemberObjectListCreator = {
    numTemplateArgs: number,
    factory: (...templateArgs: ObjectType[]) => ResultOrGen<MemberObject[]>
};

export class CRuntime {
    parser: LLParser;
    config: JSCPPConfig;
    scope: RuntimeScope[];
    namespace: NamespaceScope;
    typeMap: { [domainIdentifier: string]: TypeHandlerMap };
    typedefs: { [name: string]: MaybeLeft<ObjectType> };
    interp: interp.BaseInterpreter<any>;
    fileio: FileManager;
    ct: typecheck.ConversionTables;
    explicitListInitTable: { [name: string]: ((type: ObjectType) => ObjectType) };

    constructor(config: JSCPPConfig) {
        this.parser = constructTypeParser();
        this.config = config;
        this.typeMap = {};
        this.addTypeDomain("{global}", { numTemplateArgs: 0, factory: () => [] }, []);
        this.fileio = { freefd: 4, files: {} };

        this.scope = [{ "$name": "{global}", variables: {} }];
        this.namespace = {};
        this.typedefs = {};
        this.ct = { implicit: {}, list: {} };
        this.explicitListInitTable = {};
    }

    openFile(path: InitIndexPointerVariable<ArithmeticVariable>, mode: number): number {
        const { fstream } = this.config;
        if (fstream === undefined) {
            this.raiseException("[CRuntime].config.fstream is undefined");
        }
        const fileName = this.getStringFromCharArray(path);
        const fileInst = fstream.open({ t: { name: "ofstream" } }, fileName);
        if (((mode & ios_base.openmode.out) !== 0 && (mode & ios_base.openmode.app) === 0) || (mode & ios_base.openmode.trunc) !== 0) {
            fileInst.clear();
        }
        this.fileio.files[this.fileio.freefd] = fileInst;
        return fileInst.is_open() ? this.fileio.freefd++ : -1;
    }

    fileRead(fd: InitArithmeticVariable): InitIndexPointerVariable<ArithmeticVariable> {
        const fileInst = this.fileio.files[fd.v.value] ?? this.raiseException("Invalid file descriptor");
        const readData = fileInst.read("");
        if (readData === undefined) {
            this.raiseException("File read failed unexpectedly")
        }
        return this.getCharArrayFromString(readData);
    }

    fileClose(fd: InitArithmeticVariable): void {
        const fileInst = this.fileio.files[fd.v.value] ?? this.raiseException("Invalid file descriptor");
        fileInst.close();
    }

    fileWrite(fd: InitArithmeticVariable, data: InitIndexPointerVariable<ArithmeticVariable>): void {
        const fileInst = this.fileio.files[fd.v.value] ?? this.raiseException("Invalid file descriptor");
        fileInst.write(this.getStringFromCharArray(data, sizeUntil(this, data, variables.arithmetic("I8", 0, null))))
    }

    addTypeDomain(domain: string, memberList: MemberObjectListCreator, dataMemberNames: string[]) {
        if (domain in this.typeMap) {
            this.raiseException(`Domain ${domain} already exists`);
        }
        this.typeMap[domain] = {
            functionDB: new TypeDB(this.parser),
            functionsByID: [],
            memberObjectListCreator: memberList,
            dataMemberNames,
        };
    }

    include(name: string) {
        if (this.config.includes === undefined) {
            this.raiseException("[CRuntime].config.includes is undefined");
        }
        const {
            includes
        } = this.config;
        if (name in includes) {
            // const lib = includes[name];
            if (this.config.loadedLibraries.includes(name))
                return;
            this.config.loadedLibraries.push(name);
            // lib.load(this);
        } else {
            this.raiseException("cannot find library: " + name);
        }
    };

    getSizeByType(t: AnyType): number {
        let at: ArithmeticType | null;
        let pt: PointerType<ObjectType | FunctionType> | null;
        if ((pt = variables.asPointerType(t)) !== null) {
            if (pt.sizeConstraint !== null) {
                return this.getSizeByType(pt.pointee) * pt.sizeConstraint;
            }
            this.raiseException("Not yet implemented");
        } else if ((at = variables.asArithmeticType(t)) !== null) {
            return variables.arithmeticProperties[at.sig].bytes;
        }
        this.raiseException("Not yet implemented");
    };

    getMember(l: Variable, identifier: string): Variable {
        //l = this.asCapturedVariable(l);
        let lc = variables.asClass(l);
        if (lc !== null) {
            if (!lc.v.lvHolder === null) {
                this.raiseException("Access to a member of a non-lvalue variable is forbidden");
            }
            if (lc.v.state !== "INIT") {
                this.raiseException("Access to an unbounded index member")
            }
            const domainName: string = this.domainString(lc.t);
            if (domainName in this.typeMap) {
                if (identifier in lc.v.members) {
                    return lc.v.members[identifier];
                } else {
                    this.raiseException(`type '${this.makeTypeString(lc.t)}' does not have a member called '${identifier}'`);
                }
            } else {
                this.raiseException(`type '${this.makeTypeString(lc.t)}' is unknown`);
            }
        } else {
            this.raiseException("only a class or struct can have members");
        }
    };

    stdio(): Stdio {
        if (this.config.stdio === undefined) {
            this.raiseException("[CRuntime].config.stdio is undefined");
        }
        return this.config.stdio;
    }

    arrayTypeSignature(array: string[]): TypeSignature {
        const inline: string = array.join(" ");
        if (!parse(this.parser, array)) {
            this.raiseException(`Malformed type signature: '${inline}'`)
        }
        return { inline, array };
    };

    typeSignature(inline: string): TypeSignature {
        const array: string[] = inline.split(" ");
        if (!parse(this.parser, array)) {
            this.raiseException(`Malformed type signature: '${inline}'`)
        }
        return { inline, array };
    };

    typeSignatureUnchecked(array: string[]): TypeSignature {
        return { inline: array.join(" "), array };
    };

    /** This function is only used when defining a function with an exact type, typically at runtime. For matching, use TypeDB-associated functions */
    createFunctionTypeSignature(domain: ClassType | "{global}", retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[], noThis = false): TypeSignature {
        const thisSig: string[] = (domain === "{global}" || noThis) ? [] : variables.toStringSequence(this, domain, true, false);
        const returnSig: string[] = retType === "VOID" ? [retType] : variables.toStringSequence(this, retType.t, retType.v.lvHolder !== null, false);
        const argTypeSig: string[][] = argTypes.map((x) => variables.toStringSequence(this, x.t, x.v.lvHolder !== null, x.v.isConst));
        const result: string[] = [[["FUNCTION"], returnSig, ["("], thisSig], argTypeSig, [[")"]]].flat(2);
        return this.arrayTypeSignature(result);
    }

    defFunc(domain: ClassType | "{global}", name: string, retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[], argNames: string[], optionalArgs: MemberObject[], stmts: interp.XCompoundStatement | null, interp: interp.Interpreter): void {
        while (true) {
            let f: CFunction | null = null;
            const _optionalArgs = [...optionalArgs]; // cloned array passed to a closure
            if (stmts != null) {
                f = function*(rt: CRuntime, templateArgs: ObjectType[], ...args: Variable[]) {
                    if (templateArgs.length > 1) {
                        rt.raiseException("Not yet implemented");
                    }
                    // logger.warn("calling function: %j", name);
                    rt.enterScope("function " + name);
                    if (args.length + _optionalArgs.length !== argTypes.length) {
                        rt.raiseException(`Expected ${argTypes.length} arguments, got ${args.length}`)
                    }
                    argNames.slice(0, args.length).forEach(function(argName, i) {
                        if (argTypes[i].v.lvHolder === null) {
                            args[i] = variables.clone(rt, args[i], "SELF", false);
                        }
                        if (args[i].v.isConst && !argTypes[i].v.isConst) {
                            rt.raiseException("Cannot pass a const-value where a volatile value is required")
                        } else if (!args[i].v.isConst && argTypes[i].v.isConst) {
                            args[i] = variables.clone(rt, args[i], args[i].v.lvHolder, false);
                            (args[i].v as any).isConst = true;
                        }
                        rt.defVar(argName, args[i]);
                    });
                    for (const optarg of _optionalArgs) {
                        rt.defVar(optarg.name, variables.clone(rt, optarg.variable, "SELF", false));
                    }
                    let ret = yield* interp.run(stmts, interp.source, { scope: "function" });
                    if (retType === "VOID") {
                        if (Array.isArray(ret)) {
                            if ((ret[0] === "return") && ret[1]) {
                                rt.raiseException("void function cannot return a value");
                            }
                        }
                        ret = "VOID";
                    } else {
                        if (ret instanceof Array && (ret[0] === "return")) {
                            ret = rt.cast(retType.t, ret[1]);
                        } else if (name === "main") {
                            ret = variables.arithmetic("I32", 0, null);
                        } else {
                            rt.raiseException("non-void function must return a value");
                        }
                    }
                    rt.exitScope("function " + name);
                    // logger.warn("function: returning %j", ret);
                    return ret;
                };
            }
            const fnsig = this.createFunctionTypeSignature(domain, retType, argTypes);
            this.regFunc(f, domain, name, fnsig, []);
            if (optionalArgs.length === 0) {
                return;
            }
            argTypes.push(optionalArgs[0].variable);
            argNames.push(optionalArgs[0].name);
            optionalArgs = optionalArgs.slice(1);
        }
    };

    /** Convenience function for static type checking of operators */
    getOpByParams(domain: "{global}", identifier: OpSignature, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance {
        return this.getFuncByParams(domain, identifier, params, templateTypes);
    }

    tryGetOpByParams(domain: "{global}", identifier: OpSignature, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance | null {
        return this.tryGetFuncByParams(domain, identifier, params, templateTypes);
    }

    getFuncByParams(domain: ClassType | "{global}", identifier: string, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance {
        const fn = this.tryGetFuncByParams(domain, identifier, params, templateTypes);
        if (fn === null) {
            const domainSig: string = this.domainString(domain);
            if (!(domainSig in this.typeMap)) {
                this.raiseException(`domain '${domainSig}' is unknown`);
            }
            const domainMap: TypeHandlerMap = this.typeMap[domainSig];
            const prettyPrintParams = "(" + params.map((x) => this.makeTypeString(x.t, x.v.lvHolder !== null, x.v.isConst)).join(", ") + ")";
            const overloads = domainMap.functionDB.functions[identifier];
            const overloadsMsg = (overloads !== undefined)
                ? "Available overloads: \n" + overloads.overloads.map((x, i) => `${i + 1}) ${x.annotation}`).join("\n")
                : "No available overloads";
            this.raiseException(`No matching function '${domainSig === "{global}" ? "" : `${domainSig}::`}${identifier}${prettyPrintParams}'\n${overloadsMsg}`);
        }
        return fn;
    };

    tryGetFuncByParams(domain: ClassType | "{global}", identifier: string, params: MaybeLeftCV<ObjectType>[], templateTypes: (string | string[])[]): FunctionCallInstance | null {
        if (identifier.startsWith("std::")) {
            identifier = identifier.substr(5);
        }
        const domainSig: string = this.domainString(domain);
        if (!(domainSig in this.typeMap)) {
            this.raiseException(`domain '${domainSig}' is unknown`);
        }
        const paramSig = params.map((x) => variables.toStringSequence(this, x.t, x.v.lvHolder !== null, x.v.isConst));
        //console.log(`getfunc: '${domainSig}::${identifier}( ${paramSig.flat().join(" ")} )'`);
        const domainMap: TypeHandlerMap = this.typeMap[domainSig];
        const fn = domainMap.functionDB.matchFunctionByParams(this, identifier, paramSig, templateTypes, this.ct);
        if (fn === null) {
            return null;
        }
        return { actions: fn, target: domainMap.functionsByID[fn.fnid] };
    };

    *convertParams(actions: typecheck.ParseFunctionMatchInnerResult, templateArgs: ObjectType[], args: Variable[]): Gen<void> {
        for (const castAction of actions.castActions) {
            switch (castAction.cast.type) {
                case "ARITHMETIC":
                    {
                        const castYield = this.cast(variables.arithmeticType(castAction.cast.targetSig), this.expectValue(args[castAction.index]));
                        args[castAction.index] = interp.asResult(castYield) ?? (yield* castYield as Gen<InitVariable>);
                    }
                    break;
                case "CTOR":
                    {
                        const fnid = this.typeMap[castAction.cast.domain].functionDB.matchExactOverload("o(_ctor)", castAction.cast.fnsig);
                        if (fnid === -1) {
                            this.raiseException("Implicit cast via constructor: Failed to cast (expected a match)");
                        }
                        const fncall = this.typeMap[castAction.cast.domain].functionsByID[fnid];
                        if (fncall.target === null) {
                            this.raiseException("Implicit cast via constructor: Constructor is defined but no implementation is found");
                        }
                        if (templateArgs.length > 0) {
                            this.raiseException("Implicit cast via constructor: Not yet implemented")
                        }
                        const castYield = fncall.target(this, [], args[castAction.index]);
                        const castResult = interp.asResult(castYield) ?? (yield* castYield as Gen<InitVariable>);
                        if (castResult === "VOID") {
                            this.raiseException("Implicit cast via constructor: Expected a non-void result");
                        }
                        args[castAction.index] = this.unbound(castResult);
                    }
                    break;
                case "FNPTR":
                    args[castAction.index] = variables.directPointer(args[castAction.index], "SELF", false);
                    break;
                case "LIST":
                    if (args[castAction.index].t.sig !== "CLASS" || (args[castAction.index] as ClassVariable).t.identifier !== typecheck.prototypeListSpecifier) {
                        this.raiseException(`Implicit object from list construction: expected a list object, got ${this.makeTypeStringOfVar(args[castAction.index])}`);
                    } else {
                        const arg = args[castAction.index] as ClassVariable;
                        let listArgs: Variable[] = [];
                        for (let i = 0; i < arg.t.templateSpec.length; i++) {
                            if (!(i.toString() in arg.v.members)) {
                                this.raiseException(`Implicit object from list construction: Argument '${i.toString()}' is missing`);
                            }
                            listArgs.push(arg.v.members[i.toString()]);
                        }
                        yield* this.convertParams(castAction.cast.ops, [], listArgs);
                        if (castAction.cast.isInitList) {
                            if (listArgs.length === 0) {
                                this.raiseException("Implicit object from list construction: Not yet implemented");
                            }
                            const childType: ObjectType = listArgs[0].t;
                            const memory = variables.arrayMemory<Variable>(childType, []);
                            let i = 0;
                            for (const child of listArgs) {
                                memory.values.push({
                                    lvHolder: { array: memory, index: i },
                                    ...child.v
                                });
                                i++;
                            }
                            const initList: InitializerListVariable<Variable> = {
                                t: {
                                    sig: "CLASS",
                                    memberOf: null,
                                    templateSpec: [childType],
                                    identifier: "initializer_list"
                                },
                                v: {
                                    isConst: false,
                                    lvHolder: null,
                                    state: "INIT",
                                    members: {
                                        _values: variables.indexPointer(memory, 0, false, null)
                                    }
                                }
                            };
                            args[castAction.index] = initList;
                        } else {
                            const constructedType = typecheck.parseToObjectType(this.parser, castAction.cast.targetSig) ?? this.raiseException(`Implicit object from list construction: Failed to constructed an object from type '${typecheck.parsePrint(this.parser, castAction.cast.targetSig, null)}'`);
                            const constructedClassType = variables.asClassType(constructedType);
                            if (constructedClassType !== null) {
                                if (!(constructedClassType.identifier in this.typeMap)) {
                                    this.raiseException(`Implicit object from list construction: Unknown class '${constructedClassType.identifier}'`);
                                }
                                const dataMemberNames = this.typeMap[constructedClassType.identifier].dataMemberNames;
                                if (dataMemberNames.length < listArgs.length) {
                                    this.raiseException(`Implicit object from list construction: Expected at most ${dataMemberNames.length} data members for class '${constructedClassType.identifier}', received ${listArgs.length}`);
                                }
                                let members: {[name: string]: Variable } = {};
                                for (let i = 0; i < listArgs.length; i++) {
                                    members[dataMemberNames[i]] = listArgs[i];
                                }
                                const classVariable : ClassVariable = {
                                    t: constructedClassType,
                                    v: {
                                        isConst: false,
                                        lvHolder: null,
                                        state: "INIT",
                                        members
                                    }
                                }
                                args[castAction.index] = classVariable;
                            } else {
                                this.raiseException("Implicit object from list construction: Not yet implemented");
                            }
                        }
                    }
                    break;
            }
        }
        actions.valueActions.forEach((action, i) => {
            if (action === "CLONE") {
                args[i] = variables.clone(this, this.expectValue(args[i]), "SELF", false);
            }
        })
    }

    *invokeCallFromVariable(funvar: Function, ...args: Variable[]): ResultOrGen<MaybeUnboundVariable | "VOID"> {
        const paramSig = args.map((x) => variables.toStringSequence(this, x.t, x.v.lvHolder !== null, x.v.isConst));
        const targetSig: string[] = ["FUNCTION", "Return", "("].concat(...paramSig).concat(")");
        //console.log(`getfunc: '${funvar.v.name}( ${paramSig.flat().join(" ")} )'`);
        const funmatch = typecheck.parseFunctionMatch(this.parser, targetSig, abstractFunctionReturnSig(funvar.t.fulltype), this.ct, []);
        if (funmatch === null) {
            this.raiseException("Invalid arguments"); // TODO: make message more comprehensive
        }
        if (funvar.v.target === null) {
            this.raiseException("Function is defined but no implementation is found");
        }
        yield* this.convertParams(funmatch, [], args);
        // function pointers can only point to a single untemplated instance
        const returnYield = funvar.v.target(this, [], ...args);
        return interp.asResult(returnYield) ?? (yield* returnYield as Gen<MaybeUnboundVariable | "VOID">);

    }

    *invokeCall(callInst: FunctionCallInstance, templateArgs: ObjectType[], ...args: Variable[]): ResultOrGen<MaybeUnboundVariable | "VOID"> {
        if (callInst.target.target === null) {
            this.raiseException("Function is defined but no implementation is found");
        }
        yield* this.convertParams(callInst.actions, templateArgs, args);
        const returnYield = callInst.target.target(this, templateArgs, ...args);
        return interp.asResult(returnYield) ?? (yield* returnYield as Gen<MaybeUnboundVariable | "VOID">);
    }

    makeBinaryOperatorFuncName = (name: string) => `o(_${name}_)`;
    makePrefixOperatorFuncName = (name: string) => `o(${name}_)`;
    makePostfixOperatorFuncName = (name: string) => `o(_${name})`;

    domainString(domain: ClassType | "{global}"): string {
        if (domain === "{global}") {
            return domain;
        }
        let seq: string[] = [domain.identifier];
        let sub: ClassType = domain;
        while (sub.memberOf !== null) {
            seq.push(sub.memberOf.identifier);
            sub = sub.memberOf;
        }
        return seq.reverse().join(".");
    }

    regFunc(f: CFunction | null, domain: ClassType | "{global}", name: string, fnsig: TypeSignature, templateTypes: number[]): void {
        const domainInlineSig: string = this.domainString(domain);
        if (!(domainInlineSig in this.typeMap)) {
            this.raiseException(`type '${fnsig.inline}' is unknown`);
        }
        const domainMap: TypeHandlerMap = this.typeMap[domainInlineSig];
        //console.log(`regfunc: '${fnsig.inline}'`);

        const existingOverloadId = domainMap.functionDB.matchExactOverload(name, fnsig.inline);
        if (existingOverloadId !== -1) {
            const overload = domainMap.functionsByID[existingOverloadId];
            if (overload.target === null) {
                if (f === null) {
                    this.raiseException(`Redefinition of a function prototype '${domainInlineSig}::${name}'`);
                }
                overload.target = f;
            } else {
                this.raiseException(`Reimplementation of function '${domainInlineSig}::${name}' of type '${fnsig.inline}'.`)
            }
        } else {
            if (this.varAlreadyDefined(name)) {
                if (!(domain === "{global}" && name in this.scope[0].variables && variables.asFunction(this.scope[0].variables[name]) !== null)) {
                    if (domain === "{global}" && name in this.scope[0].variables) {
                        this.raiseException(`Global function '${name}' is already declared as a non-function variable of type ${this.makeTypeStringOfVar(this.scope[0].variables[name])}.`)
                    } else {
                        this.raiseException(`Redeclaration of '${domainInlineSig}::${name}' (overloading member functions is not yet implemented)`)
                    }
                }
            }
            domainMap.functionDB.addFunctionOverload(this, name, fnsig.array, templateTypes, domainMap.functionsByID.length);
            domainMap.functionsByID.push({ type: fnsig.array, target: f });
            if (name === "o(_ctor)" && domain !== "{global}") {
                const dstTypeInline = variables.toStringSequence(this, domain, false, false).join(" ");
                if (!(dstTypeInline in this.ct.implicit)) {
                    this.ct.implicit[dstTypeInline] = {};
                }
                const srcArgStart = fnsig.inline.indexOf("(") + 2;
                const srcTypeInline = fnsig.inline.substr(srcArgStart, fnsig.inline.length - srcArgStart - 2);
                const abstractSig = abstractFunctionReturnSig(fnsig.array).join(" ");
                this.ct.implicit[dstTypeInline][srcTypeInline] = { fnsig: abstractSig, domain: domainInlineSig };
            }
        }
    };

    registerTypedef(basttype: MaybeLeft<ObjectType>, name: string) {
        this.typedefs[name] = basttype;
    };

    promoteNumeric(l: ArithmeticType, r: ArithmeticType): ArithmeticType {
        const lProperties = variables.arithmeticProperties[l.sig];
        const rProperties = variables.arithmeticProperties[r.sig];
        if (variables.arithmeticTypesEqual(l, r)) {
            if (l.sig === "BOOL") {
                return variables.arithmeticType("I32");
            }
            if (l.sig === "I8") {
                return variables.arithmeticType("I32");
            }
            if (l.sig === "U8") {
                return variables.arithmeticType("U32");
            }
            return l;
        } else if (!lProperties.isFloat && !rProperties.isFloat) {
            const sl = variables.arithmeticType(lProperties.asSigned);
            const sr = variables.arithmeticType(rProperties.asSigned);
            if (variables.arithmeticTypesEqual(sl, sr)) {
                return sl;
            } else {
                if (lProperties.bytes <= rProperties.bytes) {
                    return (!lProperties.isSigned && !rProperties.isSigned) ? r : sr;
                } else {
                    return (!lProperties.isSigned && !rProperties.isSigned) ? l : sl;
                }
            }
        } else if (lProperties.isFloat && !rProperties.isFloat) {
            return l;
        } else if (!lProperties.isFloat && rProperties.isFloat) {
            return r;
        } else {
            return variables.arithmeticType("F64");
        }
    };

    readScopedVar(scope: RuntimeScope, varname: string) {
        return this.resolveNamespacePath(scope.variables, varname);
    };

    readVarOrFunc(varname: string): Variable | Function {
        const rvar = this.tryReadVar(varname);
        if (rvar !== null) {
            return rvar;
        }
        const fnid = this.typeMap["{global}"].functionDB.matchSingleFunction(this, varname);
        if (fnid !== -1) {
            const fninfo = this.typeMap["{global}"].functionsByID[fnid];
            return variables.function(fninfo.type, varname, fninfo.target, null, "SELF");
        }
        this.raiseException("variable '" + varname + "' does not exist");
    };

    tryReadVar(varname: string): Variable | null {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (varname in vc.variables) {
                return vc.variables[varname];
            }
            i--;
        }
        return null;
    };

    deleteVar(varname: string): void {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (vc.variables[varname] != null) {
                delete vc.variables[varname];
                return;
            }
            i--;
        }
        this.raiseException("variable '" + varname + "' does not exist");
    };

    varAlreadyDefined(varname: string): boolean {
        // NOTE: This is not how it's supposed to work.
        // TODO: fix this
        let i = this.scope.length - 1;
        //while (i >= 0) {
        const vc = this.scope[i];
        if (varname in vc.variables) {
            return true;
        }
        //    i--;
        //}
        return false;
    };

    simpleType(_type: (string | interp.XScopedIdentifier | interp.XScopedMaybeTemplatedIdentifier)[]): MaybeLeft<ObjectType> | "VOID" {
        type SimpleTypeNode = {
            name: string,
            templateSpec: SimpleTypeNode[][] | null;
        };
        function makeSimplifiedTypeNotation(type: (string | interp.XScopedIdentifier | interp.XScopedMaybeTemplatedIdentifier)[]): SimpleTypeNode[] {
            return type.flatMap<SimpleTypeNode>(x => {
                if (typeof x === "string") {
                    return (["const", "auto"].includes(x)) ? [] : { name: x, templateSpec: null };
                } else if (x.type === "ScopedIdentifier") {
                    return { name: x.Identifier, templateSpec: null }
                } else {
                    return {
                        name: (typeof x.ScopedIdentifier === "string") ? x.ScopedIdentifier : x.ScopedIdentifier.Identifier,
                        templateSpec: x.TemplateType !== null ? x.TemplateType.map(makeSimplifiedTypeNotation) : null
                    };
                }
            });
        }
        function printTypeSpec(type: SimpleTypeNode[]): string {
            return type.map(x => x.name + (x.templateSpec === null ? "" : ("<" + x.templateSpec.map(printTypeSpec).join(", ") + ">"))).join(" ");
        }
        function makeSimpleType(rt: CRuntime, typeArr: SimpleTypeNode[]): MaybeLeft<ObjectType> | "VOID" {
            if (typeArr.every(x => x.templateSpec === null)) {
                let typeStr = typeArr.map(x => x.name).join(" ");
                if (typeStr in variables.defaultArithmeticResolutionMap) {
                    return { t: { sig: variables.defaultArithmeticResolutionMap[typeStr] }, v: { lvHolder: null } };
                }
                if (typeStr === "void") {
                    return "VOID";
                }
            }
            if (typeArr.length === 1) {
                const type = typeArr[0];
                if (type.name in rt.typeMap) {
                    const fn = rt.typeMap[type.name].functionDB.matchExactOverload("o(_stub)", "FUNCTION Return ( )");

                    if (fn !== null) {
                        const templateSpec = type.templateSpec === null ? [] : type.templateSpec.map(x => {
                            let a = makeSimpleType(rt, x);
                            if (a === "VOID") {
                                rt.raiseException("Type lookup: void types inside template specifiers are not supported");
                            }
                            return a.t;
                        });
                        return { t: variables.classType(type.name, templateSpec, null), v: { lvHolder: null } }
                    } else {
                        rt.raiseException("Type lookup: No constructor for the specified structure");
                    }
                }
                if (type.name in rt.typedefs) {
                    return rt.typedefs[type.name];
                }
            }
            rt.raiseException(`Type lookup: Unknown type '${printTypeSpec(typeArr)}'`);
        }
        if (_type instanceof Array) {
            return makeSimpleType(this, makeSimplifiedTypeNotation(_type));
        }
        this.raiseException("Type lookup: Invalid argument (internal erro)");
    };

    defVar(varname: string, object: Variable, allowRedefine: boolean = false) {
        if (!allowRedefine && this.varAlreadyDefined(varname)) {
            this.raiseException("Variable '" + varname + "' already defined");
        }

        const vc = this.scope[this.scope.length - 1];

        //console.log(`defining variable: '${varname}' of type '${this.makeTypeStringOfVar(object)}'`);

        if (object.v.lvHolder === null) {
            //@ts-ignore
            object.v.lvHolder = "SELF";
        }

        vc.variables[varname] = object;
    };

    inrange(x: number, t: ArithmeticType, onError?: () => string) {
        const properties = variables.arithmeticProperties[t.sig];
        const overflow = !((x <= properties.maxv) && (x >= properties.minv));
        if (onError && overflow) {
            const errorMsg = onError();
            if (properties.isSigned === false) {
                if (this.config.unsigned_overflow === "error") {
                    console.error(errorMsg);
                    this.raiseException(errorMsg);
                } else if (this.config.unsigned_overflow === "warn") {
                    console.error(errorMsg);
                }
                return true;
            } else {
                this.raiseException(errorMsg);
            }
        }
        return !overflow;
    };

    castable(type1: ObjectType, type2: ObjectType) {
        // TODO: unweird this function
        if (variables.typesEqual(type1, type2)) {
            return true;
        }
        let ptr1: PointerType<ObjectType | FunctionType> | null;
        let ptr2: PointerType<ObjectType | FunctionType> | null;
        let class1: ClassType | null;
        let class2: ClassType | null;
        if (variables.asArithmeticType(type1) !== null && variables.asArithmeticType(type2) !== null) {
            return true;
        } else if ((ptr1 = variables.asPointerType(type1)) !== null && (ptr2 = variables.asPointerType(type2)) !== null) {
            if (variables.asFunctionType(ptr1.pointee) !== null) {
                return variables.asFunctionType(ptr2.pointee) !== null;
            }
            return !variables.asFunctionType(ptr2.pointee); // ???
        } else if ((class1 = variables.asClassType(type1)) !== null && (class2 = variables.asClassType(type2)) !== null) {
            return false;
        } else if (variables.asClassType(type1) || variables.asClassType(type2)) {
            this.raiseException("not implemented");
        }
        this.raiseException("not implemented");
    };

    makeTypeStringOfVar(object: MaybeLeftCV<ObjectType>): string {
        return this.makeTypeString(object.t, !(object.v.lvHolder !== null), object.v.isConst);
    }

    makeTypeString(type: AnyType, isLValue: boolean = false, isConst: boolean = false): string {
        const inner = (t: AnyType) => this.makeTypeString(t, false, false);
        const branch: { [sig in string]: () => string } = {
            "ARITHMETIC": () => {
                const x = type as ArithmeticType;
                return variables.arithmeticProperties[x.sig].name;
            },
            "VOID": () => {
                return "void";
            },
            "PTR": () => {
                const x = type as PointerType<ObjectType | FunctionType>;
                if (x.sizeConstraint !== null) {
                    return inner(x.pointee) + "[" + String(x.sizeConstraint) + "]";
                } else {
                    return inner(x.pointee) + "*";
                }
            },
            "CLASS": () => {
                const x = type as ClassType;
                return (x.memberOf ? inner(x.memberOf) + "::" : "") + x.identifier + ((x.templateSpec.length === 0) ? "" : "<" + x.templateSpec.map(inner).join(", ") + ">");
            },
            "FUNCTION": () => {
                const x = type as FunctionType;
                return "{" + x.fulltype.join(" ") + "}";
            },
        }
        const where = (type.sig in variables.arithmeticSig) ? "ARITHMETIC" : type.sig;
        return [isConst ? "const " : "", branch[where](), isLValue ? "&" : ""].join("");
    }

    /** For integers, performs a two's-complement integer overflow on demand.
      * > Does not really depend on signedness, just on limits set by basic arithmetic types. 
      * For floating-point values, rounds to the nearest precision available.*/
    adjustArithmeticValue(x: InitArithmeticVariable): void {
        const info = variables.arithmeticProperties[x.t.sig];
        if (!info.isFloat && !Number.isInteger(x.v.value)) {
            x.v.value = Math.sign(x.v.value) * Math.floor(Math.abs(x.v.value));
        }
        if (info.isFloat || (x.v.value >= info.minv && x.v.value <= info.maxv)) {
            if (x.t.sig === "F32") {
                // javascript numbers are typically double-precision FP values.
                x.v.value = Math.fround(x.v.value);
            }
            return;
        }
        let q: number = (x.v.value - info.minv) % (info.maxv + 1 - info.minv);
        if (q < 0) {
            q += info.maxv + 1 - info.minv;
        }
        x.v.value = q + info.minv;
    }

    makeValueString(v: Variable | Function, options: MakeValueStringOptions = {}): string {
        if (v.v.state === "UNINIT") {
            return "<uninitialised>";
        }
        const arithmeticVar = variables.asArithmetic(v) as InitArithmeticVariable | null;
        if (arithmeticVar !== null) {
            const val = arithmeticVar.v.value;
            const sig = arithmeticVar.t.sig;
            const properties = variables.arithmeticProperties[sig];
            if (sig === "I8") {
                // 31 /* hex = 0x21, ascii = '!' */
                const signedVal = val >= 0 ? val : properties.maxv + 1 + val;
                return `${val} /* hex = 0x${signedVal.toString(16).padStart(properties.bytes * 2, '0')}, ascii = '${String.fromCharCode(val)}' */`;
            } else if (sig === "BOOL") {
                return val !== 0 ? "true" : "false";
            } else if (!properties.isFloat) {
                // 160 /* hex = 0xA0 */
                const signedVal = val >= 0 ? val : properties.maxv + 1 + val;
                return `${val} /* hex = 0x${signedVal.toString(16).padStart(properties.bytes * 2, '0')} */`;
            } else {
                return val.toString();
            }
        }
        const pointerVar = variables.asPointer(v) as InitPointerVariable<PointeeVariable> | null;
        if (pointerVar !== null) {
            if (variables.asFunctionType(pointerVar.t.pointee) !== null) {
                return "<function>";
            }
            if (options.noPointer) {
                return "->/*...*/";
            } else {
                options.noPointer = true;
                if (pointerVar.v.subtype === "DIRECT") {
                    return "->" + this.makeValueString({ t: pointerVar.t.pointee, v: pointerVar.v.pointee, left: false, readonly: false } as Variable | Function);
                } else {
                    const indexPointerVar = pointerVar as InitIndexPointerVariable<Variable>;
                    const arrayObjectType = indexPointerVar.t.pointee;
                    const asArithmeticElemType: ArithmeticType | null = variables.asArithmeticType(arrayObjectType);
                    if (asArithmeticElemType?.sig === "I8" || asArithmeticElemType?.sig === "U8") {
                        // string representation
                        return `"${this.getStringFromCharArray(indexPointerVar as InitIndexPointerVariable<ArithmeticVariable>)}"`;
                    } else if (options.noArray) {
                        return "{ /*...*/ }";
                    } else {
                        options.noArray = true;
                        const displayList = [];
                        const slice = indexPointerVar.v.pointee.values.slice(indexPointerVar.v.index);
                        for (let i = 0; i < slice.length; i++) {
                            displayList.push(this.makeValueString({ t: arrayObjectType, v: slice[i], left: false, readonly: false } as Variable | Function, options));
                        }
                        return "{ " + displayList.join(", ") + " }";
                    }
                }
            }
        }
        if (variables.asClassType(v.t) !== null) {
            return "<class>";
        }
        return "<unknown>";
    };

    /** Parses an character array representing the UTF-8 sequence into a string. */
    getStringFromCharArray(src: InitIndexPointerVariable<ArithmeticVariable>, len: number | null = null): string {
        if (!(src.t.pointee.sig === "I8" || src.t.pointee.sig === "U8")) {
            this.raiseException("Not a char array")
        }
        if (len === null) {
            len = src.v.pointee.values.length - src.v.index;
        }
        const byteArray = new Uint8Array(src.v.pointee.values.slice(src.v.index, src.v.index + len).map((x: ArithmeticValue) => x.state === "INIT" ? x.value : 0));
        // remove trailing null-terminators '\0' from the end
        return fromUtf8CharArray(byteArray).replace(/\0+$/, "");
    }

    getCharArrayFromString(src: string): InitIndexPointerVariable<ArithmeticVariable> {
        let array = toUtf8CharArray(src);
        //console.log(Array.from(array).map((x) => { return `\\x${x.toString(16)}`; }).join(""));
        let memoryObject = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), new Array<ArithmeticValue>())
        array.forEach((iv, ii) => {
            const lvHolder: LValueIndexHolder<ArithmeticVariable> = { array: memoryObject, index: ii };
            memoryObject.values.push(variables.arithmetic("I8", iv, lvHolder, false).v);
        })
        // add a null-terminator ('\0')
        const lvHolder: LValueIndexHolder<ArithmeticVariable> = { array: memoryObject, index: array.length };
        memoryObject.values.push(variables.arithmetic("I8", 0, lvHolder, false).v);

        return variables.indexPointer(memoryObject, 0, true, null, false);
    }

    cast(target: ObjectType, v: InitVariable, allowUToSOverflow: boolean = false): ResultOrGen<InitVariable> {
        // TODO: looking for global overload
        if (variables.typesEqual(v.t, target)) {
            return v;
        }
        const arithmeticTarget = variables.asArithmeticType(target);
        const arithmeticVar = variables.asArithmetic(v);
        if (arithmeticTarget !== null && arithmeticVar !== null) {
            const targetInfo = variables.arithmeticProperties[arithmeticTarget.sig];
            const fromInfo = variables.arithmeticProperties[arithmeticVar.t.sig];
            const arithmeticValue = this.arithmeticValue(arithmeticVar);
            if (target.sig === "BOOL") {
                return variables.arithmetic(target.sig, arithmeticValue === 0 ? 0 : 1, null);
            } else if (targetInfo.isFloat) {
                const onErr = () => `overflow when casting '${this.makeValueString(v)}' of type '${this.makeTypeStringOfVar(v)}' to '${this.makeTypeString(target)}'`;
                if (this.inrange(arithmeticValue, arithmeticTarget, onErr)) {
                    return variables.arithmetic(arithmeticTarget.sig, arithmeticValue, null);
                }
            } else {
                const conversionErrorMsg: () => string = () => `${this.makeValueString(v)} of type ${this.makeTypeStringOfVar(v)} to type ${this.makeTypeString(target)}`;
                if (!targetInfo.isSigned) {
                    if (arithmeticValue < 0) {
                        const newVar = variables.arithmetic(arithmeticTarget.sig, arithmeticValue, null);
                        this.adjustArithmeticValue(newVar);
                        //if (this.inrange(newVar.v.value as number, newVar.t, () => "cannot cast negative value " + conversionErrorMsg())) {
                        return newVar;
                        //}
                    }
                }
                if (fromInfo.isFloat) {
                    const intVar = variables.arithmetic(arithmeticTarget.sig, arithmeticValue > 0 ? Math.floor(arithmeticValue) : Math.ceil(arithmeticValue), null);
                    if (this.inrange(intVar.v.value as number, intVar.t, () => "overflow when casting value " + conversionErrorMsg())) {
                        this.adjustArithmeticValue(intVar);
                        return intVar;
                    }
                } else {
                    const newVar = variables.arithmetic(arithmeticTarget.sig, arithmeticValue, null);
                    if (allowUToSOverflow || this.inrange(newVar.v.value as number, newVar.t, () => "overflow when casting value " + conversionErrorMsg())) {
                        this.adjustArithmeticValue(newVar);
                        return newVar;
                    }
                }
            }
        }
        else if (arithmeticTarget?.sig === "BOOL") {
            const boolSym = this.getOpByParams("{global}", "o(_bool)", [v], []);
            return this.invokeCall(boolSym, [], v) as ResultOrGen<InitArithmeticVariable>;
        }
        const pointerTarget = variables.asPointerType(target);
        const iptrVar = variables.asInitIndexPointer(v);
        //const dptrVar = variables.asInitDirectPointer(v);
        if (pointerTarget !== null && iptrVar !== null) {
            if (variables.typesEqual(pointerTarget.pointee, iptrVar.t.pointee)) {
                if (pointerTarget.sizeConstraint === null || pointerTarget.sizeConstraint === iptrVar.t.sizeConstraint) {
                    return variables.indexPointer(iptrVar.v.pointee, iptrVar.v.index, pointerTarget.sizeConstraint !== null, null);
                }
            }
        }
        this.raiseException("Cast: Type error not yet implemented");
    };

    addToNamespace(namespacePath: string, name: string, obj: any) {
        const namespaces = namespacePath.split('::');
        let currentNamespace: any = this.namespace;

        for (let i = 0; i < namespaces.length; i++) {
            const namespace = namespaces[i];
            if (!currentNamespace[namespace])
                currentNamespace[namespace] = {};
            currentNamespace = currentNamespace[namespace];
        }

        currentNamespace[name] = obj;
    };

    resolveNamespacePath(obj: any, path: string) {
        const keys = path.split('::');

        let current = obj;
        for (const key of keys) {
            if (current.hasOwnProperty(key)) {
                current = current[key];
            } else {
                return undefined;
            }
        }

        return current;
    };

    getFromNamespace(namespacePath: string) {
        const namespaces = namespacePath.split('::');
        if (namespaces.length <= 1)
            return null;

        let currentNamespaceObj: any = this.namespace;
        for (let i = 0; i < namespaces.length; i++) {
            const namespace = namespaces[i];
            if (!(namespace in currentNamespaceObj))
                return undefined;
            currentNamespaceObj = currentNamespaceObj[namespace];
        }

        return currentNamespaceObj;
    };

    enterScope(scopename: string) {
        this.scope.push({ "$name": scopename, variables: {} });
    };

    exitScope(scopename: string) {
        // logger.info("%j", this.scope);
        while (true) {
            const s = this.scope.pop();
            if (!scopename || !(this.scope.length > 1) || ((s as RuntimeScope)["$name"] === scopename)) {
                break;
            }
        }
    };

    defineStruct(domain: ClassType | "{global}", identifier: string, memberList: MemberObject[]) {
        const classType = variables.classType(identifier, [], domain === "{global}" ? null : domain);
        const domainInline = this.domainString(classType);
        const factory: MemberObjectListCreator = { numTemplateArgs: 0, factory: () => memberList };
        const dataMemberNames: string[] = memberList.map(x => x.name);
        this.addTypeDomain(domainInline, factory, dataMemberNames);

        const members: { [name: string]: Variable } = {};
        memberList.forEach((x: MemberObject) => { members[x.name] = x.variable })
        const stubClass = variables.class(classType, members, null);

        const stubClassTypeSig = variables.toStringSequence(this, stubClass.t, false, false);
        const listPrototypeType = variables.classType(typecheck.prototypeListSpecifier, memberList.map(x => x.variable.t), null);
        const listPrototypeTypeSig = variables.toStringSequence(this, listPrototypeType, false, false);
        if (!(identifier in this.ct.list)) {
            this.ct.list[identifier] = { dst: stubClassTypeSig, src: [] };
        } else {
            this.raiseException("Struct definition error: Template struct overloads are not yet implemented");
        }
        this.ct.list[identifier].src.push(listPrototypeTypeSig);

        const stubCtorTypeSig = this.createFunctionTypeSignature(classType, { t: classType, v: { lvHolder: null } }, [], true)
        this.regFunc(function(rt: CRuntime): InitClassVariable {
            return variables.clone(rt, stubClass, null, false);
        }, classType, "o(_stub)", stubCtorTypeSig, [-1]);
    };

    defineStruct2(domain: ClassType | "{global}", identifier: string, memberList: MemberObjectListCreator, dataMemberNames: string[]) {
        const classType = variables.classType(identifier, [], domain === "{global}" ? null : domain);
        const domainInline = this.domainString(classType);
        this.addTypeDomain(domainInline, memberList, dataMemberNames);

        let stubClassTypeSig: string[] = [];
        for (let i = 0; i < memberList.numTemplateArgs; i++) {
            stubClassTypeSig.push("!ParamObject")
        }
        stubClassTypeSig.push("CLASS", identifier, "<");
        for (let i = 0; i < memberList.numTemplateArgs; i++) {
            stubClassTypeSig.push(`?${i}`);
        }
        stubClassTypeSig.push(">");

        //let listPrototypeTypeSig : string[] = ["CLASS", typecheck.prototypeListSpecifier, "<"];
        if (!(identifier in this.ct.list)) {
            this.ct.list[identifier] = { dst: stubClassTypeSig, src: [] };
        } else {
            this.raiseException("Struct definition error: Template struct overloads are not yet implemented");
        }
        if (identifier === "pair") {
            this.ct.list[identifier].src.push("CLASS __list_prototype < ?0 ?1 >".split(" "));
        }
        //this.ct.list[identifier].src.push(listPrototypeTypeSig);

        const stubCtorTypeSig = this.createFunctionTypeSignature(classType, { t: classType, v: { lvHolder: null } }, [], true)
        this.regFunc(function*(_rt: CRuntime, templateArgs: [ClassType]): Gen<InitClassVariable> {
            const members: { [name: string]: Variable } = {};
            const memListYield: ResultOrGen<MemberObject[]> = memberList.factory(...templateArgs);
            const memList: MemberObject[] = interp.asResult(memListYield) ?? (yield* memListYield as Gen<MemberObject[]>);
            memList.forEach((x: MemberObject) => { members[x.name] = x.variable });
            return variables.class(variables.classType(identifier, templateArgs[0].templateSpec, domain === "{global}" ? null : domain), members, null);
        }, classType, "o(_stub)", stubCtorTypeSig, [-1]);
    };

    detectWideCharacters(str: string): boolean {
        const wideCharacterRange = /[\u0100-\uffff]/;

        return wideCharacterRange.test(str);
    }

    /** Safely accesses values.
      * Panics if value is uninitalised. */
    arithmeticValue(variable: MaybeUnboundArithmeticVariable): number {
        if (variable.v.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value")
        } else if (variable.v.state === "UNBOUND") {
            this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.v.lvHolder.index} in an array of size ${variable.v.lvHolder.array.values.length}.`);
        }
        return variable.v.value;
    }

    expectValue(variable: MaybeUnboundVariable): InitVariable {
        if (variable.v.state === "UNINIT") {
            this.raiseException("Access of an uninitialised value")
        } else if (variable.v.state === "UNBOUND") {
            this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.v.lvHolder.index} in an array of size ${variable.v.lvHolder.array.values.length}.`);
        }
        return variable as InitVariable;
    }

    unbound(variable: MaybeUnboundVariable): Variable {
        if (variable.v.state === "UNBOUND") {
            this.raiseException(`(Segmentation fault) access of an out-of-bounds index ${variable.v.lvHolder.index} in an array of size ${variable.v.lvHolder.array.values.length}.`);
        }
        return variable as Variable;
    }

    defaultValue(type: ObjectType, lvHolder: LValueHolder<Variable>): ResultOrGen<Variable> {
        let classType: ClassType | null;
        let pointerType: PointerType<ObjectType | FunctionType> | null;
        if (type.sig in variables.arithmeticSig) {
            return variables.uninitArithmetic(type.sig as ArithmeticSig, lvHolder as LValueHolder<ArithmeticVariable>, false);
        } else if ((classType = variables.asClassType(type)) !== null) {
            const domainName = classType.identifier;
            if (!(domainName in this.typeMap)) {
                this.raiseException(`Could not resolve a class named '${domainName}'`)
            }
            const fnid = this.typeMap[domainName].functionDB.matchExactOverload("o(_stub)", "FUNCTION Return ( )");
            if (fnid !== -1 && this.typeMap[domainName].functionsByID[fnid].target !== null) {
                return (this.typeMap[domainName].functionsByID[fnid].target as CFunction)(this, [type]) as ResultOrGen<InitClassVariable>;
            } else {
                this.raiseException(`Could not find a stub-constructor for class/struct named '${classType.identifier}'`)
            }
        } else if ((pointerType = variables.asPointerType(type)) !== null) {
            if (pointerType.sizeConstraint === null) {
                return variables.uninitPointer(pointerType.pointee, null, lvHolder as LValueHolder<PointerVariable<PointeeVariable>>, false);
            } else {

            }
        }
        this.raiseException("Not yet implemented");
    };

    *defaultValue2(type: ObjectType, lvHolder: LValueHolder<Variable>): ResultOrGen<Variable> {
        let classType: ClassType | null;
        let pointerType: PointerType<ObjectType | FunctionType> | null;
        if (type.sig in variables.arithmeticSig) {
            return variables.uninitArithmetic(type.sig as ArithmeticSig, lvHolder as LValueHolder<ArithmeticVariable>, false);
        } else if ((classType = variables.asClassType(type)) !== null) {
            const domainName = classType.identifier;
            if (!(domainName in this.typeMap)) {
                this.raiseException(`Could not resolve a class named '${domainName}'`)
            }
            const fnid = this.typeMap[domainName].functionDB.matchExactOverload("o(_stub)", "FUNCTION Return ( )");
            if (fnid !== -1 && this.typeMap[domainName].functionsByID[fnid].target !== null) {
                const retvYield = (this.typeMap[domainName].functionsByID[fnid].target as CFunction)(this, [type]) as ResultOrGen<InitClassVariable>;
                return interp.asResult(retvYield) ?? (yield* retvYield as Gen<InitClassVariable>);
            } else {
                this.raiseException(`Could not find a stub-constructor for class/struct named '${classType.identifier}'`)
            }
        } else if ((pointerType = variables.asPointerType(type)) !== null) {
            if (pointerType.sizeConstraint === null) {
                return variables.uninitPointer(pointerType.pointee, null, lvHolder as LValueHolder<PointerVariable<PointeeVariable>>, false);
            } else if (pointerType.sizeConstraint < 0) {
                // negative sizeConstraint value is reserved for occasions when the variable is a sized array but array size expression is not given.
                // e.g.: int a[] = { 3, 4, 5 };
                this.raiseException("Array size or a brace-enclosed list initialiser must be provided at the point of declaration of a static array");
            } else {
                if (pointerType.pointee.sig === "FUNCTION") {
                    this.raiseException("Cannot declare an array of functions (perhaps you meant an array of function pointers?)")
                }
                const memory = variables.arrayMemory<Variable>(pointerType.pointee as ObjectType, []);
                for (let i = 0; i < pointerType.sizeConstraint; i++) {
                    // variables.clone() is a shallow clone, do not put defaultVal outside the for-loop
                    const defaultValueYield = this.defaultValue2(pointerType.pointee as ObjectType, null);
                    const defaultVal = interp.asResult(defaultValueYield) ?? (yield* defaultValueYield as Gen<Variable>);
                    memory.values.push(variables.clone(this, defaultVal, { array: memory, index: i }, false, true).v);
                }
                return variables.indexPointer(memory, 0, true, lvHolder as LValueHolder<PointerVariable<Variable>>);
            }
        }
        this.raiseException("Not yet implemented");
    };

    raiseException(message: string, currentNode?: any): never {
        if (this?.interp) {
            if (currentNode == null) {
                ({
                    currentNode
                } = this.interp);
            }
            const posInfo =
                (() => {
                    if (currentNode != null) {
                        const ln = currentNode.sLine;
                        const col = currentNode.sColumn;
                        return `[line ${ln}:${col}]`;
                    } else {
                        return "[position unavailable]";
                    }
                })();
            throw new CRuntimeError(posInfo + " " + message, currentNode?.sLine ?? null, currentNode?.sColumn ?? null);
        } else {
            throw new CRuntimeError(message, null, null);
        }
    };

    raiseSoftException(message: string, currentNode?: any) {
        if (this?.interp) {
            if (currentNode == null) {
                ({
                    currentNode
                } = this.interp);
            }
            const posInfo =
                (() => {
                    if (currentNode != null) {
                        const ln = currentNode.sLine;
                        const col = currentNode.sColumn;
                        return `[line ${ln}:${col}]`;
                    } else {
                        return "[position unavailable]";
                    }
                })();
            console.error(posInfo + " WARN: " + message);
        } else {
            console.error(message);
        }
    };

}

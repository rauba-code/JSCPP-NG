import * as defaults from "./defaults";
import * as Flatted from 'flatted';
import { constructTypeParser, LLParser, parse } from './typecheck';
import { BaseInterpreter, Interpreter } from "./interpreter";
import { resolveIdentifier } from "./includes/shared/string_utils";
import { AnyType, ArithmeticSig, ArithmeticType, ArithmeticVariable, CFunction, ClassType, DynamicArrayType, Function, FunctionType, IndexPointerType, IndexPointerVariable, MaybeLeft, MaybeLeftCV, ObjectType, PointerType, StaticArrayType, Variable, variables } from "./variables";
import { TypeDB } from "./typedb";
export type Specifier = "const" | "inline" | "_stdcall" | "extern" | "static" | "auto" | "register";

export interface IncludeModule {
    load(rt: CRuntime): void;
}

export interface JSCPPConfig {
    specifiers?: Specifier[];
    arithmeticResolutionMap?: { [x: string]: ArithmeticSig };
    limits?: {
        [typeName in ArithmeticSig]?: {
            max: number;
            min: number;
            bytes: number;
        }
    };
    includes?: { [fileName: string]: IncludeModule };
    loadedLibraries?: string[];
    fstream?: {
        open: (context: object, fileName: string) => object
    };
    stdio?: {
        isMochaTest?: boolean;
        promiseError: (promise_error: string) => void;
        drain?: () => string;
        cinStop: () => void;
        cinProceed: () => void;
        cinState: () => boolean;
        setReadResult: (result: string) => void;
        getReadResult: () => string;
        getInput: () => Promise<string>;
        finishCallback: (ExitCode: number) => void;
        write: (s: string) => void;
    };
    unsigned_overflow?: "error" | "warn" | "ignore";

    debug?: boolean;
    maxExecutionSteps?: number;
    maxTimeout?: number;
    eventLoopSteps?: number;
    stopExecutionCheck?: () => boolean;
}

export type OpSignature = "o(_--)" | "o(--_)" | "o(_-_)" | "o(-_)" | "o(_-=_)" | "o(_->_)" | "o(_,_)" | "o(!_)" | "o(_!=_)" | "o(_[])" | "o(*_)" | "o(_*_)" | "o(_*=_)" | "o(_/_)" | "o(_/=_)" | "o(_&_)" | "o(&_)" | "o(_&=_)" | "o(_%_)" | "o(_%=_)" | "o(_^_)" | "o(_^=_)" | "o(_+_)" | "o(+_)" | "o(_++)" | "o(++_)" | "o(_+=_)" | "o(_<_)" | "o(_<<_)" | "o(_<<=_)" | "o(_<=_)" | "o(_=_)" | "o(_==_)" | "o(_>_)" | "o(_>=_)" | "o(_>>_)" | "o(_>>=_)" | "o(_|_)" | "o(_|=_)" | "o(~_)" | "o(_&&_)" | "o(_||_)" | "o(_bool)" | "o(_ctor)";

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

//export interface MakeValueStringOptions {
//    noArray?: boolean;
//    noPointer?: boolean;
//}

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

export interface TypeHandlerMap {
    functionDB: TypeDB;
    functionsByID: FunctionSymbol[];
}

export interface TypeSignature {
    inline: string,
    array: string[],
}


export class CRuntime {
    parser: LLParser;
    config: JSCPPConfig;
    scope: RuntimeScope[];
    namespace: NamespaceScope;
    typeMap: { [domainIdentifier: string]: TypeHandlerMap };
    typedefs: { [name: string]: AnyType };
    interp: BaseInterpreter;

    constructor(config: JSCPPConfig) {
        this.parser = constructTypeParser();
        this.config = defaults.getDefaultConfig();
        mergeConfig(this.config, config);
        //this.types = defaults.getDefaultTypes();
        this.typeMap = {};
        this.typeMap["{global}"] = {
            functionDB: new TypeDB(this.parser),
            functionsByID: []
        };

        this.scope = [{ "$name": "{global}", variables: {} }];
        this.namespace = {};
        this.typedefs = {};
    }

    include(name: string) {
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

    getSizeByType(t: ObjectType): number {
        let at: ArithmeticType | null;
        let sat: StaticArrayType | null;
        if (variables.asPointerType(t) ?? variables.asIndexPointerType(t) !== null) {
            throw new Error("Not yet implemented");
        } else if ((at = variables.asArithmeticType(t)) !== null) {
            return variables.arithmeticProperties[at.sig].bytes;
        } else if ((sat = variables.asStaticArrayType(t)) !== null) {
            return this.getSizeByType(sat.object) * sat.size;
        }
        throw new Error("Not yet implemented");
    };

    asCapturedVariable(x: Variable): Variable {
        const iptr: IndexPointerVariable | null = variables.asIndexPointer(x);
        if (iptr === null) {
            return x;
        } else {
            const idx: number = iptr.v.index;
            const len: number = iptr.v.pointee.values.length;
            if (idx >= len) {
                this.raiseException(`index out of bounds access: ${idx} >= ${len}`);
            } else if (iptr.v.index < 0) {
                this.raiseException(`access of negative index: ${idx}`);
            }
            const t = iptr.t.array.object;
            const v = iptr.v.pointee.values[idx];
            return { t, v, left: true, readonly: iptr.readonly } as Variable;
        }
    };

    getMember(l: Variable, identifier: string): Variable | Function {
        l = this.asCapturedVariable(l);
        let lc = variables.asClass(l);
        if (lc !== null) {
            if (!lc.left) {
                this.raiseException("Access to a member of a non-lvalue variable is forbidden");
            }
            const lsig: string[] = variables.toStringSequence(lc.t, true)
            const linlinesig: string = lsig.join(" ");
            if (linlinesig in this.typeMap) {
                const memberFn: TypeHandlerMap = this.typeMap[linlinesig];
                let fnid: number;
                try {
                    fnid = memberFn.functionDB.matchSingleFunction(identifier);
                } catch (e) {
                    this.raiseException(e);
                }
                if (fnid >= 0) {
                    const fnsym: FunctionSymbol = memberFn.functionsByID[fnid];
                    return variables.function(fnsym.type, identifier, fnsym.target, lc);
                } else if (identifier in lc.v.members) {
                    return lc.v.members[identifier];
                } else {
                    this.raiseException(`type '${linlinesig}' does not have a member called '${identifier}'`);
                }
            } else {
                this.raiseException(`type '${linlinesig}' is unknown`);
            }
        } else {
            this.raiseException("only a class or struct can have members");
        }
    };

    typeSignature(array: string[]): TypeSignature {
        const inline: string = array.join(" ");
        if (!parse(this.parser, array)) {
            this.raiseException(`Malformed type signature: '${inline}'`)
        }
        return { inline, array };
    };

    typeSignatureUnchecked(array: string[]): TypeSignature {
        return { inline: array.join(" "), array };
    };

    /** This function is only used when defining a function with an exact type, typically at runtime. For matching, use TypeDB-associated functions */
    createFunctionTypeSignature(domain: ClassType | "{global}", retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[]): TypeSignature {
        const thisSig: string[] = (domain === "{global}") ? [] : variables.toStringSequence(domain, true);
        const returnSig: string[] = retType === "VOID" ? [retType] : variables.toStringSequence(retType.t, retType.left);
        const argTypeSig: string[][] = argTypes.map((x) => variables.toStringSequence(x.t, x.left));
        const result: string[] = [[["FUNCTION"], returnSig, ["("], thisSig], argTypeSig, [[")"]]].flat().flat();
        return this.typeSignature(result);
    }

    defFunc(domain: ClassType | "{global}", name: string, retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[], argNames: string[], stmts: any, interp: Interpreter): void {
        let f : CFunction | null = null;
        if (stmts != null) {
            f = function*(rt: CRuntime, _this: Variable, ...args: Variable[]) {
                // logger.warn("calling function: %j", name);
                rt.enterScope("function " + name);
                argNames.forEach(function(argName, i) {
                    args[i].readonly = argTypes[i].readonly;
                    rt.defVar(argName, args[i]);
                });
                let ret = yield* interp.run(stmts, interp.source, { scope: "function" });
                if (retType === "VOID") {
                    if (ret instanceof Array && (ret[0] === "return")) {
                        rt.raiseException("not yet implemented");
                        // ret = rt.cast(retType, ret[1]);
                    } else {
                        rt.raiseException("non-void function must return a value");
                    }
                } else {
                    if (Array.isArray(ret)) {
                        if ((ret[0] === "return") && ret[1]) {
                            rt.raiseException("void function cannot return a value");
                        }
                    }
                    ret = undefined;
                }
                rt.exitScope("function " + name);
                // logger.warn("function: returning %j", ret);
                return ret;
            };
        }
        const fnsig = this.createFunctionTypeSignature(domain, retType, argTypes);
        this.regFunc(f, domain, name, fnsig);
    };

    /** Convenience function for static type checking of operators */
    getOpByParams(domain: "{global}", identifier: OpSignature, params: MaybeLeft<ObjectType>[]): FunctionSymbol {
        return this.getFuncByParams(domain, identifier, params);
    }

    tryGetOpByParams(domain: "{global}", identifier: OpSignature, params: MaybeLeft<ObjectType>[]): FunctionSymbol | null {
        return this.tryGetFuncByParams(domain, identifier, params);
    }
   
    getFuncByParams(domain: ClassType | "{global}", identifier: string, params: MaybeLeft<ObjectType>[]): FunctionSymbol {
        const domainSig: string = this.domainString(domain);
        if (!(domainSig in this.typeMap)) {
            this.raiseException(`domain '${domainSig}' is unknown`);
        }
        console.log(`getfunc: '(${domainSig})::${identifier}'`);
        const domainMap: TypeHandlerMap = this.typeMap[domainSig];
        const fnID = domainMap.functionDB.matchFunctionByParams(identifier, params.map((x) => variables.toStringSequence(x.t, x.left)));
        if (fnID < 1) {
            this.raiseException(`No matching function '(${domainSig})::${identifier}'`);
        }
        return domainMap.functionsByID[fnID];
    };

    tryGetFuncByParams(domain: ClassType | "{global}", identifier: string, params: MaybeLeft<ObjectType>[]): FunctionSymbol | null {
        const domainSig: string = this.domainString(domain);
        if (!(domainSig in this.typeMap)) {
            this.raiseException(`domain '${domainSig}' is unknown`);
        }
        console.log(`getfunc: '(${domainSig})::${identifier}'`);
        const domainMap: TypeHandlerMap = this.typeMap[domainSig];
        const fnID = domainMap.functionDB.matchFunctionByParams(identifier, params.map((x) => variables.toStringSequence(x.t, x.left)));
        if (fnID < 1) {
            return null;
        }
        return domainMap.functionsByID[fnID];
    };

    makeOperatorFuncName = (name: string) => `o(${name})`;

    domainString(domain: ClassType | "{global}"): string {
        if (domain === "{global}") {
            return domain;
        }
        let seq : string[] = [domain.identifier];
        let sub : ClassType = domain;
        while (sub.memberOf !== null) {
            seq.push(sub.memberOf.identifier);
            sub = sub.memberOf;
        }
        return seq.reverse().join(".");
    }

    regFunc(f: CFunction | null, domain: ClassType | "{global}", name: string, fnsig: TypeSignature): void {
        const domainInlineSig: string = (domain === "{global}") ? domain : variables.toStringSequence(domain, false).join(" ");
        if (!(domainInlineSig in this.typeMap)) {
            this.raiseException(`type '${fnsig.inline}' is unknown`);
        }
        const domainMap: TypeHandlerMap = this.typeMap[domainInlineSig];
        console.log(`regfunc: '${fnsig.inline}'`);

        try {
            const existingOverloadID: number = domainMap.functionDB.matchFunctionExact(name, fnsig.array);
            if (existingOverloadID !== -1) {
                const overload = domainMap.functionsByID[existingOverloadID];
                if (overload.target === null) {
                    if (f === null) {
                        const prettyDomain = domain === "{global}" ? domain : this.makeTypeString({ t: domain, left: false, readonly: false });
                        this.raiseException(`Redefinition of a function prototype '${prettyDomain}::${name}'`);
                    }
                } else {
                    const existingOverloadType: string = overload.type.join(" ");
                    this.raiseException(`Overloaded function '(${domainInlineSig})::${name}' of type '${fnsig.inline}' is re-declared or already covered by the type '${existingOverloadType}'`)
                }
            }
            domainMap.functionDB.addFunctionOverload(name, fnsig.array);
            domainMap.functionsByID.push({ type: fnsig.array, target: f });
        } catch (e) {
            this.raiseException(e);
        }
    };

    registerTypedef(basttype: AnyType, name: string) {
        return this.typedefs[name] = basttype;
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

    readVar(varname: string) {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (vc.variables[varname] != null) {
                const ret = vc.variables[varname];
                return ret;
            }
            i--;
        }
        this.raiseException("variable " + varname + " does not exist");
    };

    deleteVar(varname: string) {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (vc.variables[varname] != null) {
                delete vc.variables[varname];
                return;
            }
            i--;
        }
        this.raiseException("variable " + varname + " does not exist");
    };

    varAlreadyDefined(varname: string): boolean {
        let i = this.scope.length - 1;
        while (i >= 0) {
            const vc = this.scope[i];
            if (varname in vc) {
                return true;
            }
            i--;
        }
        return false;
    };

    simpleType(type: string | (string | { Identifier: string })[]): AnyType {
        this.raiseException("Not yet implemented");
        /*if (Array.isArray(type)) {
            if (type.length > 1) {
                const typeStr = type.map((t) => (t as { Identifier: string }).Identifier ?? t)
                    .filter(t => {
                        return !this.config.specifiers.includes(t as Specifier);
                    }).join(" ");
                return this.simpleType(typeStr);
            } else {
                return this.typedefs[type[0] as string] || this.simpleType(type[0] as string);
            }
        } else {
            if (this.isPrimitiveType(type)) {
                return this.primitiveType(type);
            } else if (this.isStructType(type)) {
                return this.simpleStructType(type);
            } else if (this.isNamespaceType(type)) {
                return this.simpleType(resolveIdentifier(type).split("::").pop());
            } else {
                return this.simpleClassType(type);
            }
        }*/
    };

    defVar(varname: string, object: Variable) {
        object = this.asCapturedVariable(object);
        if (varname == null) {
            this.raiseException("cannot define a variable without name");
        }
        if (this.varAlreadyDefined(varname)) {
            this.raiseException("variable " + varname + " already defined");
        }

        const dataType = object.t;
        const readonly = object.readonly;
        const vc = this.scope[this.scope.length - 1];
        console.log(`defining variable: '${varname}' of type '${variables.toStringSequence(object.t, true)}'`);
        this.raiseException("not yet implemented");
        /*if (this.isReferenceType(type)) {
            initval = this.cast(type, initval);
        } else {
            initval = this.clone(this.cast(type, initval), true);
        }

        vc.variables[varname] = initval === undefined ? this.defaultValue(type) : initval;
        vc.variables[varname].readonly = readonly;
        vc.variables[varname].left = true;
        if (dataType) {
            vc.variables[varname].dataType = dataType;
        }*/
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
        let ptr1: PointerType | null;
        let ptr2: PointerType | null;
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

    makeTypeString(object: MaybeLeftCV<AnyType> | "VOID"): string {
        if (object === "VOID") {
            return "void"
        }
        const inner = (t: AnyType) => this.makeTypeString({ t, left: false, readonly: false });
        const branch: { [sig in string]: () => string } = {
            "ARITHMETIC": () => {
                const x = object.t as ArithmeticType;
                return variables.arithmeticProperties[x.sig].name;
            },
            "VOID": () => {
                return "void";
            },
            "PTR": () => {
                const x = object.t as PointerType;
                return inner(x.pointee) + "*";
            },
            "INDEXPTR": () => {
                const x = object.t as IndexPointerType;
                return inner(x.array.object) + "*";
            },
            "ARRAY": () => {
                const x = object.t as StaticArrayType;
                return inner(x.object) + `[${x.size}]`;
            },
            "DYNARRAY": () => {
                const x = object.t as DynamicArrayType;
                this.raiseSoftException("WARN: direct access of internal dynamic array type");
                return `__dynamic_array<${inner(x.object)}>`;
            },
            "CLASS": () => {
                const x = object.t as ClassType;
                return (x.memberOf ? inner(x.memberOf) + "::" : "") + x.identifier + ((x.templateSpec.length === 0) ? "" : "<" + x.templateSpec.map(inner).join(", ") + ">");
            },
            "FUNCTION": () => {
                const x = object.t as FunctionType;
                return "{" + x.fulltype.join(" ") + "}";
            },
        }
        const where = (object.t.sig in variables.arithmeticSig) ? "ARITHMETIC" : object.t.sig;
        return [object.readonly ? "const " : "", branch[where](), object.left ? "&" : ""].join("");
    }

    /** For integers, performs a two's-complement integer overflow on demand.
      * > Does not really depend on signedness, just on limits set by basic arithmetic types. 
      * For floating-point values, rounds to the nearest precision available.*/
    adjustArithmeticValue(x: ArithmeticVariable): void {
        const info = variables.arithmeticProperties[x.t.sig];
        if (info.isFloat || (x.v.value >= info.minv && x.v.value <= info.maxv)) {
            if (x.t.sig === "F32") {
                // javascript numbers are typically double-precision FP values.
                x.v.value = Math.fround(x.v.value);
            }
            return;
        }
        let q : number = (x.v.value - info.minv) % (info.maxv + 1 - info.minv);
        if (q < 0) {
            q += info.maxv + 1 - info.minv;
        }
        if (!Number.isInteger(q)) {
            // q = Math.floor(q); if you're desperate
            this.raiseException("Not an integer")
        }
        x.v.value = q;
    }

    cast(target: ObjectType, v: Variable): Variable | Generator<unknown, Variable, unknown> {
        // TODO: looking for global overload
        if (variables.typesEqual(v.t, target)) {
            return v;
        }
        const arithmeticTarget = variables.asArithmeticType(target);
        const arithmeticVar = variables.asArithmetic(v);
        if (arithmeticTarget !== null && arithmeticVar !== null) {
            const targetInfo = variables.arithmeticProperties[arithmeticTarget.sig];
            const fromInfo = variables.arithmeticProperties[arithmeticVar.t.sig];
            const arithmeticValue = arithmeticVar.v.value;
            if (target.sig === "BOOL") {
                return variables.arithmetic(target.sig, arithmeticVar.v ? 1 : 0, false);
            } else if (targetInfo.isFloat) {
                const onErr = () => `overflow when casting '${this.makeTypeString(v)}' to '${this.makeTypeString({ t: target, left: false, readonly: false })}'`;
                if (this.inrange(arithmeticValue, arithmeticTarget, onErr)) {
                    return variables.arithmetic(arithmeticTarget.sig, arithmeticValue);
                }
            } else {
                if (!targetInfo.isSigned) {
                    if (arithmeticValue < 0) {
                        // unsafe! bitwise truncation is platform-dependent
                        const newVar = variables.arithmetic(arithmeticTarget.sig, arithmeticValue & ((1 << (8 * targetInfo.bytes)) - 1)); // bitwise truncation
                        if (this.inrange(newVar.v.value, newVar.t, () => `cannot cast negative value ${newVar.v.value} to ` + this.makeTypeString(newVar))) {
                            this.adjustArithmeticValue(newVar);
                            return newVar;
                        }
                    }
                }
                if (fromInfo.isFloat) {
                    const intVar = variables.arithmetic(arithmeticTarget.sig, arithmeticValue > 0 ? Math.floor(arithmeticValue) : Math.ceil(arithmeticValue));
                    if (this.inrange(intVar.v.value, intVar.t, () => `overflow when casting value '${intVar.v.value}' to type '${this.makeTypeString(intVar)}'`)) {
                        this.adjustArithmeticValue(intVar);
                        return intVar;
                    }
                } else {
                    const newVar = variables.arithmetic(arithmeticTarget.sig, arithmeticValue);
                    if (this.inrange(newVar.v.value, newVar.t, () => `overflow when casting ${newVar.v.value} to ${this.makeTypeString(newVar)}`)) {
                        this.adjustArithmeticValue(newVar);
                        return newVar;
                    }
                }
            }
        }
        else if (arithmeticTarget?.sig === "BOOL") {
            const boolSym = this.getOpByParams("{global}", "o(_bool)", [v]);
            if (boolSym.target === null) {
                this.raiseException("Function is defined but not implemented");
            }
            return boolSym.target(this, v);
        }
        //const pointerTarget = variables.asPointerType(v);
        //const iptrVar = variables.asIndexPointer(v);
        //const pointerVar = (iptrVar === null) ? variables.asPointer(v) : variables.pointerType(iptrVar.t.array.object);
        this.raiseException("Not yet implemented");
        /*else if (this.isPrimitiveType(target) && this.isArrayType(value)) {
            if (this.isTypeEqualTo(target, value.t.eleType)) {
                return value;
            }
        } else if (this.isStructType(target)) {
            return value;
        } else if (this.isReferenceType(target)) {
            return value;
        } else if (this.isPointerType(target)) {
            if (this.isArrayType(value)) {
                if (this.isNormalPointerType(target)) {
                    if (this.isTypeEqualTo(target.targetType, value.t.eleType)) {
                        return value;
                    } else {
                        this.raiseException(this.makeTypeString(target?.targetType) + " is not equal to array element target " + this.makeTypeString(value?.t.eleType));
                    }
                } else if (this.isArrayType(target)) {
                    if (this.isTypeEqualTo(target.eleType, value.t.eleType)) {
                        return value;
                    } else {
                        this.raiseException("array element target " + this.makeTypeString(target?.eleType) + " is not equal to array element target " + this.makeTypeString(value?.t.eleType));
                    }
                } else {
                    this.raiseException("cannot cast a function to a regular pointer");
                }
            } else {
                if (this.isNormalPointerType(target)) {
                    if (this.isNormalPointerType(value)) {
                        if (this.isTypeEqualTo(target.targetType, value.t.targetType)) {
                            return value;
                        } else {
                            this.raiseException(this.makeTypeString(target?.targetType) + " is not equal to " + this.makeTypeString(value?.t.targetType));
                        }
                    } else {
                        this.raiseException(this.makeValueString(value) + " is not a normal pointer");
                    }
                } else if (this.isArrayType(target)) {
                    if (this.isNormalPointerType(value)) {
                        if (this.isTypeEqualTo(target.eleType, value.t.targetType)) {
                            return value;
                        } else {
                            this.raiseException("array element target " + this.makeTypeString(target?.eleType) + " is not equal to " + this.makeTypeString(value?.t.targetType));
                        }
                    } else {
                        this.raiseException(this.makeValueString(value) + " is not a normal pointer");
                    }
                } else if (this.isFunctionPointerType(target)) {
                    if (this.isFunctionPointerType(value.t)) {
                        if (!this.isTypeEqualTo(target, value.t)) {
                            this.raiseException("Function pointers do not share the same signature");
                        }
                        return value;
                    } else {
                        this.raiseException("cannot cast a regular/array pointer to a function pointer");
                    }
                } else {
                    this.raiseException("cannot cast a function to a regular pointer");
                }
            }
        } else if (this.isFunctionType(target)) {
            if (this.isFunctionType(value.t)) {
                return this.val(value.t, value.v);
            } else {
                this.raiseException("cannot cast a regular pointer to a function");
            }
        } else if (this.isClassType(target)) {
            if (this.isStringClass(target)) {
                return this.val(target, value.v);
            } else if (this.isVectorClass(target)) {
                return this.val(target, value.v);
            } else {
                this.raiseException("not implemented");
            }
        } else if (this.isClassType(value.t)) {
            value = this.getCompatibleFunc(value.t, this.makeOperatorFuncName(target.name), [])(this, value);
            return value;
        } else {
            this.raiseException("cast failed from target " + this.makeTypeString(target) + " to " + this.makeTypeString(value?.t));
        }*/
    };

    cloneDeep<T>(obj: T): T {
        return Flatted.parse(Flatted.stringify(obj)) as T;
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
            if (!scopename || !(this.scope.length > 1) || (s["$name"] === scopename)) {
                break;
            }
        }
    };

    defineStruct(type: ClassType): void {
        const domain = this.domainString(type);
        if (domain in this.typeMap) {
            this.raiseException(`domain '${domain}' is already defined`);
        }

        this.raiseException("Not yet implemented");

        /*this.types[typeSig.inline] = {
            cConstructor(rt, _this) {
                const v = _this.v as ObjectValue;
                v.members = {};
                for (const member of members) {
                    v.members[member.name] = (member.initialize != null) ? rt.cloneDeep(member.initialize(rt, _this)) as Variable : rt.defaultValue(member.type, true);
                }
            },
            members,
            handlers: {
                // ...defaults.defaultOpHandler.handlers,
                "o(=)": {
                    default(rt: CRuntime, l: any, r: any) {
                        if (!l.left) {
                            rt.raiseException(rt.makeValString(l) + " is not a left value");
                        } else if (l.readonly) {
                            rt.raiseException(`assignment of read-only variable ${rt.makeValString(l)}`);
                        }

                        l.v = rt.cast(l.t, r).v;
                        return l;
                    },
                },
                "o(&)": {
                    default(rt: CRuntime, l: any, r: any) {
                        if (r === undefined) {
                            if (!l.left) {
                                rt.raiseException(rt.makeValString(l) + " is not a left value");
                            }
                            if ("array" in l) {
                                return rt.val(rt.arrayPointerType(l.t, l.array.length), rt.makeArrayPointerValue(l.array, l.arrayIndex));
                            } else {
                                const t = rt.normalPointerType(l.t);
                                return rt.val(t, rt.makeNormalPointerValue(l));
                            }

                        } else {
                            rt.raiseException(`operator & between types '${rt.makeTypeString(l)}' and '${rt.makeTypeString(r)}' is undefined`)
                        }
                    },
                },
            },
        };*/
    };

    /*defineClass(classname: string, members: Member[]) {
        const clsType: ClassType = {
            type: "class",
            name: classname
        };
        const sig = this.getTypeSignature(clsType);
        if (sig in this.types) {
            this.raiseException(this.makeTypeString(clsType) + " is already defined");
        }

        this.types[sig] = {
            father: classname,
            cConstructor(rt, _this, args = []) {
                const v = _this.v as ObjectValue;
                v.members = {};
                let i = 0;
                while (i < members.length) {
                    const member = members[i];
                    v.members[member.name] = (member.initialize != null) ? member.initialize(rt, _this) : rt.defaultValue(member.type, true);
                    i++;
                }
                rt.types[sig].handlers["o(())"]?.default(rt, _this, ...args);
            },
            members,
            handlers: {},
        };

        return clsType;
    };*/

    /*getStringFromCharArray(element: ArrayVariable) {
        if (this.isStringType(element.t)) {
            const {
                target
            } = element.v;
            let result = "";
            let i = 0;
            while (i < target.length) {
                const charVal = target[i];
                if (charVal.v === 0) {
                    break;
                }
                result += String.fromCharCode(charVal.v as number);
                i++;
            }
            return result;
        } else {
            this.raiseException("target is not a string");
        }
    };

    makeCharArrayFromString(str: string, typename?: CBasicType): ArrayVariable {
        // if (!typename) { typename = this.detectWideCharacters(str) ? "wchar_t" : "char"; }
        if (!typename) { typename = "char"; }
        const charType = this.primitiveType(typename);
        const type = this.arrayPointerType(charType, str.length + 1);
        const trailingZero = this.val(charType, 0);
        return {
            t: type,
            v: {
                target: str.split("").map(c => this.val(charType, c.charCodeAt(0))).concat([trailingZero]),
                position: 0,
            }
        };
    };*/

    detectWideCharacters(str: string): boolean {
        const wideCharacterRange = /[\u0100-\uffff]/;

        return wideCharacterRange.test(str);
    }

    /*callConstructor(type: ClassType, args: Variable[], left = false): Variable {
        const ret = this.val(type, { members: {} }, left);
        this.types[this.getTypeSignature(type)].cConstructor(this, ret, args);
        return ret;
    };*/

    /** Safely accesses values.
      * Panics if value is uninitalised. */
    value(variable: ArithmeticVariable): number {
        if (variable.v.value === null) {
            this.raiseException("Access of an uninitialised value")
        }
        return variable.v.value;
    }

    defaultValue(type: ObjectType, left = false): Variable {
        let classType : ClassType | null;
        let pointerType : PointerType | null;
        if (type.sig in variables.arithmeticSig) {
            return variables.arithmetic(type.sig as ArithmeticSig, null, left, true);
        } else if ((classType = variables.asClassType(type)) !== null) {
            const value = variables.class(classType, {}, left);
            this.getOpByParams("{global}", "o(_ctor)", [value]).target(this, value);
            return value;
        } else if ((pointerType = variables.asPointerType(type)) !== null) {
            this.raiseException("Not yet implemented");
            /*} else if (type.ptrType === "array") {
                const init = [];
                for (let i = 0, end = type.size, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                    init[i] = this.defaultValue(type.eleType, true);
                }
                return this.val(type, this.makeArrayPointerValue(init, 0), left);
            } else if (type.ptrType === "function") {
                return this.val(this.functionPointerType(type.targetType.retType, type.targetType.signature), this.makeFunctionPointerValue(null, null, null, type.targetType.signature, type.targetType.retType));
            }*/
        }
        this.raiseException("Not yet implemented");
    };

    raiseException(message: string, currentNode?: any): never {
        if (this.interp) {
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
                        return ln + ":" + col;
                    } else {
                        return "<position unavailable>";
                    }
                })();
            throw new Error(posInfo + " " + message);
        } else {
            throw new Error(message);
        }
    };

    raiseSoftException(message: string, currentNode?: any) {
        if (this.interp) {
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
                        return ln + ":" + col;
                    } else {
                        return "<position unavailable>";
                    }
                })();
            console.error(posInfo + " " + message);
        } else {
            console.error(message);
        }
    };

}

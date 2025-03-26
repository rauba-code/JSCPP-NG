import * as defaults from "./defaults";
import * as Flatted from 'flatted';
import { constructTypeParser, LLParser, parse } from './typecheck';
import { BaseInterpreter, Interpreter } from "./interpreter";
import { resolveIdentifier } from "./includes/shared/string_utils";
import { AnyType, ArithmeticSig, ArithmeticType, ArithmeticVariable, CFunction, ClassType, Function, FunctionType, IndexPointerVariable, MaybeLeft, MaybeLeftCV, ObjectType, PointerType, StaticArrayType, Variable, variables, VoidType } from "./variables";
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

export type OpSignature = "o(_--)" | "o(--_)" | "o(_-_)" | "o(-_)" | "o(_-=_)" | "o(_->_)" | "o(_,_)" | "o(!_)" | "o(_!=_)" | "o(_())" | "o(_[])" | "o(*_)" | "o(_*_)" | "o(_*=_)" | "o(_/_)" | "o(_/=_)" | "o(_&_)" | "o(&_)" | "o(_&=_)" | "o(_%_)" | "o(_%=_)" | "o(_^_)" | "o(_^=_)" | "o(_+_)" | "o(+_)" | "o(_++)" | "o(++_)" | "o(_+=_)" | "o(_<_)" | "o(_<<_)" | "o(_<<=_)" | "o(_<=_)" | "o(_=_)" | "o(_==_)" | "o(_>_)" | "o(_>=_)" | "o(_>>_)" | "o(_>>=_)" | "o(_|_)" | "o(_|=_)" | "o(~_)";

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
    target: CFunction,
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
    typeMap: { [domainTypeStringSequence: string]: TypeHandlerMap };
    typedefs: { [name: string]: AnyType };
    interp: BaseInterpreter;

    constructor(config: JSCPPConfig) {
        this.parser = constructTypeParser();
        this.config = defaults.getDefaultConfig();
        mergeConfig(this.config, config);
        //this.types = defaults.getDefaultTypes();
        this.typeMap = {};
        this.typeMap["global"] = {
            functionDB: new TypeDB(this.parser),
            functionsByID: []
        };

        this.scope = [{ "$name": "global", variables: {} }];
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

    /** This function is only used when defining a function with an exact type. For matching, use TypeDB-associated functions */
    createFunctionTypeSignature(domain: ClassType | "global", retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[]): TypeSignature {
        const thisSig: string[] = (domain === "global") ? [] : variables.toStringSequence(domain, true);
        const returnSig: string[] = retType === "VOID" ? [ retType ] : variables.toStringSequence(retType.t, retType.left);
        const argTypeSig: string[][] = argTypes.map((x) => variables.toStringSequence(x.t, x.left));
        const result : string[] = [ [ [ "FUNCTION" ], returnSig, [ "(" ], thisSig ], argTypeSig, [ [ ")" ] ] ].flat().flat();
        return this.typeSignature(result);
    }

    defFunc(domain: ClassType | "global", name: string, retType: MaybeLeft<ObjectType> | "VOID", argTypes: MaybeLeftCV<ObjectType>[], argNames: string[], stmts: any, interp: Interpreter): void {
        if (stmts != null) {
            const f = function*(rt: CRuntime, _this: Variable, ...args: Variable[]) {
                // logger.warn("calling function: %j", name);
                rt.enterScope("function " + name);
                argNames.forEach(function(argName, i) {
                    args[i].readonly = argTypes[i].readonly;
                    rt.defVar(argName, args[i]);
                });
                let ret = yield* interp.run(stmts, interp.source, { scope: "function" });
                if (retType === "VOID") {
                    if (ret instanceof Array && (ret[0] === "return")) {
                        ret = rt.cast(retType, ret[1]);
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
            const fnsig = this.createFunctionTypeSignature(domain, retType, argTypes);

            this.regFunc(f, domain, name, fnsig);
        } else {
            this.raiseException("Not yet implemented");
            //this.regFuncPrototype(lt, name, argTypes, retType);
        }
    };

    getFuncByParams(domain: ClassType | "global", identifier: string, params: Variable[]): FunctionSymbol {
        const domainInlineSig: string = (domain === "global") ? domain : variables.toStringSequence(domain, false).join(" ");
        if (!(domainInlineSig in this.typeMap)) {
            this.raiseException(`domain '${domainInlineSig}' is unknown`);
        }
        const domainMap: TypeHandlerMap = this.typeMap[domainInlineSig];
        const fnID = domainMap.functionDB.matchFunctionByParams(identifier, params.map((x) => variables.toStringSequence(x.t, x.left)));
        if (fnID < 1) {
            this.raiseException(`No matching function '(${domainInlineSig})::${identifier}'`);
        }
        console.log(`getfunc: '(${domainInlineSig})::${identifier}'`);
        return domainMap.functionsByID[fnID];
    };


    makeOperatorFuncName = (name: string) => `o(${name})`;

    /*regOperator(f: CFunction, lt: VariableType, name: string, args: VariableType[], retType: VariableType) {
        return this.regFunc(f, lt, this.makeOperatorFuncName(name), args, retType);
    };*/

    /*regFuncPrototype(f: CFunction, domain: ClassType | "global", name: string, fnsig: TypeSignature) {
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.typeMap) {
            const t = this.types[ltsig].handlers;
            if (!(name in t)) {
                t[name] = {
                    functions: {},
                    reg: {},
                };
            }
            if (!("reg" in t[name])) {
                t[name]["reg"] = {};
            }
            const sig = this.makeParametersSignature(args);
            if (sig in t[name]) {
                this.raiseException("method " + name + " with parameters (" + sig + ") is already defined");
            }
            const type = this.functionType(retType, args);
            if (lt === "global") {
                this.defVar(name, type, this.val(type, {
                    bindThis: null,
                    defineType: lt,
                    name,
                    target: null
                }));
            }
            t[name].functions[sig] = null;
            if (t[name].reg[sig] == null) {
                t[name].reg[sig] = {
                    args,
                    optionalArgs
                };
            }
        } else {
            this.raiseException("type " + this.makeTypeString(lt) + " is unknown");
        }
    };*/

    regFunc(f: CFunction, domain: ClassType | "global", name: string, fnsig: TypeSignature) {
        const domainInlineSig: string = (domain === "global") ? domain : variables.toStringSequence(domain, false).join(" ");
        if (!(domainInlineSig in this.typeMap)) {
            this.raiseException(`type '${fnsig.inline}' is unknown`);
        }
        const domainMap: TypeHandlerMap = this.typeMap[domainInlineSig];
        console.log(`regfunc: '${fnsig.inline}'`);

        try {
            const existingOverloadID: number = domainMap.functionDB.matchFunctionExact(name, fnsig.array);
            if (existingOverloadID !== -1) {
                const existingOverloadType: string = domainMap.functionsByID[existingOverloadID].type.join(" ");
                this.raiseException(`Overloaded function '(${domainInlineSig})::${name}' of type '${fnsig.inline}' is re-declared or already covered by the type '${existingOverloadType}'`)
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

    inrange(va: Variable, errorMsg?: string) {
        const ar: ArithmeticVariable | null = variables.asArithmetic(va);
        if (ar !== null) {
            const properties = variables.arithmeticProperties[ar.t.sig];
            const overflow = !((ar.v.value <= properties.maxv) && (ar.v.value >= properties.minv));
            if (errorMsg && overflow) {
                if (properties.isSigned === false) {
                    if (this.config.unsigned_overflow === "error") {
                        console.error(errorMsg);
                        this.raiseException(errorMsg);
                    } else if (this.config.unsigned_overflow === "warn") {
                        console.error(errorMsg);
                        return true;
                    } else {
                        return true;
                    }
                } else {
                    this.raiseException(errorMsg);
                }
            }
            return !overflow;
        }
        return true;
    };

    /*ensureUnsigned(type: VariableType, value: BasicValue) {
        value = this.booleanToNumber(value);
        if (this.isUnsignedType(type)) {
            const limit = this.config.limits[type.name];
            const period = limit.max - limit.min;
            if (value < limit.min) {
                value += period * Math.ceil((limit.min - value) / period);
            }
            if (value > limit.max) {
                value = ((value - limit.min) % period) + limit.min;
            }
        }
        return value;
    };*/

    castable(type1: ObjectType, type2: ObjectType) {
        // TODO: unweird this function
        if (variables.typesEqual(type1, type2)) {
            return true;
        }
        let ptr1 : PointerType | null;
        let ptr2 : PointerType | null;
        let class1 : ClassType | null;
        let class2 : ClassType | null;
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

    cast(type: IntType, value: Variable): IntVariable;
    cast(type: VariableType, value: Variable): Variable;
    cast(type: VariableType, value: Variable) {
        // TODO: looking for global overload
        let v;
        if (value.t !== "dummy") {
        } else {
            this.raiseException(this.makeValString(value) + " is dummy");
            return;
        }
        if (this.isTypeEqualTo(value.t, type)) {
            if (this.isStructType(type) && value.left && (value as any).array == null) {
                return this.cloneDeep(value);
            }
            return value;
        }
        if (this.isPrimitiveType(type) && this.isPrimitiveType(value.t)) {
            if (type.name === "bool") {
                return this.val(type, value.v ? 1 : 0);
            } else if (["float", "double"].includes(type.name)) {
                if (!this.isNumericType(value)) {
                    this.raiseException("cannot cast " + this.makeValueString(value) + " to " + this.makeTypeString(type));
                } else if (this.inrange(type, value.v, "overflow when casting " + this.makeTypeString(value?.t) + " to " + this.makeTypeString(type))) {
                    value.v = this.ensureUnsigned(type, value.v);
                    return this.val(type, value.v);
                }
            } else {
                if (type.name.slice(0, 8) === "unsigned") {
                    if (!this.isNumericType(value)) {
                        this.raiseException("cannot cast " + this.makeValueString(value) + " to " + this.makeTypeString(type));
                    } else if (value.v < 0) {
                        const { bytes } = this.config.limits[type.name];
                        let newValue = this.booleanToNumber(value.v) & ((1 << (8 * bytes)) - 1); // truncates
                        if (this.inrange(type, newValue, `cannot cast negative value ${newValue} to ` + this.makeTypeString(type))) {
                            newValue = this.ensureUnsigned(type, newValue);
                            // unsafe! bitwise truncation is platform dependent
                            return this.val(type, newValue);
                        }
                    }
                }
                if (!this.isNumericType(value)) {
                    this.raiseException("cannot cast " + this.makeValueString(value) + " to " + this.makeTypeString(type));
                } else if (this.isFloatType(value)) {
                    v = value.v > 0 ? Math.floor(this.booleanToNumber(value.v)) : Math.ceil(this.booleanToNumber(value.v));
                    if (this.inrange(type, v, "overflow when casting " + this.makeValString(value) + " to " + this.makeTypeString(type))) {
                        v = this.ensureUnsigned(type, v);
                        return this.val(type, v);
                    }
                } else {
                    if (this.inrange(type, value.v, "overflow when casting " + this.makeValString(value) + " to " + this.makeTypeString(type))) {
                        value.v = this.ensureUnsigned(type, value.v);
                        return this.val(type, value.v);
                    }
                }
            }
        } else if (this.isPrimitiveType(type) && this.isArrayType(value)) {
            if (this.isTypeEqualTo(type, value.t.eleType)) {
                return value;
            }
        } else if (this.isStructType(type)) {
            return value;
        } else if (this.isReferenceType(type)) {
            return value;
        } else if (this.isPointerType(type)) {
            if (this.isArrayType(value)) {
                if (this.isNormalPointerType(type)) {
                    if (this.isTypeEqualTo(type.targetType, value.t.eleType)) {
                        return value;
                    } else {
                        this.raiseException(this.makeTypeString(type?.targetType) + " is not equal to array element type " + this.makeTypeString(value?.t.eleType));
                    }
                } else if (this.isArrayType(type)) {
                    if (this.isTypeEqualTo(type.eleType, value.t.eleType)) {
                        return value;
                    } else {
                        this.raiseException("array element type " + this.makeTypeString(type?.eleType) + " is not equal to array element type " + this.makeTypeString(value?.t.eleType));
                    }
                } else {
                    this.raiseException("cannot cast a function to a regular pointer");
                }
            } else {
                if (this.isNormalPointerType(type)) {
                    if (this.isNormalPointerType(value)) {
                        if (this.isTypeEqualTo(type.targetType, value.t.targetType)) {
                            return value;
                        } else {
                            this.raiseException(this.makeTypeString(type?.targetType) + " is not equal to " + this.makeTypeString(value?.t.targetType));
                        }
                    } else {
                        this.raiseException(this.makeValueString(value) + " is not a normal pointer");
                    }
                } else if (this.isArrayType(type)) {
                    if (this.isNormalPointerType(value)) {
                        if (this.isTypeEqualTo(type.eleType, value.t.targetType)) {
                            return value;
                        } else {
                            this.raiseException("array element type " + this.makeTypeString(type?.eleType) + " is not equal to " + this.makeTypeString(value?.t.targetType));
                        }
                    } else {
                        this.raiseException(this.makeValueString(value) + " is not a normal pointer");
                    }
                } else if (this.isFunctionPointerType(type)) {
                    if (this.isFunctionPointerType(value.t)) {
                        if (!this.isTypeEqualTo(type, value.t)) {
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
        } else if (this.isFunctionType(type)) {
            if (this.isFunctionType(value.t)) {
                return this.val(value.t, value.v);
            } else {
                this.raiseException("cannot cast a regular pointer to a function");
            }
        } else if (this.isClassType(type)) {
            if (this.isStringClass(type)) {
                return this.val(type, value.v);
            } else if (this.isVectorClass(type)) {
                return this.val(type, value.v);
            } else {
                this.raiseException("not implemented");
            }
        } else if (this.isClassType(value.t)) {
            value = this.getCompatibleFunc(value.t, this.makeOperatorFuncName(type.name), [])(this, value);
            return value;
        } else {
            this.raiseException("cast failed from type " + this.makeTypeString(type) + " to " + this.makeTypeString(value?.t));
        }
    };

    cloneDeep(obj: any): Object {
        return Flatted.parse(Flatted.stringify(obj));
    };

    clone(v: Variable, isInitializing?: boolean) {
        return this.val(v.t, v.v, false, isInitializing);
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

    newStruct(structname: string, members: Member[]) {
        const clsType: StructType = {
            type: "struct",
            name: structname
        };

        const sig = this.getTypeSignature(clsType);
        if (sig in this.types) {
            this.raiseException(this.makeTypeString(clsType) + " is already defined");
        }

        this.types[sig] = {
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
        };
        return clsType;
    };

    newClass(classname: string, members: Member[]) {
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
    };

    getStringFromCharArray(element: ArrayVariable) {
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
    };

    detectWideCharacters(str: string): boolean {
        const wideCharacterRange = /[\u0100-\uffff]/;

        return wideCharacterRange.test(str);
    }

    /*callConstructor(type: ClassType, args: Variable[], left = false): Variable {
        const ret = this.val(type, { members: {} }, left);
        this.types[this.getTypeSignature(type)].cConstructor(this, ret, args);
        return ret;
    };*/

    defaultValue(type: ObjectType, left = false): Variable {
        const classType = variables.asClassType(type);
        if (type.sig in variables.arithmeticSig) {
            return variables.arithmetic(type.sig as ArithmeticSig, 0, left, true);
        } else if (classType !== null) {
            const value = variables.class(classType, {}, left);
            this.typeMap[variables.toStringSequence(classType, left).join(" ")].cConstructor(this, value);
            return value;
        } else if (type.type === "pointer") {
            if (type.ptrType === "normal") {
                return this.val(type, this.makeNormalPointerValue(null), left);
            } else if (type.ptrType === "array") {
                const init = [];
                for (let i = 0, end = type.size, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                    init[i] = this.defaultValue(type.eleType, true);
                }
                return this.val(type, this.makeArrayPointerValue(init, 0), left);
            } else if (type.ptrType === "function") {
                return this.val(this.functionPointerType(type.targetType.retType, type.targetType.signature), this.makeFunctionPointerValue(null, null, null, type.targetType.signature, type.targetType.retType));
            }
        }
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

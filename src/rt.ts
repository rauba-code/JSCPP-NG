import * as defaults from "./defaults";
import * as Flatted from 'flatted';
import * as typecheck from './typecheck';
import * as typedb from './typedb';
import { BaseInterpreter, Interpreter } from "./interpreter";
import { resolveIdentifier } from "./includes/shared/string_utils";
import { AnyType, ArithmeticSig, ClassType, IndexPointerVariable, ObjectType, Variable, variables } from "./variables";
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

export class CRuntime {
    config: JSCPPConfig;
    numericTypeOrder: string[];
    scope: RuntimeScope[];
    namespace: NamespaceScope;
    typedefs: { [name: string]: AnyType };
    interp: BaseInterpreter;

    constructor(config: JSCPPConfig) {
        this.config = defaults.getDefaultConfig();
        mergeConfig(this.config, config);
        this.numericTypeOrder = defaults.numericTypeOrder;
        //this.types = defaults.getDefaultTypes();

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

    getSize(_element: Variable) {
        throw new Error("Not yet implemented");
        /*let ret = 0;
        if (this.isArrayType(element) && (element.v.position === 0)) {
            let i = 0;
            while (i < element.v.target.length) {
                ret += this.getSize(element.v.target[i]);
                i++;
            }
        } else {
            ret += this.getSizeByType(element.t);
        }
        return ret;*/
    };

    getSizeByType(_t: ObjectType) {
        throw new Error("Not yet implemented");
        /*if (this.isPointerType(t)) {
            return this.config.limits["pointer"].bytes;
        } else if (this.isPrimitiveType(t)) {
            return this.config.limits[t.name].bytes;
        } else {
            this.raiseException("not implemented");
        }*/
    };

    asCapturedVariable(x: Variable): Variable {
        const iptr: IndexPointerVariable | null = variables.asIndexPointer(x);
        if (iptr === null) {
            return x;
        } else {
            const idx : number = iptr.v.index;
            const len : number = iptr.v.pointee.values.length;
            if (idx >= len) {
                this.raiseException(`index out of bounds access: ${idx} >= ${len}`);
            } else if (iptr.v.index < 0) {
                this.raiseException(`access of negative index: ${idx}`);
            }
            const t = iptr.t.array.object;
            const v = iptr.v.pointee.values[idx];
            return { t, v, left: true, readonly: iptr.readonly } as Variable;
        }
    }

    getMember(l: Variable, _r: string): Variable {
        l = this.asCapturedVariable(l);
        let lc = variables.asClass(l);
        if (lc !== null) {
            if (!lc.left) {
                this.raiseException("Access to a member of a non-lvalue variable is forbidden");
            }
            //const ltsig : string[] = variables.toStringSequence(lc.t, true)
            throw new Error("Not yet implemented");
            /*const ltsig = this.getTypeSignature(lc.t);
            if (this.types.hasOwnProperty(ltsig)) {
                const t = this.types[ltsig].handlers;
                if (t.hasOwnProperty(r)) {
                    return {
                        t: {
                            type: "function",
                        },
                        v: {
                            defineType: lt,
                            name: r,
                            bindThis: l
                        }
                    };
                } else {
                    if (l.v.members.hasOwnProperty(r)) {
                        return l.v.members[r];
                    } else {
                        this.raiseException("type '" + this.makeTypeString(lt) + "' does not have a member named '" + r + "'")
                    }

                }
            } else {
                this.raiseException("type '" + this.makeTypeString(lt) + "' is unknown");
            }*/
        } else {
            this.raiseException("only a class or struct can have members");
        }
    };

    defFunc(lt: ClassType | null, name: string, retType: ObjectType, argTypes: ObjectType[], argNames: string[], stmts: any, interp: Interpreter, readonlyArgs: boolean[]) {
        if (stmts != null) {
            const f = function*(rt: CRuntime, _this: Variable, ...args: Variable[]) {
                // logger.warn("calling function: %j", name);
                rt.enterScope("function " + name);
                argNames.forEach(function(argName, i) {
                    args[i].readonly = readonlyArgs[i];
                    rt.defVar(argName, argTypes[i], args[i]);
                });
                let ret = yield* interp.run(stmts, interp.source, { scope: "function" });
                if (!rt.isTypeEqualTo(retType, rt.voidTypeLiteral)) {
                    if (ret instanceof Array && (ret[0] === "return")) {
                        ret = rt.cast(retType, ret[1]);
                    } else {
                        rt.raiseException("you must return a value");
                    }
                } else {
                    if (Array.isArray(ret)) {
                        if ((ret[0] === "return") && ret[1]) {
                            rt.raiseException("you cannot return a value from a void function");
                        }
                    }
                    ret = undefined;
                }
                rt.exitScope("function " + name);
                // logger.warn("function: returing %j", ret);
                return ret;
            };

            this.regFunc(f, lt, name, argTypes, retType, optionalArgs);
        } else {
            this.regFuncPrototype(lt, name, argTypes, retType, optionalArgs);
        }
    };

    makeParametersSignature(args: (VariableType | "?" | "dummy")[]) {
        const ret = new Array(args.length);
        let i = 0;
        while (i < args.length) {
            const arg = args[i];
            ret[i] = this.getTypeSignature(arg);
            i++;
        }
        return ret.join(",");
    };

    getCompatibleFunc(lt: VariableType | "global", name: string, args: (Variable | DummyVariable)[]) {
        let ret;
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            const t = this.types[ltsig].handlers;
            if (name in t) {
                // logger.info("method found");
                const ts = args.map(v => v.t);
                const sig = this.makeParametersSignature(ts);
                if (sig in t[name].functions) {
                    ret = t[name].functions[sig];
                } else {
                    const compatibles: CFunction[] = [];
                    const reg = t[name].reg;
                    Object.keys(reg).forEach(signature => {
                        let newTs: (VariableType | "dummy")[];
                        const regArgInfo = reg[signature];
                        const dts = regArgInfo.args;
                        let newDts: (VariableType | "dummy")[];
                        const {
                            optionalArgs
                        } = regArgInfo;
                        if ((dts[dts.length - 1] === "?") && ((dts.length - 1) <= ts.length)) {
                            newTs = ts.slice(0, dts.length - 1);
                            newDts = dts.slice(0, -1) as VariableType[];
                        } else {
                            newTs = ts;
                            newDts = dts as VariableType[];
                        }
                        if (newDts.length <= newTs.length) {
                            let ok = true;
                            let i = 0;
                            while (ok && (i < newDts.length)) {
                                ok = this.castable(newTs[i], newDts[i]);
                                i++;
                            }
                            while (ok && (i < newTs.length)) {
                                ok = this.castable(newTs[i], optionalArgs[i - newDts.length].type);
                                i++;
                            }
                            if (ok) {
                                compatibles.push(t[name].functions[this.makeParametersSignature(regArgInfo.args)]);
                            }
                        }
                    });
                    if (compatibles.length === 0) {
                        if ("#default" in t[name]) {
                            ret = t[name].functions["#default"];
                        } else {
                            const argsStr = ts.map(v => {
                                return this.makeTypeString(v);
                            }).join(", ");
                            this.raiseException("no method " + name + " in " + this.makeTypeString(lt) + " accepts " + argsStr);
                        }
                    } else if (compatibles.length > 1) {
                        this.raiseException("ambiguous method invoking, " + compatibles.length + " compatible methods");
                    } else {
                        ret = compatibles[0];
                    }
                }
            } else {
                this.raiseException("method " + name + " is not defined in " + this.makeTypeString(lt));
            }
        } else {
            this.raiseException("type " + this.makeTypeString(lt) + " is unknown");
        }
        if ((ret == null)) {
            this.raiseException("method " + name + " does not seem to be implemented");
        }
        return ret;
    };

    matchVarArg(methods: OpHandler, sig: string) {
        for (let _sig in methods) {
            if (_sig[_sig.length - 1] === "?") {
                _sig = _sig.slice(0, -1);
                if (sig.startsWith(_sig)) {
                    return methods.functions[_sig];
                }
            }
        }
        return null;
    };

    getFunc(lt: (VariableType | "global"), name: string, args: (VariableType | "dummy")[]) {
        if (lt !== "global" && (this.isPointerType(lt) || this.isFunctionType(lt))) {
            let f;
            if (this.isArrayType(lt)) {
                f = "pointer_array";
            } else if (this.isFunctionType(lt)) {
                f = "function";
            } else {
                f = "pointer_normal";
            }
            let t = null;
            if (name in this.types[f].handlers) {
                t = this.types[f].handlers;
            } else if (name in this.types["pointer"].handlers) {
                t = this.types["pointer"].handlers;
            }
            if (t) {
                const sig = this.makeParametersSignature(args);
                let method;
                if (t[name].functions != null && sig in t[name].functions) {
                    return t[name].functions[sig];
                } else if ((method = this.matchVarArg(t[name], sig)) !== null) {
                    return method;
                } else if (t[name].default) {
                    return t[name].default;
                } else {
                    this.raiseException("no method " + name + " in " + this.makeTypeString(lt) + " accepts (" + sig + ")");
                }
            }
        }
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            const t = this.types[ltsig].handlers;
            if (name in t) {
                const sig = this.makeParametersSignature(args);
                let method;
                if (t[name].functions != null && sig in t[name].functions) {
                    return t[name].functions[sig];
                } else if ((method = this.matchVarArg(t[name], sig)) !== null) {
                    return method;
                } else if (t[name].default) {
                    return t[name].default;
                } else {
                    this.raiseException("no method " + name + " in " + this.makeTypeString(lt) + " accepts (" + sig + ")");
                }
            } else {
                this.raiseException("method " + name + " is not defined in " + this.makeTypeString(lt));
            }
        } else {
            if (lt !== "global" && this.isPointerType(lt)) {
                this.raiseException("this pointer has no proper method overload");
            } else {
                this.raiseException("type " + this.makeTypeString(lt) + " is not defined");
            }
        }
    };

    makeOperatorFuncName = (name: string) => `o(${name})`;

    regOperator(f: CFunction, lt: VariableType, name: string, args: VariableType[], retType: VariableType) {
        return this.regFunc(f, lt, this.makeOperatorFuncName(name), args, retType);
    };

    regFuncPrototype(lt: VariableType | "global", name: string, args: VariableType[], retType: VariableType, optionalArgs?: OptionalArg[]) {
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
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
    };

    regFunc(f: CFunction, lt: VariableType | "global", name: string, args: (VariableType | "?")[], retType: VariableType, optionalArgs?: OptionalArg[]) {
        const ltsig = this.getTypeSignature(lt);
        if (ltsig in this.types) {
            if (!optionalArgs) { optionalArgs = []; }
            const t = this.types[ltsig].handlers;
            if (!(name in t)) {
                t[name] = {
                    functions: {},
                    reg: {},
                };
            }
            if (t[name].functions == null) {
                t[name].functions = {};
            }
            if (t[name].reg == null) {
                t[name].reg = {};
            }
            const sig = this.makeParametersSignature(args);
            // console.log("regFunc " + name + "(" + sig + ")");
            if (t[name].functions[sig] != null && t[name].reg[sig] != null) {
                this.raiseException("method " + name + " with parameters (" + sig + ") is already defined");
            }
            const type = this.functionType(retType, args);
            if (lt === "global") {
                if (this.varAlreadyDefined(name)) {
                    const func = this.scope[0].variables[name];
                    if (this.isFunctionType(func)) {
                        const v = func.v;
                        if (v.target !== null) {
                            this.raiseException("global method " + name + " with parameters (" + sig + ") is already defined");
                        } else {
                            v.target = f;
                        }
                    } else {
                        this.raiseException(name + " is already defined as " + this.makeTypeString(func?.t));
                    }
                } else {
                    this.defVar(name, type, this.val(type, {
                        bindThis: null,
                        defineType: lt,
                        name,
                        target: f
                    }));
                }
            }
            t[name].functions[sig] = f;
            t[name].reg[sig] = {
                args,
                optionalArgs
            };
        } else {
            this.raiseException("type " + this.makeTypeString(lt) + " is unknown");
        }
    };

    registerTypedef(basttype: VariableType, name: string) {
        return this.typedefs[name] = basttype;
    };

    promoteNumeric(l: VariableType, r: VariableType) {
        if (this.isNumericType(l) && this.isNumericType(r)) {
            if (this.isTypeEqualTo(l, r)) {
                if (this.isTypeEqualTo(l, this.boolTypeLiteral)) {
                    return this.intTypeLiteral;
                }
                if (this.isTypeEqualTo(l, this.charTypeLiteral)) {
                    return this.intTypeLiteral;
                }
                if (this.isTypeEqualTo(l, this.unsignedcharTypeLiteral)) {
                    return this.unsignedintTypeLiteral;
                }
                return l;
            } else if (this.isIntegerType(l) && this.isIntegerType(r)) {
                let rett;
                const slt = this.getSignedType(l);
                const srt = this.getSignedType(r);
                if (this.isTypeEqualTo(slt, srt)) {
                    rett = slt;
                } else {
                    const slti = this.numericTypeOrder.indexOf(slt.name);
                    const srti = this.numericTypeOrder.indexOf(srt.name);
                    if (slti <= srti) {
                        if (this.isUnsignedType(l) && this.isUnsignedType(r)) {
                            rett = r;
                        } else {
                            rett = srt;
                        }
                    } else {
                        if (this.isUnsignedType(l) && this.isUnsignedType(r)) {
                            rett = l;
                        } else {
                            rett = slt;
                        }
                    }
                }
                return rett;
            } else if (!this.isIntegerType(l) && this.isIntegerType(r)) {
                return l;
            } else if (this.isIntegerType(l) && !this.isIntegerType(r)) {
                return r;
            } else if (!this.isIntegerType(l) && !this.isIntegerType(r)) {
                return this.primitiveType("double");
            }
        } else {
            this.raiseException("you cannot promote (to) a non numeric type");
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

    varAlreadyDefined(varname: string) {
        const vc = this.scope[this.scope.length - 1];
        return varname in vc;
    };

    defVar(varname: string, type: VariableType, initval: Variable) {
        initval = this.captureValue(initval);
        if (varname == null) {
            this.raiseException("cannot define a variable without name");
        }
        if (this.varAlreadyDefined(varname)) {
            this.raiseException("variable " + varname + " already defined");
        }

        const dataType = initval.dataType;
        const readonly = initval.readonly;
        const vc = this.scope[this.scope.length - 1];
        // logger.log("defining variable: %j, %j", varname, type);
        if (this.isReferenceType(type)) {
            initval = this.cast(type, initval);
        } else {
            initval = this.clone(this.cast(type, initval), true);
        }

        vc.variables[varname] = initval === undefined ? this.defaultValue(type) : initval;
        vc.variables[varname].readonly = readonly;
        vc.variables[varname].left = true;
        if (dataType)
            vc.variables[varname].dataType = dataType;
    };

    booleanToNumber(b: BasicValue) {
        if (typeof (b) === "boolean") {
            return b ? 1 : 0;
        }
        return b;
    }

    inrange(type: VariableType, value: BasicValue, errorMsg?: string) {
        if (this.isPrimitiveType(type)) {
            value = this.booleanToNumber(value);
            const limit = this.config.limits[type.name];
            const overflow = !((value <= limit.max) && (value >= limit.min));
            if (errorMsg && overflow) {
                if (this.isUnsignedType(type)) {
                    if (this.config.unsigned_overflow === "error") {
                        console.error(errorMsg);
                        this.raiseException(errorMsg);
                        return false;
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
        } else {
            return true;
        }
    };

    ensureUnsigned(type: VariableType, value: BasicValue) {
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
    };

    getSignedType(type: VariableType): PrimitiveType {
        if (type.type === "primitive") {
            return this.primitiveType(type.name.replace("unsigned", "").trim() as CBasicType);
        } else {
            this.raiseException("Cannot get signed type from non-primitive type " + this.makeTypeString(type));
        }
    };

    castable(type1: VariableType | "dummy", type2: VariableType | "dummy") {
        if (type1 === "dummy" || type2 === "dummy") {
            this.raiseException("Unexpected dummy");
            return;
        }
        if (this.isTypeEqualTo(type1, type2)) {
            return true;
        }
        if (this.isPrimitiveType(type1) && this.isPrimitiveType(type2)) {
            return this.isNumericType(type2) && this.isNumericType(type1);
        } else if (this.isPointerType(type1) && this.isPointerType(type2)) {
            if (this.isFunctionType(type1)) {
                return this.isPointerType(type2);
            }
            return !this.isFunctionType(type2);
        } else if (this.isStringType(type1) && this.isStringType(type2)) {
            return true;
        } else if (this.isClassType(type1) && this.isClassType(type2)) {
            return true;
        } else if (this.isPrimitiveType(type1) && this.isReferenceType(type2)) {
            return true;
        } else if (this.isClassType(type1) || this.isClassType(type2)) {
            this.raiseException("not implemented");
        }
        return false;
    };

    cast(type: IntType, value: Variable | DummyVariable): IntVariable;
    cast(type: VariableType, value: Variable | DummyVariable): Variable;
    cast(type: VariableType, value: Variable | DummyVariable) {
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

    makeConstructor(type: VariableType, args: Variable[], left = false): Variable {
        const ret = this.val(type, { members: {} }, left);
        this.types[this.getTypeSignature(type)].cConstructor(this, ret, args);
        return ret;
    };

    defaultValue(type: VariableType, left = false): Variable {
        if (type.type === "primitive") {
            return this.val(type, 0, left, true);
        } else if (type.type === "class" || type.type === "struct") {
            const ret = this.val(type, { members: {} }, left);
            this.types[this.getTypeSignature(type)].cConstructor(this, ret);
            return ret;
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

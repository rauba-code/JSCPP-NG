import { CRuntime } from "./rt"

const arithmeticSig = {
    "I8": {},
    "U8": {},
    "I16": {},
    "U16": {},
    "I32": {},
    "U32": {},
    "I64": {},
    "U64": {},
    "F32": {},
    "F64": {},
    "BOOL": {},
} as const;

export interface ArithmeticProperties {
    readonly name: string,
    readonly isSigned: boolean,
    readonly isFloat: boolean,
    readonly bytes: number,
    readonly minv: number,
    readonly maxv: number,
    readonly asSigned: ArithmeticSig
}

const arithmeticProperties: { [x in ArithmeticSig]: ArithmeticProperties } = {
    "I8": {
        name: "signed char",
        isSigned: true,
        isFloat: false,
        bytes: 1,
        minv: -128,
        maxv: 127,
        asSigned: "I8",
    },
    "U8": {
        name: "unsigned char",
        isSigned: false,
        isFloat: false,
        bytes: 1,
        minv: 0,
        maxv: 255,
        asSigned: "I8",
    },
    "I16": {
        name: "short int",
        isSigned: true,
        isFloat: false,
        bytes: 2,
        minv: -32768,
        maxv: 32767,
        asSigned: "I16",
    },
    "U16": {
        name: "unsigned short int",
        isSigned: false,
        isFloat: false,
        bytes: 2,
        minv: 0,
        maxv: 65535,
        asSigned: "I16",
    },
    "I32": {
        name: "long int",
        isSigned: true,
        isFloat: false,
        bytes: 4,
        minv: -2147483648,
        maxv: 2147483647,
        asSigned: "I32",
    },
    "U32": {
        name: "unsigned long int",
        isSigned: false,
        isFloat: false,
        bytes: 4,
        minv: 0,
        maxv: 4294967295,
        asSigned: "I32",
    },
    "I64": {
        name: "long long int",
        isSigned: true,
        isFloat: false,
        bytes: 8,
        minv: -9223372036854775808,
        maxv: 9223372036854775807,
        asSigned: "I64",
    },
    "U64": {
        name: "unsigned long long int",
        isSigned: false,
        isFloat: false,
        bytes: 8,
        minv: 0,
        maxv: 18446744073709551615,
        asSigned: "I64",
    },
    "F32": {
        name: "float",
        isSigned: true,
        isFloat: true,
        bytes: 4,
        minv: -3.4028235E+38,
        maxv: 3.4028235E+38,
        asSigned: "F32",
    },
    "F64": {
        name: "double",
        isSigned: true,
        isFloat: true,
        bytes: 8,
        minv: -10E+308,
        maxv: 10E+308,
        asSigned: "F64",
    },
    "BOOL": {
        name: "bool",
        isSigned: false,
        isFloat: false,
        bytes: 1,
        minv: 0,
        maxv: 1,
        asSigned: "I8",
    },
};

export type ArithmeticSig = keyof (typeof arithmeticSig);

const defaultArithmeticResolutionMap: { [x: string]: ArithmeticSig } = {
    "char": "I8",
    "signed char": "I8",
    "unsigned char": "U8",
    "wchar_t": "I32",
    "unsigned wchar_t": "U32",
    "short": "I16",
    "short int": "I16",
    "signed short": "I16",
    "signed short int": "I16",
    "unsigned short": "U16",
    "unsigned short int": "U16",
    "int": "I32",
    "signed int": "I32",
    "unsigned int": "U32",
    "long": "I32",
    "long int": "I32",
    "signed long": "I32",
    "signed long int": "I32",
    "unsigned long": "U32",
    "unsigned long int": "U32",
    "long long": "I64",
    "long long int": "I64",
    "signed long long": "I64",
    "signed long long int": "I64",
    "unsigned long long": "U64",
    "unsigned long long int": "U64",
    "bool": "BOOL",
    "float": "F32",
    "double": "F64",
    "long double": "F64",
}

// convenience specialisation types of the ArithmeticType

export interface I8Type { readonly sig: "I8" };
export interface I16Type { readonly sig: "I16" };
export interface I32Type { readonly sig: "I32" };
export interface I64Type { readonly sig: "I64" };
export interface U8Type { readonly sig: "U8" };
export interface U16Type { readonly sig: "U16" };
export interface U32Type { readonly sig: "U32" };
export interface U64Type { readonly sig: "U64" };
export interface F32Type { readonly sig: "F32" };
export interface F64Type { readonly sig: "F64" };
export interface BoolType { readonly sig: "BOOL" };
export type IntegerType = I8Type | I16Type | I32Type | I64Type | U8Type | U16Type | U32Type | U64Type;
export type FloatType = F32Type | F64Type;

export interface ArithmeticType {
    readonly sig: ArithmeticSig,
}

/** This includes both "class" and "struct" types */
export interface ClassType {
    readonly sig: "CLASS",
    readonly identifier: string,
    readonly templateSpec: ObjectType[],
    readonly memberOf: ClassType | null,
}

/** Templated specialisation of the `ClassType` */
export interface AbstractTemplatedClassType<TMemberOf extends (ClassType | null), T extends ObjectType[]> {
    readonly sig: "CLASS",
    readonly identifier: string,
    readonly templateSpec: T,
    readonly memberOf: TMemberOf,
}

export interface FunctionType {
    readonly sig: "FUNCTION",
    readonly fulltype: string[],
}

/** Generic interface to pointers.
  * Can define an array pointer */
export interface PointerType<TElem extends ObjectType | FunctionType> {
    readonly sig: "PTR",
    readonly pointee: TElem,
    readonly sizeConstraint: number | null,
}

export interface VoidType {
    readonly sig: "VOID",
}

/** Any type that a variable can have */
export type ObjectType = ArithmeticType | ClassType | PointerType<ArithmeticType | ClassType | FunctionType | PointerType<any>>;

/** Any type that a variable can have + direct function type + void type.
  * Do not use this for checking variables, use `ObjectType` instead. */
export type AnyType = ObjectType | FunctionType | VoidType;

/** Variable type with specified value type (lvalue or non-lvalue).
  * Intended to be implicitly cast from Variable | Function types. */
export interface MaybeLeft<T extends ObjectType> {
    readonly t: T,
    readonly v: { readonly lvHolder: LValueHolder<any> }
}

/** Variable type with specified value type (lvalue or non-lvalue)
  * and a c-v qualifier (const or volatile).
  * Intended to be implicitly cast from Variable | Function types. */
export interface MaybeLeftCV<T extends ObjectType> {
    readonly t: T,
    readonly v: { readonly lvHolder: LValueHolder<any>, readonly isConst: boolean }
}

export interface UnboundValue<VSelf extends Variable> {
    readonly lvHolder: LValueIndexHolder<VSelf>;
    readonly isConst: boolean;
    state: "UNBOUND";
}

export interface UninitValue<VSelf extends Variable> {
    readonly lvHolder: LValueHolder<VSelf>;
    readonly isConst: boolean;
    state: "UNINIT";
}

export interface InitValue<VSelf extends Variable> {
    readonly lvHolder: LValueHolder<VSelf>;
    readonly isConst: boolean;
    state: "INIT";
}

export type LValueIndexHolder<VSelf extends Variable> = { readonly array: ArrayMemory<VSelf>, readonly index: number };

export type LValueHolder<VSelf extends Variable> = LValueIndexHolder<VSelf> | "SELF" | null;

export interface InitArithmeticValue extends InitValue<ArithmeticVariable> {
    value: number;
}

export interface ArrayMemory<VElem extends PointeeVariable> {
    readonly objectType: VElem["t"];
    readonly values: VElem["v"][];
}

export interface ClassValue extends InitValue<ClassVariable> {
    members: { [name: string]: Variable };
}

export interface InitDirectPointerValue<VElem extends PointeeVariable> extends InitValue<PointerVariable<VElem>> {
    subtype: "DIRECT",
    pointee: VElem["v"];
};

export interface InitIndexPointerValue<VElem extends PointeeVariable> extends InitValue<PointerVariable<VElem>> {
    subtype: "INDEX",
    pointee: ArrayMemory<VElem>,
    index: number,
}

export type PointeeVariable = Function | ArithmeticVariable | ClassVariable | PointerVariable<Function | ArithmeticVariable | ClassVariable | PointerVariable<any>>;

export type InitPointerValue<VElem extends PointeeVariable> = InitDirectPointerValue<VElem> | InitIndexPointerValue<VElem>;

export type ArithmeticValue = InitArithmeticValue | UninitValue<ArithmeticVariable>;

export type PointerValue<VElem extends PointeeVariable> = InitPointerValue<VElem> | UninitValue<PointerVariable<VElem>>;
export type DirectPointerValue<VElem extends PointeeVariable> = InitDirectPointerValue<VElem> | UninitValue<PointerVariable<VElem>>;
export type IndexPointerValue<VElem extends PointeeVariable> = InitIndexPointerValue<VElem> | UninitValue<PointerVariable<VElem>>;

export type MaybeUnboundArithmeticValue = ArithmeticValue | UnboundValue<ArithmeticVariable>;

export type MaybeUnboundClassValue = ClassValue | UnboundValue<ClassVariable>;

export type MaybeUnboundPointerValue<VElem extends PointeeVariable> = PointerValue<VElem> | UnboundValue<PointerVariable<VElem>>;

export interface FunctionValue {
    readonly lvHolder: "SELF" | null;
    readonly isConst: boolean;
    readonly state: "INIT";
    target: CFunction | null;
    name: string;
    bindThis: ClassVariable | null;
}

export type ObjectValue = ArithmeticValue | ClassValue | PointerValue<PointeeVariable>;
export type InitObjectValue = InitArithmeticValue | ClassValue | InitPointerValue<PointeeVariable>;
export type MaybeUnboundObjectValue = MaybeUnboundArithmeticValue | MaybeUnboundClassValue | MaybeUnboundPointerValue<PointeeVariable>;

/** Determiner of referee. 
  * > `null` for non-lvalues, e.g., `6`, `"hello"`, `{ 2, -3 }` `(int)x`, `sin(x)`, etc.;
  * > `"SELF"` for independent variables in the stack, e.g., `x` (given `float x = -47.3;`);
  * > > The type of `&x` would then be `int*` (a.k.a. `PointerVariable`);
  * > > `int *z = &x; z++;` would cause an undefined behaviour;
  * > `IndexPointerValue` for array members, e.g. `a[1]` (given `int a[] = {1, 2, 3}`). 
  * > > Likewise, the type of `&x` would then be `int*` (but it's `IndexPointerVariable` in the runtime);
  * > > `int *w = &a[1]; w++;` would be okay and it would point to a[2];
*/

export interface AbstractVariable<TType, TValue> {
    readonly t: TType,
    v: TValue,
}

export type ArithmeticVariable = AbstractVariable<ArithmeticType, ArithmeticValue>;
export type Function = AbstractVariable<FunctionType, FunctionValue>;
export type ClassVariable = AbstractVariable<ClassType, ClassValue>;
export type PointerVariable<VElem extends PointeeVariable> = AbstractVariable<PointerType<VElem["t"]>, PointerValue<VElem>>;

export type InitArithmeticVariable = AbstractVariable<ArithmeticType, InitArithmeticValue>;
export type InitClassVariable = AbstractVariable<ClassType, ClassValue>;
export type InitDirectPointerVariable<VElem extends PointeeVariable> = AbstractVariable<PointerType<VElem["t"]>, InitDirectPointerValue<VElem>>;
export type InitIndexPointerVariable<VElem extends PointeeVariable> = AbstractVariable<PointerType<VElem["t"]>, InitIndexPointerValue<VElem>>;
export type InitPointerVariable<VElem extends PointeeVariable> = AbstractVariable<PointerType<VElem["t"]>, InitPointerValue<VElem>>;

export type MaybeUnboundArithmeticVariable = AbstractVariable<ArithmeticType, MaybeUnboundArithmeticValue>;
export type MaybeUnboundClassVariable = AbstractVariable<ClassType, MaybeUnboundClassValue>;
export type MaybeUnboundPointerVariable<VElem extends Variable | Function> = AbstractVariable<PointerType<VElem["t"]>, MaybeUnboundPointerValue<VElem>>;
//export type MaybeUnboundIndexPointerVariable<VElem extends Variable> = AbstractVariable<PointerType<VElem["t"]>, MaybeUnboundIndexPointerValue<VElem>>;

// Equals to 'Object' in typecheck notation
export type Variable = ArithmeticVariable | ClassVariable | PointerVariable<PointeeVariable>;
export type InitVariable = InitArithmeticVariable | InitClassVariable | InitPointerVariable<ArithmeticVariable | ClassVariable | Function | PointerVariable<any>>;
export type MaybeUnboundVariable = MaybeUnboundArithmeticVariable | MaybeUnboundClassVariable | MaybeUnboundPointerVariable<PointeeVariable>;

export type Gen<T> = Generator<unknown, T, unknown>;
export type ResultOrGen<T> = T | Gen<T>;
export type CFunction = (rt: CRuntime, ...args: Variable[]) => ResultOrGen<MaybeUnboundVariable | "VOID">;
export type CFunctionBool = (rt: CRuntime, ...args: Variable[]) => ResultOrGen<InitArithmeticVariable>;

export const variables = {
    voidType(): VoidType {
        return { sig: "VOID" };
    },
    arithmeticType(sig: ArithmeticSig): ArithmeticType {
        return { sig };
    },
    pointerType<TElem extends ObjectType | FunctionType>(pointee: TElem, sizeConstraint: number | null): PointerType<TElem> {
        return { sig: "PTR", pointee, sizeConstraint };
    },
    classType(identifier: string, templateSpec: ObjectType[], memberOf: ClassType | null): ClassType {
        return { sig: "CLASS", identifier, templateSpec, memberOf };
    },
    functionType(fulltype: string[]): FunctionType {
        return { sig: "FUNCTION", fulltype };
    },
    uninitArithmetic(sig: ArithmeticSig, lvHolder: LValueHolder<ArithmeticVariable>, isConst: boolean = false): ArithmeticVariable {
        return { t: variables.arithmeticType(sig), v: { lvHolder, state: "UNINIT", isConst } };
    },
    arithmetic(sig: ArithmeticSig, value: number, lvHolder: LValueHolder<ArithmeticVariable>, isConst: boolean = false): InitArithmeticVariable {
        return { t: variables.arithmeticType(sig), v: { lvHolder, state: "INIT", value, isConst } };
    },
    uninitPointer(object: ObjectType | FunctionType, sizeConstraint: number | null, lvHolder: LValueHolder<PointerVariable<PointeeVariable>>, isConst: boolean = false): PointerVariable<PointeeVariable> {
        return { t: variables.pointerType(object, sizeConstraint), v: { lvHolder, state: "UNINIT", isConst } };
    },
    directPointer<VElem extends PointeeVariable>(pointee: VElem, lvHolder: LValueHolder<PointerVariable<VElem>>, isConst: boolean = false): InitDirectPointerVariable<VElem> {
        const t = variables.pointerType(pointee.t, null);
        return { t, v: { lvHolder, state: "INIT", subtype: "DIRECT", pointee: pointee.v, isConst } };
    },
    indexPointer<VElem extends PointeeVariable>(pointee: ArrayMemory<VElem>, index: number, constrainSize: boolean, lvHolder: LValueHolder<PointerVariable<VElem>>, isConst: boolean = false): InitIndexPointerVariable<VElem> {
        const t = variables.pointerType(pointee.objectType, constrainSize ? (pointee.values.length - index) : null);
        return { t, v: { lvHolder, state: "INIT", subtype: "INDEX", pointee, index, isConst } };
    },
    class(t: ClassType, members: { [name: string]: Variable }, lvHolder: LValueHolder<ClassVariable>, isConst: boolean = false): InitClassVariable {
        return { t, v: { lvHolder, state: "INIT", members, isConst } };
    },
    arrayMemory<VElem extends PointeeVariable>(objectType: VElem["t"], values: VElem["v"][]): ArrayMemory<VElem> {
        return { objectType, values };
    },
    function(fulltype: string[], name: string, target: CFunction | null, bindThis: ClassVariable | null, lvHolder: "SELF" | null): Function {
        return { t: variables.functionType(fulltype), v: { lvHolder, state: "INIT", name, target, bindThis, isConst: true } };
    },
    derefDirect<VElem extends PointeeVariable>(object: InitDirectPointerVariable<VElem>): VElem {
        return {
            t: object.t.pointee,
            v: object.v.pointee,
        } as VElem;
    },
    deref<VElem extends Variable>(object: InitPointerVariable<VElem>): VElem | AbstractVariable<VElem["t"], UnboundValue<VElem>> {
        if (object.v.subtype === "DIRECT") {
            return {
                t: object.t.pointee,
                v: object.v.pointee,
            } as VElem;
        }
        return variables.arrayMember<VElem>(object.v.pointee, object.v.index);
    },
    arrayMember<VElem extends Variable>(lhs: ArrayMemory<VElem>, index: number): VElem | AbstractVariable<VElem["t"], UnboundValue<VElem>> {
        if (index >= 0 && index < lhs.values.length) {
            return { t: lhs.objectType, v: lhs.values[index] } as VElem;
        }
        return { t: lhs.objectType, v: { lvHolder: { array: lhs, index } as LValueIndexHolder<VElem>, isConst: false, state: "UNBOUND" } as UnboundValue<VElem> };
    },
    /** Create a new variable with the same type and value as the original one */
    clone<TVar extends Variable>(object: TVar, lvHolder: LValueHolder<TVar>, isConst: boolean = false, onError: (x: string) => never, allowUninit: boolean = false): TVar {
        type BranchKey = "ARITHMETIC" | "PTR" | "CLASS" | "FUNCTION";
        let branch: { [sig in BranchKey]: (x: LValueHolder<Variable>) => Variable } = {
            "ARITHMETIC": (_lvHolder: LValueHolder<InitArithmeticVariable>) => {
                const x = object as InitArithmeticVariable;
                return variables.arithmetic(x.t.sig, x.v.value, _lvHolder, isConst)
            },
            "PTR": (_lvHolder: LValueHolder<InitPointerVariable<PointeeVariable>>) => {
                const _x = object as InitPointerVariable<PointeeVariable>;
                if (_x.v.subtype === "DIRECT") {
                    const x = _x as InitDirectPointerVariable<PointeeVariable>;
                    const child = variables.derefDirect(x);
                    return variables.directPointer(child, _lvHolder, isConst);
                } else {
                    const x = _x as InitIndexPointerVariable<PointeeVariable>;
                    return variables.indexPointer(x.v.pointee, x.v.index, x.t.sizeConstraint !== null ? true : false, _lvHolder, isConst);
                }
            },
            "CLASS": (_lvHolder: LValueHolder<InitClassVariable>) => {
                const x = object as InitClassVariable;
                const members = Object.fromEntries(Object.entries(x.v.members).map(([k, v]: [string, Variable]) => [k, variables.clone(v, "SELF", false, onError, true)]));
                return variables.class(x.t, members, _lvHolder, isConst);
            },
            "FUNCTION": (_lvHolder: LValueHolder<any>) => {
                onError("not yet implemented");
            },
        }
        if (object.v.state === "UNINIT") {
            if (!allowUninit) {
                onError("Attempted clone of an uninitialised value");
            }
            branch = {
                "ARITHMETIC": (_lvHolder: LValueHolder<ArithmeticVariable>) => {
                    const x = object as ArithmeticVariable;
                    return variables.uninitArithmetic(x.t.sig, _lvHolder, isConst)
                },
                "PTR": (_lvHolder: LValueHolder<PointerVariable<PointeeVariable>>) => {
                    const x = object as PointerVariable<PointeeVariable>;
                    return variables.uninitPointer(x.t.pointee, x.t.sizeConstraint, _lvHolder, isConst);
                },
                "CLASS": () => {
                    onError("unreachable");
                },
                "FUNCTION": () => {
                    onError("unreachable");
                },
            }
        }
        if (!object.v.isConst && isConst) {
            onError("Cannot clone from a volatile variable to a constant");
        }
        const where: BranchKey = (object.t.sig in arithmeticSig) ? "ARITHMETIC" : object.t.sig as BranchKey;
        return branch[where](lvHolder) as TVar;
    },
    asVoidType(type: AnyType): VoidType | null {
        return (type.sig === "VOID") ? type as VoidType : null;
    },
    asArithmeticType(type: AnyType): ArithmeticType | null {
        return (type.sig in arithmeticSig) ? type as ArithmeticType : null;
    },
    asPointerType(type: AnyType): PointerType<ObjectType | FunctionType> | null {
        return (type.sig === "PTR") ? type as PointerType<ObjectType | FunctionType> : null;
    },
    asPointerOfElemType<TElem extends ObjectType | FunctionType>(type: AnyType, elem: TElem): PointerType<TElem> | null {
        return (type.sig === "PTR" && variables.typesEqual((type as PointerType<ObjectType | FunctionType>).pointee, elem)) ? type as PointerType<TElem> : null;
    },
    asClassType(type: AnyType): ClassType | null {
        return (type.sig === "CLASS") ? type as ClassType : null;
    },
    asFunctionType(type: AnyType): FunctionType | null {
        return (type.sig === "FUNCTION") ? type as FunctionType : null;
    },
    asArithmetic(x: Variable | Function): ArithmeticVariable | null {
        return (x.t.sig in arithmeticSig) ? x as ArithmeticVariable : null;
    },
    asInitArithmetic(x: Variable | Function): InitArithmeticVariable | null {
        return (x.t.sig in arithmeticSig && x.v.state === "INIT") ? x as InitArithmeticVariable : null;
    },
    asPointer(x: Variable | Function): PointerVariable<PointeeVariable> | null {
        return (x.t.sig === "PTR") ? x as PointerVariable<PointeeVariable> : null;
    },
    asPointerOfElem<VElem extends Variable | Function>(x: Variable | Function, elem: VElem): PointerVariable<VElem> | null {
        return (x.t.sig === "PTR" && variables.typesEqual((x as PointerVariable<Variable>).t.pointee, elem.t)) ? x as PointerVariable<VElem> : null;
    },
    asInitPointer(x: Variable | Function): InitPointerVariable<PointeeVariable> | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT") ? x as InitPointerVariable<PointeeVariable> : null;
    },
    asInitPointerOfElem<VElem extends Variable | Function>(x: Variable | Function, elem: VElem): InitPointerVariable<VElem> | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT" && variables.typesEqual((x as PointerVariable<Variable>).t.pointee, elem.t)) ? x as InitPointerVariable<VElem> : null;
    },
    asInitDirectPointer(x: Variable | Function): InitDirectPointerVariable<PointeeVariable> | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT" && (x as InitPointerVariable<PointeeVariable>).v.subtype === "DIRECT") ? x as InitDirectPointerVariable<PointeeVariable> : null;
    },
    asInitDirectPointerOfElem<VElem extends Variable | Function>(x: Variable | Function, elem: VElem): InitDirectPointerVariable<VElem> | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT" && (x as InitPointerVariable<PointeeVariable>).v.subtype === "DIRECT" && variables.typesEqual((x as PointerVariable<Variable>).t.pointee, elem.t)) ? x as InitDirectPointerVariable<VElem> : null;
    },
    asInitIndexPointer(x: Variable | Function): InitIndexPointerVariable<Variable> | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT" && (x as InitPointerVariable<PointeeVariable>).v.subtype === "INDEX") ? x as InitIndexPointerVariable<Variable> : null;
    },
    asInitIndexPointerOfElem<VElem extends Variable>(x: Variable | Function, elem: VElem): InitIndexPointerVariable<VElem> | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT" && (x as InitPointerVariable<PointeeVariable>).v.subtype === "INDEX" && variables.typesEqual((x as PointerVariable<Variable>).t.pointee, elem.t)) ? x as InitIndexPointerVariable<VElem> : null;
    },
    asClass(x: Variable | Function): ClassVariable | null {
        return (x.t.sig === "CLASS") ? x as ClassVariable : null;
    },
    asFunction(x: Variable | Function): Function | null {
        return (x.t.sig === "FUNCTION") ? x as Function : null;
    },
    arithmeticTypesEqual(lhs: ArithmeticType, rhs: ArithmeticType): boolean {
        return lhs.sig === rhs.sig;
    },
    pointerTypesEqual(lhs: PointerType<ObjectType | FunctionType>, rhs: PointerType<ObjectType | FunctionType>): boolean {
        return variables.typesEqual(lhs.pointee, rhs.pointee) && lhs.sizeConstraint === rhs.sizeConstraint;
    },
    classTypesEqual(lhs: ClassType, rhs: ClassType): boolean {
        if (lhs.identifier !== rhs.identifier) {
            return false;
        }
        if (lhs.memberOf !== null && rhs.memberOf !== null) {
            if (variables.classTypesEqual(lhs.memberOf, rhs.memberOf)) {
                return false;
            }
        } else if (!(lhs.memberOf === null && rhs.memberOf === null)) {
            return false;
        }
        if (lhs.templateSpec.length !== rhs.templateSpec.length) {
            return false;
        }
        for (let i = 0; i < lhs.templateSpec.length; i++) {
            if (!variables.typesEqual(lhs.templateSpec[i], rhs.templateSpec[i])) {
                return false;
            }
        }
        return true;
    },
    functionTypesEqual(lhs: FunctionType, rhs: FunctionType): boolean {
        if (lhs.fulltype.length !== rhs.fulltype.length) {
            return false;
        }
        for (let i = 0; i < lhs.fulltype.length; i++) {
            if (lhs.fulltype[i] !== rhs.fulltype[i]) {
                return false;
            }
        }
        return true;
    },
    typesEqual(lhs: AnyType, rhs: AnyType): boolean {
        if (lhs.sig !== rhs.sig) {
            return false;
        }
        if (lhs.sig in arithmeticSig || lhs.sig === "VOID") {
            return true;
        }
        type BranchKey = "PTR" | "CLASS" | "FUNCTION";
        const branch: { [sig in BranchKey]: () => boolean } = {
            "PTR": () => {
                return variables.pointerTypesEqual(lhs as PointerType<ObjectType | FunctionType>, rhs as PointerType<ObjectType | FunctionType>);
            },
            "CLASS": () => {
                return variables.classTypesEqual(lhs as ClassType, rhs as ClassType);
            },
            "FUNCTION": () => {
                return variables.functionTypesEqual(lhs as FunctionType, rhs as FunctionType);
            },
        }
        return branch[lhs.sig as BranchKey]();
    },
    arithmeticAssign(lhs: ArithmeticVariable, value: number, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        lhs.v.state = "INIT";
        (lhs.v as InitArithmeticValue).value = value;
    },
    arithmeticValueAssign(lv: ArithmeticValue, value: number, onError: (x: string) => never): void {
        checkAssignable(lv, onError);
        lv.state = "INIT";
        (lv as InitArithmeticValue).value = value;
    },
    directPointerAssign<VElem extends PointeeVariable>(lhs: PointerVariable<PointeeVariable>, pointee: VElem, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        if (!variables.typesEqual(lhs.t.pointee, pointee.t)) {
            const expected = variables.toStringSequence(lhs.t.pointee, false, onError).join(" ");
            const received = variables.toStringSequence(pointee.t, false, onError).join(" ");
            onError(`expected type '${expected}', got '${received}'`)
        }
        lhs.v.state = "INIT";
        (lhs.v as InitDirectPointerValue<VElem>).pointee = pointee.v;
    },
    indexPointerAssign<VElem extends Variable>(lhs: PointerVariable<VElem>, array: ArrayMemory<VElem>, index: number, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        if (!variables.typesEqual(lhs.t.pointee, array.objectType)) {
            const expected = variables.toStringSequence(lhs.t.pointee, false, onError).join(" ");
            const received = variables.toStringSequence(array.objectType, false, onError).join(" ");
            onError(`expected type '${expected}', got '${received}'`)
        }
        lhs.v.state = "INIT";
        (lhs.v as InitIndexPointerValue<VElem>).pointee = array;
        (lhs.v as InitIndexPointerValue<VElem>).index = index;
    },
    indexPointerAssignIndex(lhs: InitIndexPointerVariable<Variable>, index: number, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        lhs.v.index = index;
    },
    toStringSequence(type: AnyType, left: boolean, onError: (x: string) => never): string[] {
        let result = new Array<string>();
        if (left) {
            result.push("LREF");
        }
        toStringSequenceInner(type, result, onError);
        return result;
    },
    arithmeticSig: arithmeticSig,
    arithmeticProperties: arithmeticProperties,
    defaultArithmeticResolutionMap: defaultArithmeticResolutionMap,
} as const;

function checkAssignable(v: ObjectValue, onError: (x: string) => never): void {
    if (v.lvHolder === null) {
        onError("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
    }
    if (v.isConst) {
        onError("Attempted assignment to a constant value");
    }
}

function toStringSequenceInner(type: AnyType, result: string[], onError: (x: string) => never): void {
    if (type.sig in arithmeticSig || type.sig === "VOID") {
        result.push(type.sig);
        return;
    }
    type BranchKey = "PTR" | "CLASS" | "FUNCTION";
    const branch: { [sig in BranchKey]: () => void } = {
        "PTR": () => {
            result.push("PTR");
            toStringSequenceInner((type as PointerType<ObjectType | FunctionType>).pointee, result, onError);
        },
        "CLASS": () => {
            const classType = type as ClassType;
            if (classType.memberOf !== null) {
                result.push("MEMBER");
                toStringSequenceInner(classType.memberOf, result, onError);
            }
            result.push("CLASS");
            result.push((type as ClassType).identifier);
            result.push("<");
            classType.templateSpec.forEach((x: ObjectType) => {
                toStringSequenceInner(x, result, onError);
            });
            result.push(">");
        },
        "FUNCTION": () => {
            result.push(...(type as FunctionType).fulltype);
        },
    }
    branch[type.sig as BranchKey]();
}

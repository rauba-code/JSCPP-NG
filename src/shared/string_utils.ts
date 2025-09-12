import { CRuntime } from "../rt";
import { AbstractVariable, ArithmeticVariable, ClassType, InitArithmeticVariable, InitIndexPointerVariable, InitValue, ObjectType, PointerVariable, variables } from "../variables";

export function skipSpace(rt: CRuntime, buf: InitIndexPointerVariable<ArithmeticVariable>): void {
    if (buf.v.pointee.values.length === 0) {
        return;
    }
    while (rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index)) === 32) {
        buf.v.index++;
    }
};

export function sizeNonSpace(rt: CRuntime, buf: InitIndexPointerVariable<ArithmeticVariable>): number {
    if (buf.v.pointee.values.length === 0) {
        return 0;
    }
    let i = 0;
    while (true) {
        const chr: number = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index + i));
        if (chr === 0 || chr === 32 || chr === 9 || chr === 10) {
            break;
        }
        i++;
    }
    return i;
};

export function sizeUntil(rt: CRuntime, buf: InitIndexPointerVariable<ArithmeticVariable>, delim: InitArithmeticVariable): number {
    if (buf.v.pointee.values.length === 0) {
        return 0;
    }
    let i = 0;
    while (true) {
        const chr: number = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index + i));
        if (chr === delim.v.value || chr === 0) {
            break;
        }
        i++;
    }
    return i;
};

export function sizeUntilNull(rt: CRuntime, buf: InitIndexPointerVariable<ArithmeticVariable>): number {
    if (buf.v.pointee.values.length === 0) {
        return 0;
    }
    let i = 0;
    while (true) {
        const chr: number = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index + i));
        if (chr === 0) {
            break;
        }
        i++;
    }
    return i;
};

export function read(rt: CRuntime, reg: RegExp, buf: string, type: ObjectType) {
    const r = reg.exec(buf);
    if ((r == null) || (r.length === 0)) {
        rt.raiseException("input format mismatch " + rt.makeTypeString(type) + " with buffer=" + JSON.stringify(buf));
    } else {
        return r;
    }
};

export const resolveIdentifier = function(obj: any) {
    if (typeof obj !== 'object' || !obj.type) return obj;

    let identifier = '';
    let currentObj = obj;

    while (currentObj) {
        if (currentObj.type === 'ScopedIdentifier') {
            identifier = currentObj.Identifier + (identifier ? '::' + identifier : '');
            currentObj = currentObj.scope;
        } else if (currentObj.type === 'IdentifierExpression') {
            currentObj = identifier;
        } else {
            break;
        }
    }

    return identifier;
};

export function strcmp(rt: CRuntime, a: InitIndexPointerVariable<ArithmeticVariable>, b: InitIndexPointerVariable<ArithmeticVariable>): -1 | 0 | 1 {
    if (a.v.pointee === b.v.pointee) {
        return 0;
    }
    let cnt = 0;
    while (true) {
        const av = rt.arithmeticValue(variables.arrayMember(a.v.pointee, a.v.index + cnt))
        const bv = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index + cnt))
        if (av < bv) {
            return -1;
        } else if (av > bv) {
            return 1;
        } else if (av == 0 && av == bv) {
            return 0;
        }
        cnt++;
    }
}

export function strncmp(rt: CRuntime, a: InitIndexPointerVariable<ArithmeticVariable>, b: InitIndexPointerVariable<ArithmeticVariable>, length: number): -1 | 0 | 1 {
    if (a.v.pointee === b.v.pointee) {
        return 0;
    }
    let cnt = 0;
    while (true) {
        if (cnt >= length) {
            return 0;
        }
        const av = rt.arithmeticValue(variables.arrayMember(a.v.pointee, a.v.index + cnt))
        const bv = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index + cnt))
        if (av < bv) {
            return -1;
        } else if (av > bv) {
            return 1;
        }
        cnt++;
    }
}

export interface StringType extends ClassType {
    readonly sig: "CLASS",
    readonly identifier: "string",
    readonly templateSpec: [],
    readonly memberOf: null,
}

export type StringVariable = AbstractVariable<StringType, StringValue>;

export interface StringValue extends InitValue<StringVariable> {
    members: {
        "_ptr": PointerVariable<ArithmeticVariable>
        "_size": InitArithmeticVariable,
    }
}

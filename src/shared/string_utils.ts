import { CRuntime } from "../rt";
import { ArithmeticVariable, InitIndexPointerVariable, ObjectType, variables } from "../variables";

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
        const chr : number = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index + i));
        if (chr === 0 || chr === 32) {
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

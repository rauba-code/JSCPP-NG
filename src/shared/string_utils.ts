import { CRuntime } from "../rt";
import { ObjectType } from "../variables";

export const skipSpace = function(s: string) {
    const r = /^\s*/.exec(s);
    if (r && (r.length > 0)) {
        return s.substring(r[0].length);
    } else {
        return s;
    }
};

export function read(rt: CRuntime, reg: RegExp, buf: string, type: ObjectType) {
    const r = reg.exec(buf);
    if ((r == null) || (r.length === 0)) {
        rt.raiseException("input format mismatch " + rt.makeTypeString({ t: type, readonly: false, v: { lvHolder: null } }) + " with buffer=" + JSON.stringify(buf));
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

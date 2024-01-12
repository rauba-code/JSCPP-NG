import { CRuntime, VariableType } from "../../rt";

export const skipSpace = function (s: string) {
    const r = /^\s*/.exec(s);
    if (r && (r.length > 0)) {
        return s.substring(r[0].length);
    } else {
        return s;
    }
};

export const read = function (rt: CRuntime, reg: RegExp, buf: string, type: VariableType) {
    const r = reg.exec(buf);
    if ((r == null) || (r.length === 0)) {
        rt.raiseException("input format mismatch " + rt.makeTypeString(type) + " with buffer=" + buf);
    } else {
        return r;
    }
};
import { LLParser, NonTerm } from './typecheck';
import * as typecheck from './typecheck'

function makeStringArr(type: string | string[]): string[] {
    if (typeof type === "string") {
        return type.split(" ");
    }
    return type;
}

function makeString(type: string | string[]): string {
    if (typeof type === "string") {
        return type;
    }
    return type.join(' ');
}


export class TypeDB {
    parser: LLParser
    scope: NonTerm
    strict_order: boolean
    functions: { [identifier: string]: { overloads: { type: string[], fnid: number }[], cache: { [signature: string]: number } } }

    constructor(parser: LLParser, scope: NonTerm = "Type", strict_order = true) {
        this.parser = parser;
        this.scope = scope;
        this.strict_order = strict_order;
        this.functions = {}
    }

    matchSubset(subtype: string | string[], supertype: string | string[], allow_lvalue_substitution = false): boolean {
        return typecheck.parseSubset(this.parser, makeStringArr(subtype), makeStringArr(supertype), this.scope, this.strict_order, allow_lvalue_substitution);
    }

    addFunctionOverload(identifier: string, function_type: string | string[], function_id: number, onError: (x: string) => void) {
        const sa = makeStringArr(function_type);
        if (sa.length < 2) {
            onError(`Malformed function type signature: '${sa.join(" ")}'`)
        }
        sa[1] = "Return";
        if (!(identifier in this.functions)) {
            this.functions[identifier] = { overloads: [ { type: sa, fnid: function_id }  ], cache: {} };
        } else {
            this.functions[identifier].overloads.push({ type: sa, fnid: function_id });
            // clean the cache for this function
            this.functions[identifier].cache = {};
        }
    }

    matchSingleFunction(identifier: string, onError: (x: string) => void): number {
        const fnobj = this.functions[identifier];
        if (fnobj === undefined) {
            return -1;
        }
        if (fnobj.overloads.length >= 1) {
            onError(`Overloaded function ${identifier} has multiple candidates`);
        }
    }

    matchFunctionByParams(identifier: string, params: (string | string[])[], onError: (x: string) => void): number {
        if (!(identifier in this.functions)) {
            return -1;
        }
        const targetParams: string[] = params.flatMap((x) => {
            const sa: string[] = makeStringArr(x);
            if (sa.length > 0 && sa[0].startsWith(typecheck.wildcardDeclarator)) {
                onError("Calling a function with parameters of wildcard type is unsupported");
            }
            return sa;
        });
        const target: string[] = ["FUNCTION", "Return", "("].concat(...targetParams).concat(")");
        return this.matchFunctionExact(identifier, target, onError);
    }

    matchFunctionExact(identifier: string, target: string[], onError: (x: string) => void): number {
        const fnobj = this.functions[identifier];
        if (fnobj === undefined) {
            return -1;
        }
        const targetInline = makeString(target);
        if (targetInline in fnobj.cache) {
            return fnobj.cache[targetInline];
        }
        let retv = -1;
        for (let i = 0; i < fnobj.overloads.length; i++) {
            if (this.matchSubset(target, fnobj.overloads[i].type, true)) {
                if (retv >= 0) {
                    onError(`Call of overloaded function \'${identifier}\' matches more than one candidate:\n1) ${fnobj.overloads[retv].type.join(" ")} \n2) ${fnobj.overloads[i].type.join(" ")}`);
                    return -1;
                }
                retv = i;
            }
        }
        const result = retv >= 0 ? fnobj.overloads[retv].fnid : retv;
        fnobj.cache[targetInline] = result;
        return result;
    }

    parse(type: string | string[]): boolean {
        return typecheck.parse(this.parser, makeStringArr(type), this.scope, this.strict_order);
    }
}

import { LLParser, NonTerm, TypeParseError } from './typecheck';
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
    functions: { [identifier: string]: { overloads: string[][], cache: { [signature: string]: number } } }

    constructor(parser: LLParser, scope: NonTerm = "Type", strict_order = true) {
        this.parser = parser;
        this.scope = scope;
        this.strict_order = strict_order;
    }

    matchSubset(subtype: string | string[], supertype: string | string[], allow_lvalue_substitution = false): boolean {
        return typecheck.parseSubset(this.parser, makeStringArr(subtype), makeStringArr(supertype), this.scope, this.strict_order, allow_lvalue_substitution);
    }

    addFunctionOverload(identifier: string, function_type: string | string[]) {
        if (!(identifier in this.functions)) {
            this.functions[identifier] = { overloads: [ makeStringArr(function_type) ], cache: {} };
        } else {
            this.functions[identifier].overloads.push(makeStringArr(function_type));
            // clean the cache for this function
            this.functions[identifier].cache = {};
        }
    }

    matchSingleFunction(identifier: string): number {
        const fnobj = this.functions[identifier];
        if (fnobj === undefined) {
            return -1;
        }
        if (fnobj.overloads.length >= 1) {
            throw new Error(`Overloaded function ${identifier} has multiple candidates`);
        }
    }

    matchFunctionByParams(identifier: string, params: (string | string[])[]): number {
        if (!(identifier in this.functions)) {
            return -1;
        }
        const targetParams: string[] = params.flatMap((x) => {
            const sa: string[] = makeStringArr(x);
            if (sa.length > 0 && sa[0].startsWith(typecheck.wildcardDeclarator)) {
                throw new TypeParseError("Calling a function with parameters of wildcard type is unsupported");
            }
            return sa;
        });
        const target: string[] = ["FUNCTION", "Return", "("].concat(...targetParams).concat(")");
        return this.matchFunctionExact(identifier, target);
    }

    matchFunctionExact(identifier: string, target: string[]): number {
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
            if (this.matchSubset(target, fnobj.overloads[i], true)) {
                if (retv >= 0) {
                    throw new TypeParseError(`Call of overloaded function \'${identifier}\' matches more than one candidate:\n1) ${fnobj.overloads[retv]} \n2) ${fnobj.overloads[i]}`);
                }
                retv = i;
            }
        }
        fnobj.cache[targetInline] = retv;
        return retv;
    }

    parse(type: string | string[]): boolean {
        return typecheck.parse(this.parser, makeStringArr(type), this.scope, this.strict_order);
    }
}

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
    functions: { [identifier: string]: { overloads: string[][], cache: { [params: string]: number } } }

    constructor(parser: LLParser, scope: NonTerm = "Type", strict_order = true) {
        this.parser = parser;
        this.scope = scope;
        this.strict_order = strict_order;
    }

    matchSubset(subtype: string | string[], subset: string | string[]): boolean {
        return typecheck.parseSubset(this.parser, makeStringArr(subtype), makeStringArr(subset), this.scope, this.strict_order);
    }

    addFunctionOverload(identifier: string, function_type: string | string[]) {
        throw new Error("Not yet implemented");
    }

    matchFunction(identifier: string, params: (string | string[])[]): number {
        const fnobj = this.functions[identifier];
        if (fnobj === undefined) {
            return -1;
        }
        const targetParams: string[] = params.flatMap((x) => {
            const sa: string[] = makeStringArr(x);
            if (sa.length > 0) {
                if (sa[0].startsWith(typecheck.wildcardDeclarator)) {
                    throw new TypeParseError("Calling a function with parameters of wildcard type is unsupported")
                }
                //if (sa[0] === "LREF") {
                //    return sa.slice(1);
                //}
            }
            return sa;
        });
        const target: string[] = ["FUNCTION", "Return", "("].concat(...targetParams).concat(")");


        throw new Error("Not yet implemented");
    }

    parse(type: string | string[]): boolean {
        return typecheck.parse(this.parser, makeStringArr(type), this.strict_order);
    }
}

export class TypeParseError extends Error {
    constructor(...params: any[]) {
        super(...params);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TypeParseError);
        }
        this.name = "TypeParseError";
        Object.setPrototypeOf(this, TypeParseError.prototype)
    }
}

const term = {
    // @ts-ignore
    "FUNCTION": null,
    // @ts-ignore
    "VOID": null,
    // @ts-ignore
    "NULLPTR": null,
    // @ts-ignore
    "LREF": null,
    // @ts-ignore
    "ARRAY": null,
    // @ts-ignore
    "CLASS": null,
    // @ts-ignore
    "MEMBER": null,
    // @ts-ignore
    "PTR": null,
    // @ts-ignore
    "I8": null,
    // @ts-ignore
    "U8": null,
    // @ts-ignore
    "I16": null,
    // @ts-ignore
    "U16": null,
    // @ts-ignore
    "I32": null,
    // @ts-ignore
    "U32": null,
    // @ts-ignore
    "I64": null,
    // @ts-ignore
    "U64": null,
    // @ts-ignore
    "F32": null,
    // @ts-ignore
    "F64": null,
    // @ts-ignore
    "BOOL": null,
    // @ts-ignore
    "STRINGLITERAL": null, // unused
    // @ts-ignore
    "CHARLITERAL": null, // unused
    // @ts-ignore
    "INTLITERAL": null, // unused
    // @ts-ignore
    "FLOATLITERAL": null, // unused
    // @ts-ignore
    "<": null,
    // @ts-ignore
    ">": null,
    // @ts-ignore
    "(": null,
    // @ts-ignore
    ")": null
} as const;
export type Term = keyof (typeof term);

const nonTerm = {
    // @ts-ignore
    "TemplateParamPlus": null,
    // @ts-ignore
    "TemplateParamOrEnd": null,
    // @ts-ignore
    "FunctionParamPlus": null,
    // @ts-ignore
    "FunctionParamOrEnd": null,
    // @ts-ignore
    "Member": null,
    // @ts-ignore
    "Function": null,
    // @ts-ignore
    "Type": null,
    // @ts-ignore
    "Object": null,
    // @ts-ignore
    "ParamObject": null,
    // @ts-ignore
    "Parametric": null,
    // @ts-ignore
    "LRef": null,
    // @ts-ignore
    "LValue": null,
    // @ts-ignore
    "Pointer": null,
    // @ts-ignore
    "Pointee": null,
    // @ts-ignore
    "Array": null,
    // @ts-ignore
    "ArraySize": null,
    // @ts-ignore
    "Class": null,
    // @ts-ignore
    "Arithmetic": null,
    // @ts-ignore
    "Literal": null, // unused
    // @ts-ignore
    "ObjectOrFunction": null,
    // @ts-ignore
    "Return": null
} as const;
export type NonTerm = keyof (typeof nonTerm);

const specTerm = {
    // @ts-ignore
    "identifier": null,
    // @ts-ignore
    "positiveint": null,
};
export type SpecTerm = keyof (typeof specTerm);

export type LexSym = Term | NonTerm | SpecTerm;

export type LLParser = { [symbol: string]: { [startsWith: string]: NonTerm | SpecTerm | null }[] }

/** Creates an LL(1) parser for type language from the given Backus-Naur form (BNF).
 */
export function constructTypeParser(): LLParser {
    const typeBNF: { [symbol: string]: LexSym[][] } = {
        "Type": [["Object", "VOID", "Function", "LRef"]],
        "Object": [["ParamObject", "Array"]],
        "ParamObject": [["Class", "Arithmetic", "NULLPTR", "Pointer", "Member"]],
        "Parametric": [["ParamObject", "LRef"]],
        "Member": [["MEMBER"], ["Class"], ["Class"]],
        "LRef": [["LREF"], ["LValue"]],
        "LValue": [["Object", "Function"]],
        "Pointee": [["LValue", "VOID"]],
        "Pointer": [["PTR"], ["Pointee"]],
        "Array": [["ARRAY"], ["Object"], ["ArraySize"]],
        "ArraySize": [["positiveint"]],
        "Class": [["CLASS"], ["identifier"], ["<"], ["TemplateParamOrEnd"]],
        "Arithmetic": [["I8", "U8", "I16", "U16", "I32", "U32", "I64", "U64", "F32", "F64", "BOOL"]],
        "Function": [["FUNCTION"], ["Return"], ["("], ["FunctionParamOrEnd"]],
        "FunctionParamOrEnd": [["FunctionParamPlus", ")"]],
        "FunctionParamPlus": [["Parametric"], ["FunctionParamOrEnd"]],
        "TemplateParamOrEnd": [["TemplateParamPlus", ">"]],
        "TemplateParamPlus": [["Parametric"], ["TemplateParamOrEnd"]],
        "Return": [["Parametric", "VOID"]]
    };
    let result: LLParser = {};
    Object.keys(typeBNF).forEach((key: string) => {
        result[key] = new Array();
        typeBNF[key].forEach((union: LexSym[], fieldIdx: number) => {
            result[key].push({});
            union.forEach((element: LexSym) => {
                if (element in term || element in specTerm) {
                    result[key][fieldIdx][element] = null;
                }
            })
        })
        result[key][0][key as NonTerm] = null;
    })
    let i = 0;
    while (true) {
        let dirty: boolean = false;
        Object.keys(typeBNF).forEach((key: string) => {
            typeBNF[key].forEach((union: LexSym[], fieldIdx: number) => {
                union.forEach((nterm: LexSym) => {
                    if (nterm in nonTerm) {
                        if (!(nterm in result)) {
                            throw new TypeParseError(`NonTerm ${nterm} is outside the grammar tree`);
                        }
                        Object.keys(result[nterm][0]).forEach((startsWith) => {
                            if (!(startsWith in result[key][fieldIdx])) {
                                result[key][fieldIdx][startsWith] = nterm as NonTerm;
                                dirty = true;
                            }
                        })
                    }
                })
            })
        })
        if (!dirty) {
            break;
        }
        i++;
        if (i > 1000) {
            throw new TypeParseError("Perpetual loop detected")
        }
    }

    return result;
}

export const wildcardDeclarator: string = '!';
export const wildcardSpecifier: string = '?';

function preparse(sentence: string[], strict_order: boolean = true): { sentence: string[], wildcardMap: number[] } {
    let targets: string[] = new Array();
    while (sentence.length > 0 && sentence[0].startsWith(wildcardDeclarator)) {
        targets.push(sentence[0].slice(1));
        sentence = sentence.slice(1);
    }
    let wildcardMap: number[] = [];
    if (targets.length === 0) {
        return { sentence, wildcardMap };
    }
    let expectedMaxId: number = 0;
    let anonWildcardId: number = targets.length;
    return {
        sentence: sentence.map((x: string) => {
            if (x.startsWith(wildcardSpecifier)) {
                const wildcardId: number = parseInt(x.slice(1));
                if (!(wildcardId >= 0 && wildcardId < targets.length)) {
                    throw new TypeParseError(`Wildcard ${x} is out of bounds`);
                }
                if (strict_order && expectedMaxId < wildcardId) {
                    throw new TypeParseError(`Wildcard ${x} precedes ?${expectedMaxId}`);
                }
                if (wildcardId === expectedMaxId) {
                    expectedMaxId++;
                }
                wildcardMap.push(wildcardId);
                return targets[wildcardId];
            } else if (x.startsWith(wildcardDeclarator)) {
                throw new TypeParseError('Wildcard declarator detected after the start of the sentence')
            } else {
                if (x in nonTerm) {
                    wildcardMap.push(anonWildcardId++);
                }
                return x;
            }
        }),
        wildcardMap
    };
}

/** Tests if the given string is a valid sentence.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param sentence Sequence of tokens, which describes the variable type.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @throws TypeParseError on invalid preparsing (see: `strict_order`).
 **/
export function parse(parser: LLParser, sentence: string[], scope: NonTerm = 'Type', strict_order: boolean = true): boolean {
    const preparseResult = preparse(sentence, strict_order);
    return parseInner(parser, scope, preparseResult.sentence) !== null;
}

function parseInner(parser: LLParser, scope: NonTerm, sentence: string[]): string[] | null {
    let endLoop: boolean = false;
    let result: string[] | null = sentence;
    parser[scope].forEach((argument) => {
        if (result === null || endLoop) {
            return;
        }
        if (result.length > 0 && result[0] in argument) {
            const innerScope: NonTerm | null = argument[result[0]] as NonTerm | null;
            if (innerScope === null) {
                if (result[0] === scope) {
                    endLoop = true;
                }
                result = result.slice(1);
            } else {
                result = parseInner(parser, innerScope as NonTerm, result);
            }
        } else if (result.length > 0 && "identifier" in argument) {
            result = result.slice(1);
        } else if (result.length > 0 && "positiveint" in argument) {
            if (!(parseInt(result[0]) > 0)) {
                result = null;
            } else {
                result = result.slice(1);
            }
        } else {
            result = null;
        }
    });
    return result;
}

interface SigPair {
    subtype: string[],
    subwc: number[],
    supertype: string[]
    superwc: number[],
    wildcards: (number | string[])[],
}

export function arrayValuesEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i: number = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/** Tests if `subtype` is a subset of or equivalent to `supertype`.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param subtype Sequence of tokens, which describes the subset of types.
 *  @param supertype Sequence of tokens, which describes the superset of types.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @param allow_lvalue_substitution allow substituting `"LREF Object"` to `"Object"` when checking lvalues in `subtype`.
 *  @remarks It is assumed that `parse(parser, subtype)` and `parse(parser, supertype)` return `true` (i.e., `subtype` and `supertype` are always valid). This function does NOT check if given sentences are valid.
 *  @throws TypeParseError on preparsing errors (see: `strict_order`).
 **/
export function parseSubset(parser: LLParser, subtype: string[], supertype: string[], scope: NonTerm = 'Type', strict_order = true, allow_lvalue_substitution = false): boolean {
    let subData = preparse(subtype, strict_order);
    let superData = preparse(supertype, strict_order);
    const pair: SigPair = {
        subtype: subData.sentence,
        subwc: subData.wildcardMap,
        supertype: superData.sentence,
        superwc: superData.wildcardMap,
        wildcards: new Array<number | string[]>()
    }
    const p1: boolean = parseSubsetInner(parser, scope, pair, allow_lvalue_substitution);
    const p2: boolean = pair.subtype.length === 0 && pair.supertype.length === 0;
    return p1 && p2;
}

function parseSubsetInner(parser: LLParser, scope: NonTerm, pair: SigPair, allow_lvalue_substitution: boolean = false): boolean {
    let retv: boolean | null = null;
    parser[scope].forEach((argument) => {
        if (retv !== null) {
            return;
        }
        if (pair.supertype.length > 0 && pair.supertype[0] in argument) {
            if (allow_lvalue_substitution && pair.subtype.length > 0 && pair.subtype[0] === "LREF" && !(pair.supertype[0] === "LREF" || pair.supertype[0] === "LRef")) {
                pair.subtype = pair.subtype.slice(1);
            }
            const innerScope: NonTerm | null = argument[pair.supertype[0]] as NonTerm | null;
            if (innerScope === null) {
                if (pair.supertype[0] === scope) {
                    // wildcard management
                    pair.supertype = pair.supertype.slice(1);
                    const subtype0 = pair.subtype;
                    let r = parseInner(parser, scope, pair.subtype);
                    if (r !== null) {
                        const wcInstance = subtype0.slice(0, subtype0.length - r.length);
                        let subresult: number | string[];
                        if (wcInstance.length === 1 && wcInstance[0] in nonTerm) {
                            // subset is also a wildcard
                            subresult = pair.subwc[0];
                            pair.subwc = pair.subwc.slice(1);
                        } else {
                            subresult = wcInstance;
                        }
                        const superwc: number | string[] = pair.wildcards[pair.superwc[0]];
                        if (superwc === undefined) {
                            pair.wildcards[pair.superwc[0]] = subresult;
                        } else if (typeof superwc === "number") {
                            if (superwc !== subresult) {
                                retv = false;
                            }
                        } else {
                            // superwc is an array
                            if (typeof subresult === "number" || !arrayValuesEqual(superwc, subresult)) {
                                retv = false;
                            }
                        }
                    }
                    if (retv === null) {
                        retv = r !== null;
                    }
                    if (retv === true && r !== null) {
                        pair.subtype = r;
                        pair.superwc = pair.superwc.slice(1);
                    }
                    return;
                } else {
                    if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0])) {
                        retv = false;
                        return;
                    }
                    pair.supertype = pair.supertype.slice(1);
                    pair.subtype = pair.subtype.slice(1);
                }
            } else {
                if (!parseSubsetInner(parser, innerScope as NonTerm, pair, allow_lvalue_substitution)) {
                    retv = false;
                    return;
                }
            }
        } else if (pair.supertype.length > 0 && "identifier" in argument) {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0])) {
                retv = false;
                return;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        } else if (pair.supertype.length > 0 && "positiveint" in argument) {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0] && parseInt(pair.subtype[0]) >= 0)) {
                retv = false;
                return;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        } else {
            retv = false;
        }
    });
    if (retv === null) {
        return true;
    }
    return retv;
}

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

const arithmeticSig = {
    "I8": Object,
    "U8": Object,
    "I16": Object,
    "U16": Object,
    "I32": Object,
    "U32": Object,
    "I64": Object,
    "U64": Object,
    "F32": Object,
    "F64": Object,
    "BOOL": Object,
}
export type ArithmeticSig = keyof (typeof arithmeticSig);

const term = {
    "FUNCTION": Object,
    "VOID": Object,
    "NULLPTR": Object,
    "LREF": Object,
    "CLREF": Object,
    "ARRAY": Object,
    "CLASS": Object,
    "PTR": Object,
    "I8": Object,
    "U8": Object,
    "I16": Object,
    "U16": Object,
    "I32": Object,
    "U32": Object,
    "I64": Object,
    "U64": Object,
    "F32": Object,
    "F64": Object,
    "BOOL": Object,
    //"STRINGLITERAL": Object, // unused
    //"CHARLITERAL": Object, // unused
    //"INTLITERAL": Object, // unused
    //"FLOATLITERAL": Object, // unused
    "<": Object,
    ">": Object,
    "(": Object,
    ")": Object
} as const;
export type Term = keyof (typeof term);

const nonTerm = {
    "TemplateParamPlus": Object,
    "TemplateParamOrEnd": Object,
    "FunctionParamPlus": Object,
    "FunctionParamOrEnd": Object,
    "Function": Object,
    "Type": Object,
    "Object": Object,
    "ParamObject": Object,
    "Parametric": Object,
    "LRef": Object,
    "CLRef": Object,
    "LValue": Object,
    "Pointer": Object,
    "Pointee": Object,
    "Array": Object,
    "ArraySize": Object,
    "Class": Object,
    "Arithmetic": Object,
    //"Literal": Object, // unused
    "ObjectOrFunction": Object,
    "Return": Object
} as const;
export type NonTerm = keyof (typeof nonTerm);

const specTerm = {
    "identifier": Object,
    "positiveint": Object,
};
export type SpecTerm = keyof (typeof specTerm);

export type LexSym = Term | NonTerm | SpecTerm;

export type LLParser = { [symbol: string]: LLParserEntry[] }
export type LLParserEntry = { [startsWith: string]: NonTerm | SpecTerm | null };

/** Creates an LL(1) parser for type language from the given Backus-Naur form (BNF).
 */
export function constructTypeParser(): LLParser {
    const typeBNF: { [symbol: string]: LexSym[][] } = {
        "Type": [["Object", "VOID", "Function", "LRef"]],
        "Object": [["ParamObject", "Array"]],
        "ParamObject": [["Class", "Arithmetic", "NULLPTR", "Pointer"]],
        "Parametric": [["ParamObject", "LRef", "CLRef"]],
        "LRef": [["LREF"], ["LValue"]],
        "CLRef": [["CLREF"], ["LValue"]],
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

interface FunctionMatchSigPair extends SigPair {
    /** Triggered on FunctionParamOrEnd call. 0 means not a parameter; 
      * In "FUNCTION R ( A B FUNCTION C ( D ) )", `param_depth` R is 0, for A, B and C it is 1, and 2 for D. */
    paramDepth: number,
    firstLevelParamBreadth: number,
}

interface SubsetSigPair extends SigPair {
    allow_lvalue_substitution: boolean,
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

export type CastAction = {
    type: "ARITHMETIC",
    targetSig: ArithmeticSig,
} & {
    type: "CTOR"
    fnsig: string[],
};

export interface ParseFunctionMatchResult {
    valueActions: ("CLONE" | "BORROW" | "CAST")[],
    castActions: { index: number, targetSig: ArithmeticSig }[],
};

/** Tests if `subtype` function is a valid match for `supertype`, provides preparatory actions for argument conversion.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param subtype Sequence of tokens, which describes the subset of types.
 *  @param supertype Sequence of tokens, which describes the superset of types.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @remarks It is assumed that `parse(parser, subtype)` and `parse(parser, supertype)` return `true` (i.e., `subtype` and `supertype` are always valid). This function does NOT check if given sentences are valid.
 *  @throws TypeParseError on preparsing errors (see: `strict_order`).
 **/
export function parseFunctionMatch(parser: LLParser, subtype: string[], supertype: string[], strict_order = true): ParseFunctionMatchResult | null {
    let subData = preparse(subtype, strict_order);
    let superData = preparse(supertype, strict_order);
    const pair: FunctionMatchSigPair = {
        subtype: subData.sentence,
        subwc: subData.wildcardMap,
        supertype: superData.sentence,
        superwc: superData.wildcardMap,
        wildcards: new Array<number | string[]>(),
        paramDepth: 0,
        firstLevelParamBreadth: 0,
    }
    const result: ParseFunctionMatchResult = {
        valueActions: new Array(),
        castActions: new Array(),
    };
    const retv = parseFunctionMatchInner(parser, 'Function', pair, result);
    return (retv && pair.subtype.length === 0 && pair.supertype.length === 0) ? result : null;
}

function matchNontermOrWildcard(parser: LLParser, scope: NonTerm, argument: LLParserEntry, pair: FunctionMatchSigPair, supertop: string, result: ParseFunctionMatchResult): boolean | null {
    const innerScope: NonTerm | null = argument[supertop] as NonTerm | null;
    if (innerScope === null) {
        if (supertop === scope) {
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
                        return false;
                    }
                } else {
                    // superwc is an array
                    if (typeof subresult === "number" || !arrayValuesEqual(superwc, subresult)) {
                        return false;
                    }
                }
            }
            if (r !== null) {
                pair.subtype = r;
                pair.superwc = pair.superwc.slice(1);
            }
            return r !== null;
        } else {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === supertop)) {
                return false;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        }
    } else {
        const delta = (scope === "Function" && innerScope === "FunctionParamOrEnd") ? 1 : (scope === "Function" && innerScope === "Return") ? 2 : 0;
        pair.paramDepth += delta;
        const nestedRetv = parseFunctionMatchInner(parser, innerScope as NonTerm, pair, result);
        pair.paramDepth -= delta;
        if (!nestedRetv) {
            return false;
        }
    }
    return null;
}

function tryImplicitCast(pair: FunctionMatchSigPair, subtype: string[], supertype: string[]): { index: number, targetSig: ArithmeticSig } | null {
    if (supertype[0] in arithmeticSig && subtype[0] in arithmeticSig) {
        // implicit arithmetic conversions
        return { index: pair.firstLevelParamBreadth, targetSig: supertype[0] as ArithmeticSig };
    } else if (supertype[0] === "Arithmetic" && subtype[0] in arithmeticSig) {
        // implicit arithmetic conversions with inferred wildcard type
        const superwc: number | string[] = pair.wildcards[pair.superwc[0]];
        if (superwc === undefined || typeof superwc === "number") {
            throw new TypeParseError("Cannot infer a function parameter in a given implicit arithmetic conversion (not yet implemented)");
        } else if (superwc.length === 1 && superwc[0] in arithmeticSig) {
            return { index: pair.firstLevelParamBreadth, targetSig: superwc[0] as ArithmeticSig };
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function parseFunctionMatchInner(parser: LLParser, scope: NonTerm, pair: FunctionMatchSigPair, result: ParseFunctionMatchResult): boolean {
    let retv: boolean | null = null;
    parser[scope].forEach((argument) => {
        if (retv !== null) {
            return;
        }
        if (pair.supertype.length > 0 && pair.supertype[0] in argument) {
            if (pair.paramDepth === 1 && scope === "Parametric") {
                if (pair.subtype.length === 0) {
                    retv = false;
                    return;
                }
                let valueAction: "BORROW" | "CLONE" | "CAST" = "CLONE";
                //const superRefType: "LREF" | "CLREF" | "OTHER" = (pair.supertype.length > 0) ? ((pair.supertype[0] === "LREF" || pair.supertype[0] === "LRef") ? "LREF" : ((pair.supertype[0] === "CLREF" || pair.supertype[0] === "CLRef") ? "CLREF" : "OTHER")) : "OTHER";
                if (pair.subtype[0] === "LREF" || pair.subtype[0] === "CLREF") {
                    if ((pair.supertype[0] === "LREF" && pair.subtype[0] === "LREF") || pair.supertype[0] === "CLREF") {
                        // cannot provide const T& to function that accepts only T&, but it is permitted vice-versa.
                        pair.subtype[0] = "LREF";
                        pair.supertype[0] = "LREF";
                        valueAction = "BORROW";
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], result);
                    } else if (pair.supertype[0] === "LRef" || pair.supertype[0] === "CLRef") {
                        throw new Error("Typecheck: Not yet implemented");
                    } else {
                        // implicit lvalue arithmetic conversion
                        pair.subtype = pair.subtype.slice(1);
                        const subtype = pair.subtype;
                        const supertype = pair.supertype;
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], result);
                        if (retv === false) {
                            const implicitCast = tryImplicitCast(pair, subtype, supertype);
                            if (implicitCast !== null) {
                                retv = null;
                                valueAction = "CAST";
                                pair.subtype = subtype.slice(1);
                                pair.supertype = supertype.slice(1);
                                result.castActions.push(implicitCast);
                            } else {
                                return false;
                            }
                        } else {
                            valueAction = "CLONE";
                        }
                    }
                } else {
                    // temporary
                    if (pair.supertype[0] === "CLREF") {
                        valueAction = "BORROW";
                        pair.supertype = pair.supertype.slice(1);
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], result);
                    } else if (pair.supertype[0] === "CLRef") {
                        throw new Error("Typecheck: Not yet implemented");
                    } else if (pair.subtype[0] in arithmeticSig) {
                        // implicit non-lvalue arithmetic conversion
                        const subtype = pair.subtype;
                        const supertype = pair.supertype;
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], result);
                        if (retv === false) {
                            const implicitCast = tryImplicitCast(pair, subtype, supertype);
                            if (implicitCast !== null) {
                                retv = null;
                                valueAction = "CAST";
                                pair.subtype = subtype.slice(1);
                                pair.supertype = supertype.slice(1);
                                result.castActions.push(implicitCast);
                            } else {
                                return false;
                            }
                        } else {
                            valueAction = "CLONE";
                        }
                    } else {
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], result);
                    }
                }
                pair.firstLevelParamBreadth++;
                result.valueActions.push(valueAction);
            } else {
                retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], result);
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
    const pair: SubsetSigPair = {
        subtype: subData.sentence,
        subwc: subData.wildcardMap,
        supertype: superData.sentence,
        superwc: superData.wildcardMap,
        wildcards: new Array<number | string[]>(),
        allow_lvalue_substitution,
    }
    const p1: boolean = parseSubsetInner(parser, scope, pair);
    const p2: boolean = pair.subtype.length === 0 && pair.supertype.length === 0;
    return p1 && p2;
}

function parseSubsetInner(parser: LLParser, scope: NonTerm, pair: SubsetSigPair): boolean {
    let retv: boolean | null = null;
    parser[scope].forEach((argument) => {
        if (retv !== null) {
            return;
        }
        if (pair.supertype.length > 0 && pair.supertype[0] in argument) {
            if (pair.allow_lvalue_substitution && pair.subtype.length > 0 && pair.subtype[0] === "LREF" && !(pair.supertype[0] === "LREF" || pair.supertype[0] === "LRef")) {
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
                if (!parseSubsetInner(parser, innerScope as NonTerm, pair)) {
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


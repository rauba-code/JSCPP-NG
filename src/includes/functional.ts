import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { StringVariable } from "../shared/string_utils";
import { ArithmeticSig, InitArithmeticVariable, InitIndexPointerVariable, variables } from "../variables";

/*interface HashType<T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: "hash",
}

type MapVariable<T extends Variable> = AbstractVariable<HashType<T["t"]>, MapValue<T>>;

interface MapValue<T extends Variable> extends InitValue<MapVariable<T>> {
    members: { }
}*/

export = {
    load(rt: CRuntime) {
        // For now, function objects do not work properly. 
        // Instead, overloaded __hash function is declared.
        /*rt.defineStruct2("{global}", "hash", {
            numTemplateArgs: 1,
            factory(_dataItem: HashType<ObjectType>) { return []; }
        }, [], {});*/
        function arithmeticHashFn(sig: ArithmeticSig): common.FunHandler {
            return {
                op: "__hash",
                type: `FUNCTION I64 ( ${sig} )`,
                default(_rt: CRuntime, _template: [], x: InitArithmeticVariable): InitArithmeticVariable {
                    return variables.arithmetic("I64", x.v.value & 0x7FFFFFFF, null);
                }
            };
        }
        // NOTE: These functions are explicit (do not allow param conversions)
        // This should be noted in the future
        common.regGlobalFuncs(rt, [
            arithmeticHashFn("BOOL"),
            arithmeticHashFn("U8"),
            arithmeticHashFn("U16"),
            arithmeticHashFn("U32"),
            arithmeticHashFn("U64"),
            arithmeticHashFn("I8"),
            arithmeticHashFn("I16"),
            arithmeticHashFn("I32"),
            arithmeticHashFn("I64"),
            arithmeticHashFn("F32"),
            arithmeticHashFn("F64"),
            {
                op: "__hash",
                type: "FUNCTION I64 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _template: [], x: StringVariable): InitArithmeticVariable {
                    // NOTE: original function uses copied CLASS string < > 
                    // but to avoid costly copying, CLREF is added.
                    let h: number = 7919;
                    if (x.v.members._ptr.v.state !== "UNINIT") {
                        const ptr = x.v.members._ptr as InitIndexPointerVariable<InitArithmeticVariable>;
                        for (let i = 0; i < x.v.members._size.v.value; i++) {
                            const chr = rt.arithmeticValue(variables.arrayMember(ptr.v.pointee, ptr.v.index + i));
                            h += 97;
                            h += chr * 7907;
                            h %= 1000000009;
                        }
                    }
                    return variables.arithmetic("I64", h, null);

                }
            }
        ])

    }
}

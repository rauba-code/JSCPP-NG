import { CRuntime } from "../rt";

export = {
    load(rt: CRuntime) {
        rt.typedefs["size_t"] = { t: { sig: "U64" }, v: { lvHolder: null } }
        rt.addToNamespace("std", "size_t", rt.typedefs["size_t"]);
        rt.typedefs["ptrdiff_t"] = { t: { sig: "I64" }, v: { lvHolder: null } }
        rt.addToNamespace("std", "ptrdiff_t", rt.typedefs["ptrdiff_t"]);
    }
};

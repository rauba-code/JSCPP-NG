import { CRuntime } from "../rt";
import * as ios_base from "../shared/ios_base";
import { variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("ifstream");
        rt.include("ofstream");

        for (const [flag, bitmask] of Object.entries(ios_base.openmode)) {
            rt.addToNamespace("std::ios", flag, variables.arithmetic("I32", bitmask, "SELF", true));
        }
    }
};

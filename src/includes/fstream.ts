/* eslint-disable no-shadow */
import { CRuntime } from "../rt";
import { ios_base_openmode } from "./shared/fstream_modes";

export = {
    load(rt: CRuntime) {
        rt.include("ifstream");
        rt.include("ofstream");

        for (const [flag, bitmask] of Object.entries(ios_base_openmode)) {
            rt.addToNamespace("std::ios", flag, rt.val(rt.intTypeLiteral, bitmask));
        }
    }
};

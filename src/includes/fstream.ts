/* eslint-disable no-shadow */
import { CRuntime } from "../rt";

export = {
    load(rt: CRuntime) {
        rt.include("ifstream");
        rt.include("ofstream");
    }
};

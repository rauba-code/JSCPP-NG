import { CRuntime } from "../../rt";

// side-note: "bits/" include path is platform-dependent.
// this implementation of <bits/stdc++.h> library is based on GCC stdc++11 implementation.

export = {
    load(rt: CRuntime) {
        // NOTE: keep it sorted for pity's sake (vim function :sort)
        const includes = [
            "algorithm", 
            "cctype", 
            "climits", 
            "cmath", 
            "cstdio", 
            "cstdlib", 
            "cstring", 
            "ctime", 
            "fstream", 
            "functional", 
            "iomanip", 
            "iostream", 
            "map",
            "set",
            "sstream", 
            "string", 
            "unordered_map",
            "unordered_set",
            "vector",
        ];
        includes.forEach((path: string) => {
            rt.include(path)
        });
    }
};

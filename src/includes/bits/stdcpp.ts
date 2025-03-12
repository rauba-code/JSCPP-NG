import { CRuntime } from "../../rt";

// side-note: "bits/" include path is platform-dependent.
// this implementation of <bits/stdc++.h> library is based on GCC stdc++11 implementation.

export = {
    load(rt: CRuntime) {
        const includes = ["cctype", "climits", "cmath", "cstdio", "cstdlib", "cstring", "ctime", "algorithm", "functional", "fstream", "iomanip", "iostream", "sstream", "string", "vector"];
        includes.forEach((path: string) => {
            rt.include(path)
        });
    }
};

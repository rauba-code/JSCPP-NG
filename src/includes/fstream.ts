/* eslint-disable no-shadow */
import { CRuntime } from "../rt";

export = {
    load(rt: CRuntime) {
        rt.include("ifstream");
        rt.include("ofstream");

        const ios_base_openmode = {
            // Seek to the end of the stream before each write.
            app: 1 << 0,

            // Open with the file-position indicator at the end of the file.
            ate: 1 << 1,
            
            // Open in binary mode.
            binary: 1 << 2,

            // Open for input operations.
            in: 1 << 3,
            
            // Open for output operations.
            out: 1 << 4,
        
            // Truncate the content of the file if it exists.
            trunc: 1 << 5,
        };

        for(const [flag, bitmask] of Object.entries(ios_base_openmode)) {
            rt.addToNamespace("std::ios", flag, rt.val(rt.intTypeLiteral, bitmask));
        }
    }
};

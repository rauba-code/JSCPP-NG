isl = { 
    format: "POSIX", 
    entryPoint: "/home/user/main.cpp", 
    workingDirectory: "/home/user", 
    files: new Map([
        [
            "/home/user/main.cpp", 
            { 
                path: "/home/user/main.cpp", 
                contents: "/* hello main.cpp */" }
        ], 
        [
            "/usr/include/extra.h", 
            { 
                path: "/usr/include/extra.h", 
                contents: "/* hello extra.h */" 
            }
        ], 
        [
            "/home/user/header.h", 
            { 
                path: "/home/user/header.h", 
                contents: "/* hello header.h */" 
            }
        ]
    ]),
    includeDirectories: [
        "/usr/include"
    ] 
}

/**
 * Instance which contains the file data.
 */
export type SourceFileInstance = {
    /**
     * Absolute file path to the given source file;
     */
    readonly path: string;
    readonly contents: string;
}

/** 
 * Path resolution format.
 * Defines rules for file names, file hierarchy and file paths.
 * Only "POSIX" is currently supported.
 * "POSIX" refers to the rules defined in POSIX.1-2024 standard:
 * - The root directory is "/";
 * - Path names are case-sensitive;
 * - Directory separator is "/";
 * - File names cannot be named as "." or "..";
 * - File names are recommended to consist of only such ASCII characters: letters, digits, dash (-), underscore (_) or dot (.);
 * - Some non-ASCII characters may also be permitted outside the standard;
 * - Trailing separator for directory paths at the end (e.g. "dir/") is not required;
 * - Paths starting with tilde (e.g: "~/") are not supported;
 */
export type PathResolutionFormat = "POSIX";

/**
 * Collection of files containing the input source code.
 */
export type SourceListings = {
    /**
     * Path resolution format for given sources.
     * @see PathResolutionFormat for more details.
     */
    readonly format: PathResolutionFormat;
    /** 
     * Absolute path to the C++ source which contains 
     * the entry point (the "main" function) (e.g.: "/home/user/main.cpp").
     * MUST be a valid file present in the source listings.
     */
    readonly entryPoint: string;
    /** 
     * Absolute path to a working directory (e.g.: "/home/user").
     * MUST be an ancestor directory of the entry point file.
     */
    readonly workingDirectory: string;
    /** 
     * Files indexed by their absolute canonical path.
     */
    readonly files: ReadonlyMap<string, SourceFileInstance>;
    /** 
     * Array of directory paths that are searched for includes outside the working directory.
     * Expected to work as an "-I${include_dir}" argument of gcc;
     */
    readonly includeDirectories: readonly string[];
}


/** What file and directory names are allowed to be */
const REGEX_NAME = "[0-9\\p{XID_Start}._][\\p{XID_Continue}._-]*";
/** POSIX path but we allow Unicode letters and disallow tilde */
const POSIX_PATH_REGEX = new RegExp("^/?((" + REGEX_NAME + ")?/)*(" + REGEX_NAME + ")?$", "u");
/** The directory separator */
const POSIX_DIRSEP = "/";

function validateSplitPosixPath(path: string): string[] {
    if (!POSIX_PATH_REGEX.test(path)) {
        throw new Error(`File resolution error: Malformed path ${JSON.stringify(path)}`);
    }
    if (path === "") {
        return [];
    }
    return path.split(POSIX_DIRSEP);
}

function demanglePosixPath(spath: string[]): string {
    /** Demangled path split by the directory separator */
    const dpath: string[] = [];
    for (const name of spath) {
        switch (name) {
            case "":
                if (dpath.length === 0) {
                    /** Absolute file path */
                    dpath.push('');
                }
                break;
            case ".":
                break;
            case "..":
                /** "foo/bar/.." is "foo" */
                /** "/.." is "/" */
                /** "./.." and ".." is unresolvable */
                if (dpath.length === 0) {
                    throw new Error(`File resolution error: Cannot resolve path ${JSON.stringify(spath.join(POSIX_DIRSEP))}`);
                } else if (dpath.length > 1 || dpath[0] !== "") {
                    dpath.pop();
                }
                break;
            default:
                dpath.push(name);
        }
    }
    if (dpath.length === 1 && dpath[0] === "") {
        /** Root */
        return POSIX_DIRSEP;
    }
    return dpath.join(POSIX_DIRSEP);
}

export function canonicalPath(format: PathResolutionFormat, path: string, wd: string): string {
    if (format !== "POSIX") {
        throw new Error(`File resolution error: Path resolution format ${JSON.stringify(format)} is not supported`);
    }
    const spath = validateSplitPosixPath(path);
    const swd = validateSplitPosixPath(wd);
    if (swd.length === 0 || swd[0] !== "") {
        throw new Error(`File resolution error: Expected absolute working directory path, got relative: ${JSON.stringify(wd)}`)
    }
    if (spath.length === 0) {
        /** Empty path case */
        return demanglePosixPath(swd);
    } else if (spath[0] === "") {
        /** Absolute file path */
        return demanglePosixPath(spath);
    } else {
        /** Relative file path */
        return demanglePosixPath(swd.concat(spath));
    }
}

export function isAbsolutePath(format: PathResolutionFormat, path: string): boolean {
    if (format !== "POSIX") {
        throw new Error(`File resolution error: Path resolution format ${JSON.stringify(format)} is not supported`);
    }
    return path.startsWith(POSIX_DIRSEP);
}

export function canonicalAbsolutePath(format: PathResolutionFormat, absPath: string): string {
    /* format constraint checked by the isAbsolutePath() */
    if (!isAbsolutePath(format, absPath)) {
        throw new Error(`File resolution error: Expected absolute path, got relative: ${JSON.stringify(absPath)}`)
    }
    const spath = validateSplitPosixPath(absPath);
    /* if is absolute, then spath.length > 0 */
    return demanglePosixPath(spath);
}

export function validatedSourceListings(input: SourceListings): SourceListings {
    try {
        const files = new Map<string, SourceFileInstance>();
        for (const [path, fileInst] of input.files) {
            /* Throws if not absolute */
            const canonicalPath = canonicalAbsolutePath(input.format, path);
            /* Test if such file already exists */
            if (files.has(canonicalPath)) {
                throw new Error(`Duplicate canonical path ${JSON.stringify(canonicalPath)} (from ${JSON.stringify(path)})`);
            }
            files.set(canonicalPath, { path: canonicalPath, contents: fileInst.contents });
        }
        const workingDirectory = canonicalAbsolutePath(input.format, input.workingDirectory);
        const entryPoint = canonicalAbsolutePath(input.format, input.entryPoint);
        /* Test if entryPoint exists in files */
        if (!input.files.has(entryPoint)) {
            throw new Error(`Entry point file ${JSON.stringify(entryPoint)} does not exist in files`);
        }
        /* Test if the entry point is inside the working directory */
        if (!(workingDirectory === POSIX_DIRSEP || entryPoint.startsWith(workingDirectory + "/"))) {
            /* TODO: consider dropping this requirement as it is useless */
            throw new Error(`Entry point ${JSON.stringify(entryPoint)} is located outside a working directory ${JSON.stringify(workingDirectory)}`);
        }
        const includeDirectories = input.includeDirectories.map((includeDir) => {
            return canonicalPath(input.format, includeDir, input.workingDirectory);
        });
        return {
            format: input.format,
            entryPoint,
            workingDirectory,
            files,
            includeDirectories
        }
    } catch (e: unknown) {
        if (e instanceof Error) {
            throw new Error(`SourceListings validation error: ${e.message}`);
        } else {
            throw new Error("SourceListings validation error: (unknown)");
        }
    }
}

/**
 * Resolves an include path refered by a source file.
 * @param {SourceListings} listings
 * SourceListings expected to be validated by {@link validatedSourceListings} function.
 * 
 * @param {string} path
 * Path provided by the `#include` statement
 *
 * @param {string} sourceParentDirectory
 * Absolute canonical path for the parent directory of the caller's source file.
 *
 * @param {"quote" | "angle"} includeKind 
 * The type of angle.
 * "quote" refers to `#include ""` format
 * "angle" refers to `#include <>` format
 */
export function resolveInclude(listings: SourceListings, path: string, sourceParentDirectory: string, includeKind: "quote" | "angle"): SourceFileInstance | null {
    if (isAbsolutePath(listings.format, path)) {
        const absoluteAttempt = listings.files.get(canonicalAbsolutePath(listings.format, path));
        return absoluteAttempt ?? null;
    }
    if (includeKind === "quote") {
        const relativeAttempt = listings.files.get(canonicalPath(listings.format, path, sourceParentDirectory));
        if (typeof relativeAttempt !== "undefined") {
            return relativeAttempt;
        }
    }
    for (const includeDir of listings.includeDirectories) {
        const attempt = listings.files.get(canonicalPath(listings.format, path, includeDir));
        if (typeof attempt !== "undefined") {
            return attempt;
        }
    }
    return null;
}

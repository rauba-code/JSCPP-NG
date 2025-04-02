export const openmode = {
    /** Seek to the end of the stream before each write. */
    app: 1 << 0,

    /** Open with the file-position indicator at the end of the file. */
    ate: 1 << 1,

    /** Open in binary mode. */
    binary: 1 << 2,

    /** Open for input operations. */
    in: 1 << 3,

    /** Open for output operations. */
    out: 1 << 4,

    /** Truncate the content of the file if it exists. */
    trunc: 1 << 5,
} as const;

/** Specifies stream state flags. Multiple can be set.
  * Ref: https://en.cppreference.com/w/cpp/io/ios_base/iostate
  */
export const iostate = {
    /** No error. */
    goodbit: 0,

    /** Irrecoverable stream error. */
    badbit: 1 << 0,

    /** Input/output operation failed (formatting or extraction error). */
    failbit: 1 << 1,

    /** Associated input sequence has reached end-of-file. */
    eofbit: 1 << 2,
} as const;

export function getBit(source: number, bitmask: number) {
    return (Math.trunc(source / bitmask) % 2) === 1;
}


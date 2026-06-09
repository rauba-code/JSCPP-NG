import { CRuntime } from "../rt";
import { ArithmeticBigSig, ArithmeticNumSig, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        const ap = variables.arithmeticProperties;
        const i8: ArithmeticNumSig = "I8";
        const u8: ArithmeticNumSig = "U8";
        const i16: ArithmeticNumSig = "I16";
        const u16: ArithmeticNumSig = "U16";
        const i32: ArithmeticNumSig = "I32";
        const u32: ArithmeticNumSig = "U32";
        const i64: ArithmeticBigSig = "I64";
        const u64: ArithmeticBigSig = "U64";
        [
            { sig: i32, name: "CHAR_BIT", val: 8 },
            { sig: i32, name: "MB_LEN_MAX", val: 16 },
            { sig: i16, name: "SCHAR_MIN", val: ap[i8].minv },
            { sig: i16, name: "SCHAR_MAX", val: ap[i8].maxv },
            { sig: i16, name: "CHAR_MIN", val: ap[i8].minv },
            { sig: i16, name: "CHAR_MAX", val: ap[i8].maxv },
            { sig: u16, name: "UCHAR_MIN", val: ap[u8].minv },
            { sig: u16, name: "UCHAR_MAX", val: ap[u8].maxv },
            { sig: i16, name: "SHRT_MIN", val: ap[i16].minv },
            { sig: i16, name: "SHRT_MAX", val: ap[i16].maxv },
            { sig: u16, name: "USHRT_MIN", val: ap[u16].minv },
            { sig: u16, name: "USHRT_MAX", val: ap[u16].maxv },
            { sig: i32, name: "INT_MIN", val: ap[i32].minv },
            { sig: i32, name: "INT_MAX", val: ap[i32].maxv },
            { sig: u32, name: "UINT_MIN", val: ap[u32].minv },
            { sig: u32, name: "UINT_MAX", val: ap[u32].maxv },
            { sig: i32, name: "LONG_MIN", val: ap[i32].minv },
            { sig: i32, name: "LONG_MAX", val: ap[i32].maxv },
            { sig: u32, name: "ULONG_MIN", val: ap[u32].minv },
            { sig: u32, name: "ULONG_MAX", val: ap[u32].maxv },
        ].map(({ sig, name, val }) => rt.defVar(name, variables.arithmeticNum(sig, val as number, null, true), false, true));
        [
            { sig: i64, name: "LLONG_MIN", val: BigInt(ap[i64].minv) },
            { sig: i64, name: "LLONG_MAX", val: BigInt(ap[i64].maxv) },
            { sig: u64, name: "ULLONG_MIN", val: BigInt(ap[u64].minv) },
            { sig: u64, name: "ULLONG_MAX", val: BigInt(ap[u64].maxv) },
        ].map(({ sig, name, val }) => rt.defVar(name, variables.arithmeticBig(sig, val, null, true), false, true));
    }
}



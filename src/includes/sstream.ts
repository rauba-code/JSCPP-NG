/* eslint-disable no-shadow */
import { ArrayVariable, CRuntime, ClassType, ObjectValue, ObjectVariable, Variable, IntVariable, VariableType } from "../rt";
import { ios_base, getBit } from "./shared/ios_base";
import { read, skipSpace } from "./shared/string_utils";

interface stringStreamObject extends ObjectVariable {
    v: ObjectValue
};

const getString = function(rt: CRuntime, _this: stringStreamObject) {
    const buffer: string = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);
    const inserted_buffer: string = (_this.v.members["inserted_buffer"] as any).join("");

    return rt.makeCharArrayFromString(inserted_buffer + buffer.substring(inserted_buffer.length));
};

function _load(rt: CRuntime, class_name: string) {
    const stringStreamType: ClassType = rt.newClass(class_name, [{
        name: "buffer",
        type: rt.arrayPointerType(rt.charTypeLiteral, 0),
        initialize(rt, _this) {
            return rt.makeCharArrayFromString("");
        }
    }, {
        name: "extracted_buffer",
        type: rt.arrayPointerType(rt.charTypeLiteral, 0),
        initialize(rt, _this) {
            return null;
        }
    }, {
        name: "inserted_buffer",
        type: [] as any,
        initialize(rt, _this) {
            return [] as any;
        }
    }, {
        name: "state",
        type: rt.intTypeLiteral,
        initialize(rt, _this) {
            return rt.val(rt.intTypeLiteral, ios_base.iostate.goodbit);
        }
    }]);


    rt.addToNamespace("std", class_name, stringStreamType);

    const stringStreamTypeSig = rt.getTypeSignature(stringStreamType);
    rt.types[stringStreamTypeSig].handlers = {
        "o(())": {
            default(rt: CRuntime, _this: stringStreamObject, ...args: Variable[]) {
                const [_string] = args;

                _this.v.members["buffer"] = rt.clone(_string);
                (_this.v.members["inserted_buffer"] as any) = [];
            }
        },
        "o(bool)": {
            functions: {
                [''](rt: CRuntime, _this: stringStreamObject) {
                    const state: any = _this.v.members["state"].v as number;
                    const endOfString: boolean = getBit(state, ios_base.iostate.eofbit);
                    if (endOfString)
                        return false;

                    return _this;
                }
            },
        }
    };

    const getString = function(rt: CRuntime, _this: stringStreamObject) {
        const buffer: string = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);
        const inserted_buffer: string = (_this.v.members["inserted_buffer"] as any).join("");

        return rt.makeCharArrayFromString(inserted_buffer + buffer.substring(inserted_buffer.length));
    };

    function setBitTrue(_this: ObjectVariable, bit: number) {
        _this.v.members["state"].v = (_this.v.members["state"].v as number) | bit;
    }


    rt.regFunc(getString, stringStreamType, "str", [], rt.charTypeLiteral);


    function _panic(_rt: CRuntime, fnname: string, description: string): void {
        _rt.raiseException(fnname + "(): " + description);
    }

    function _memcpy_chr(_rt: CRuntime, dst: ArrayVariable, src: ArrayVariable, cnt: number): void {
        let chrType = _rt.charTypeLiteral;
        if (!(_rt.isTypeEqualTo(src.t.eleType, dst.t.eleType) && _rt.isTypeEqualTo(src.t.eleType, chrType))) {
            _panic(_rt, "<_memcpy_chr (inner)>", "arguments do not have a char[] type");
        }
        for (let i = 0; i < cnt; i++) {
            dst.v.target[dst.v.position + i].v = src.v.target[src.v.position + i].v;
        }
    }

    // 1) int std::sstream::get();
    //    FUNCTION I32 ( LPTR CLASS std::sstream < > )
    //
    // 2) std::sstream& std::sstream::get(char &ch);
    //    FUNCTION LPTR CLASS std::sstream < > ( LPTR CLASS std::sstream < > LPTR I8 )
    //
    // 3) std::sstream& std::sstream::get(char *s, int count);
    //    FUNCTION LPTR CLASS std::sstream < > ( LPTR CLASS std::sstream < > PTR I8 )
    //
    // 4) std::sstream& std::sstream::get(char *s, int count, char delim);
    //    FUNCTION LPTR CLASS std::sstream < > ( LPTR CLASS std::sstream < > PTR I8 I8 )
    rt.regFunc(function(_rt: CRuntime, _this: ObjectVariable, _charPtr: Variable, streamSize: IntVariable, delim: IntVariable) {
        if (_this?.t === undefined) {
            _panic(_rt, "get", "parameter 'this' is undefined");
        }
        if (_charPtr?.t === undefined) {
            if (!(streamSize?.t === undefined || delim?.t === undefined)) {
                _panic(_rt, "get", "internal error: invalid trailing arguments");
            }
            _panic(_rt, "get", "not yet implemented");
        } else if (streamSize?.t === undefined) {
            if (!(delim?.t === undefined)) {
                _panic(_rt, "get", "internal error: invalid trailing arguments");
            }
            if (!((_charPtr.left ?? false) && _rt.isTypeEqualTo(_charPtr.t, _rt.charTypeLiteral))) {
                _panic(_rt, "get", "expected argument 1 to be of 'char&' type");
            }
            _panic(_rt, "get", "not yet implemented");
        } else {
            if (!_rt.isTypeEqualTo(_charPtr.t, _rt.normalPointerType(_rt.charTypeLiteral))) {
                _panic(_rt, "get", "expected argument 1 to be of 'char*' type");
            }
            if (!_rt.isNumericType(streamSize.t)) {
                _panic(_rt, "get", "expected argument 2 to be of 'int' type");
            }
            if (delim?.t === undefined) {
                delim = _rt.val(rt.charTypeLiteral, "\n".codePointAt(0));
            } else if (!_rt.isTypeEqualTo(delim.t, _rt.charTypeLiteral)) {
                _panic(_rt, "get", "expected argument 3 to be of 'char' type");
            }

            if (getBit(_this.v.members['state'].v as number, ios_base.iostate.eofbit)) {
                setBitTrue(_this, ios_base.iostate.failbit);
                return _this;
            }
            const buffer = _this.v.members["buffer"] as ArrayVariable;
            const charPtr = _charPtr as ArrayVariable;
            let cnt = 0;
            while (buffer.v.position + cnt < buffer.v.target.length &&
                cnt < streamSize.v) {
                if (buffer.v.target[buffer.v.position + cnt].v === delim.v) {
                    break;
                }
                cnt++;
            }
            _memcpy_chr(_rt, charPtr, buffer, cnt);
            charPtr.v.target[charPtr.v.position + cnt].v = 0;
            buffer.v.target = buffer.v.target.slice(buffer.v.position + cnt);
            buffer.v.position = 0;
            if (buffer.v.target.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
            }
            if (cnt === 0) {
                setBitTrue(_this, ios_base.iostate.failbit);
            }
            return _this;
        }
    }, stringStreamType, "get", ["?"], "?" as unknown as VariableType);


    return stringStreamType;
}

export = {
    load(rt: CRuntime) {
        const iStringStreamType = _load(rt, "istringstream");
        const stringStreamType = _load(rt, "stringstream");
        const stringStreamTypeSig = rt.getTypeSignature(stringStreamType);
        const iStringStreamTypeSig = rt.getTypeSignature(iStringStreamType);

        function setBitTrue(_this: stringStreamObject, bit: number) {
            _this.v.members["state"].v = (_this.v.members["state"].v as number) | bit;
        }

        const operatorGtGt = {
            default(rt: CRuntime, _this: stringStreamObject, t: any) {
                const state: any = _this.v.members["state"].v as number;
                const endOfString: boolean = getBit(state, ios_base.iostate.eofbit);
                if (endOfString)
                    return _this;

                const extracted_buffer = (_this.v.members["extracted_buffer"] || (_this.v.members["extracted_buffer"] = getString(rt, _this))) as ArrayVariable;
                const buffer = rt.getStringFromCharArray(extracted_buffer);

                let r;
                let v;
                let b = buffer;
                switch (t.t.name) {
                    case "string":
                        b = skipSpace(b);
                        r = b.length === 0 ? ([""]) : read(rt, /^[^\s]+/, b, t.t);
                        v = rt.makeCharArrayFromString(r[0]).v;
                        break;
                    case "char": case "signed char": case "unsigned char":
                        b = skipSpace(b);
                        r = b.length === 0 ? ([""]) : read(rt, /^(?:.|\s)/, b, t.t);
                        v = r[0].charCodeAt(0);
                        break;
                    case "short": case "short int": case "signed short": case "signed short int": case "unsigned short": case "unsigned short int": case "int": case "signed int": case "unsigned": case "unsigned int": case "long": case "long int": case "signed long": case "signed long int": case "unsigned long": case "unsigned long int": case "long long": case "long long int": case "signed long long": case "signed long long int": case "unsigned long long": case "unsigned long long int":
                        b = skipSpace(b);
                        r = read(rt, /^[-+]?(?:([0-9]*)([eE]\+?[0-9]+)?)|0/, b, t.t);
                        v = parseInt(r[0], 10);
                        break;
                    case "float": case "double":
                        b = skipSpace(b);
                        r = b.length === 0 ? ([""]) : read(rt, /^[-+]?(?:[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/, b, t.t);  // fixed to allow floats such as 0
                        v = parseFloat(r[0]);
                        break;
                    case "bool":
                        b = skipSpace(b);
                        r = b.length === 0 ? ([""]) : read(rt, /^(true|false)/, b, t.t);
                        v = r[0] === "true";
                        break;
                    default:
                        rt.raiseException(">> operator in stringstream cannot accept " + rt.makeTypeString(t?.t));
                }

                const len = r[0].length;
                if (len === 0) {
                    setBitTrue(this, ios_base.iostate.eofbit);
                }

                if (len !== 0) {
                    t.v = rt.val(t.t, v).v;
                    _this.v.members["extracted_buffer"].v = rt.makeCharArrayFromString(b.substring(len)).v;
                }

                return _this;
            },
        };
        const operatorLtLt = {
            default(rt: CRuntime, _this: stringStreamObject, t: any) {
                const inserted_buffer: any = _this.v.members["inserted_buffer"];
                const inputValue = rt.isArrayType(t) ? rt.getStringFromCharArray(t as any) : t.v;

                inserted_buffer.push(inputValue);

                return _this;
            },
        };

        rt.types[iStringStreamTypeSig].handlers["o(>>)"] = operatorGtGt;

        rt.types[stringStreamTypeSig].handlers["o(>>)"] = operatorGtGt;
        rt.types[stringStreamTypeSig].handlers["o(<<)"] = operatorLtLt;
    }
};

/* eslint-disable no-shadow */
import { ArrayVariable, CRuntime, IntVariable, Variable, VariableType, ClassType } from "../rt";
import { Cin, Cout, IomanipOperator, IomanipConfig } from "./shared/iomanip_types";

const _skipSpace = function (s: string) {
    const r = /^\s*/.exec(s);
    if (r && (r.length > 0)) {
        return s.substring(r[0].length);
    } else {
        return s;
    }
};

const _read = function (rt: CRuntime, reg: RegExp, buf: string, type: VariableType) {
    const r = reg.exec(buf);
    if ((r == null) || (r.length === 0)) {
        rt.raiseException("input format mismatch " + rt.makeTypeString(type) + " with buffer=" + buf);
    } else {
        return r;
    }
};

export = {
    load(rt: CRuntime) {
        const {
            stdio
        } = rt.config;
        const cinType = rt.newClass("istream", []);

        const cin = {
            t: cinType,
            v: {
                buf: "", // stdio.drain()
                istream: stdio,
                members: {}
            },
            left: false
        };
        rt.scope[0].variables["cin"] = cin;
        const pchar = rt.normalPointerType(rt.charTypeLiteral);

        rt.types[rt.getTypeSignature(cinType)] = {
            father: "object",
            handlers: {
                "o(>>)": {
                    default(rt, _cin: Cin, t: any) {
                        stdio.cinStop();
                        if (!t.left) {
                            rt.raiseException("only left value can be used as storage");
                        }
                        if (!rt.isPrimitiveType(t.t) && !rt.isStringClass(t.t)) {
                            rt.raiseException(">> operator in istream cannot accept " + rt.makeTypeString(t.t));
                        }

                        const inputPromise: Promise<[string, boolean]> = new Promise((resolve) => {
                            let result = _cin.v.buf;
                            if (!result) {
                                stdio.getInput().then((result) => {
                                    resolve([result, false]);
                                });
                            } else {
                                resolve([result, true]);
                            }
                        });

                        inputPromise.then(([result, is_raw]) => {
                            _cin.v.buf = result;
                            let b = _cin.v.buf;
                            _cin.v.eofbit = b.length === 0;
                            let r, v;
                            switch (t.t.name) {
                                case "string": 
                                    b = _skipSpace(b);
                                    r = _read(rt, /^[^\s]+/, b, t.t);
                                    v = rt.makeCharArrayFromString(r[0]).v;
                                    break;
                                case "char": case "signed char": case "unsigned char":
                                    b = _skipSpace(b);
                                    r = _read(rt, /^./, b, t.t);
                                    v = r[0].charCodeAt(0);
                                    break;
                                case "short": case "short int": case "signed short": case "signed short int": case "unsigned short": case "unsigned short int": case "int": case "signed int": case "unsigned": case "unsigned int": case "long": case "long int": case "signed long": case "signed long int": case "unsigned long": case "unsigned long int": case "long long": case "long long int": case "signed long long": case "signed long long int": case "unsigned long long": case "unsigned long long int":
                                    b = _skipSpace(b);
                                    r = _read(rt, /^[-+]?(?:([0-9]*)([eE]\+?[0-9]+)?)|0/, b, t.t);
                                    v = parseInt(r[0], 10);
                                    break;
                                case "float": case "double":
                                    b = _skipSpace(b);
                                    r = _read(rt, /^[-+]?(?:[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)$/, b, t.t);  // fixed to allow floats such as 0                                    
                                    v = parseFloat(r[0]);
                                    break;
                                case "bool":
                                    b = _skipSpace(b);
                                    r = _read(rt, /^(true|false)/, b, t.t);
                                    v = r[0] === "true";
                                    break;
                                default:
                                    rt.raiseException(">> operator in istream cannot accept " + rt.makeTypeString(t.t));
                            }
                            const len = r[0].length;
                            _cin.v.failbit = len === 0;
                            if (!_cin.v.failbit) {
                                t.v = rt.val(t.t, v).v;
                                _cin.v.buf = b.substring(len);
                            }
                            if (!is_raw)
                                stdio.write(b + "\n");
                            stdio.cinProceed();
                        }).catch((err) => {
                            console.log(err);
                            stdio.promiseError(err);
                        });
                        return _cin;
                    }
                }
            }
        };

        const _cinString = function (rt: CRuntime, _cin: Cin, t: ArrayVariable) {
            if (!rt.isStringType(t.t)) {
                rt.raiseException("only a pointer to string can be used as storage");
            }

            let b = _cin.v.buf;
            _cin.v.eofbit = b.length === 0;

            b = _skipSpace(b);
            const r = _read(rt, /^\S*/, b, t.t)[0];
            _cin.v.failbit = r.length === 0;
            _cin.v.buf = b.substring(r.length);

            const initialPos = t.v.position;
            const tar = t.v.target;
            if ((tar.length - initialPos) <= r.length) {
                rt.raiseException(`target string buffer is ${r.length - (tar.length - initialPos)} too short`);
            }

            for (let i = 0, end = r.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                tar[i + initialPos] = rt.val(rt.wcharTypeLiteral, r.charCodeAt(i));
            }
            tar[r.length + initialPos] = rt.val(rt.wcharTypeLiteral, 0);
            return _cin;
        };
        rt.regOperator(_cinString, cin.t, ">>", [pchar], cin.t);

        const _getline = function (rt: CRuntime, _cin: Cin, t: ArrayVariable, limitV: IntVariable, delimV: IntVariable) {
            stdio.cinStop();
            stdio.getInput().then(result => {
                let removeDelim;
                _cin.v.buf = result;
                if (!rt.isStringType(t.t)) {
                    rt.raiseException("only a pointer to string can be used as storage");
                }
                const limit = limitV.v;
                const delim =
                    (delimV != null) ?
                        String.fromCharCode(delimV.v)
                        :
                        '\n';
                const b = _cin.v.buf;
                _cin.v.eofbit = b.length === 0;

                let r = _read(rt, new RegExp(`^[^${delim}]*`), b, t.t)[0];
                if ((r.length + 1) > limit) {
                    r = r.substring(0, limit - 1);
                }
                if (b.charAt(r.length) === delim.charAt(0)) {
                    removeDelim = true;
                    _cin.v.failbit = false;
                } else {
                    _cin.v.failbit = r.length === 0;
                }
                _cin.v.buf = b.substring(r.length + (removeDelim ? 1 : 0));

                const initialPos = t.v.position;
                const tar = t.v.target;
                if ((tar.length - initialPos) <= r.length) {
                    rt.raiseException(`target string buffer is ${r.length - (tar.length - initialPos)} too short`);
                }

                for (let i = 0, end = r.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                    tar[i + initialPos] = rt.val(rt.wcharTypeLiteral, r.charCodeAt(i));
                }
                tar[r.length + initialPos] = rt.val(rt.wcharTypeLiteral, 0);
                stdio.write(b + "\n");
                stdio.cinProceed();
            }).catch((err) => {
                console.log(err);
                stdio.promiseError(err);
            });
            return _cin;
        };

        rt.regFunc(_getline, cin.t, "getline", [pchar, rt.intTypeLiteral, rt.charTypeLiteral], cin.t);
        rt.regFunc(_getline, cin.t, "getline", [pchar, rt.intTypeLiteral], cin.t);

        const _get = function (rt: CRuntime, _cin: Cin) {
            const b = _cin.v.buf;
            _cin.v.eofbit = b.length === 0;

            if (_cin.v.eofbit) {
                return rt.val(rt.intTypeLiteral, -1);
            } else {
                const r = _read(rt, /^.|[\r\n]/, b, rt.charTypeLiteral);
                _cin.v.buf = b.substring(r.length);
                const v = r[0].charCodeAt(0);
                return rt.val(rt.intTypeLiteral, v);
            }
        };

        rt.regFunc(_get, cin.t, "get", [], rt.intTypeLiteral);

        const _bool = (rt: CRuntime, _cin: Cin) => rt.val(rt.boolTypeLiteral, !_cin.v.failbit);

        rt.regOperator(_bool, cin.t, "bool", [], rt.boolTypeLiteral);

        // ######################### cout
        const type = rt.newClass("coutmanipulator", []);
        
        let coutType: ClassType;
        try {
            coutType = rt.newClass("ostream", []);
        } catch (error) {
            coutType = rt.simpleClassType("ostream");
        }
        
        const cout: Cout = {
            t: coutType,
            v: {
                ostream: stdio,
                members: {}
            },
            left: false
        };
        rt.scope[0].variables["cout"] = cout;

        rt.types[rt.getTypeSignature(cout.t)] = {
            father: "object",
            handlers: {
                "o(<<)": {
                    default(rt, _cout: Cout, t: Variable) {
                        let r;
                        if (_cout.manipulators != null) {
                            t = _cout.manipulators.use(t);
                        }
                        if (rt.isPrimitiveType(t.t)) {
                            if (t.t.name.indexOf("char") >= 0) {
                                r = String.fromCharCode(t.v as number);
                            } else if (t.t.name === "bool") {
                                r = t.v ? "1" : "0";
                            } else {
                                r = t.v.toString();
                            }
                        } else if (rt.isStringType(t)) {
                            r = rt.getStringFromCharArray(t);
                        } else {
                            rt.raiseException("<< operator in ostream cannot accept " + rt.makeTypeString(t.t));
                        }
                        _cout.v.ostream.write(r);
                        return _cout;
                    }
                }
            }
        };

        const endl = rt.val(rt.charTypeLiteral, "\n".charCodeAt(0));
        rt.scope[0].variables["endl"] = endl;

        const _left: IomanipOperator = {
            t: type,
            v: {
                name: "left",
                f(config: IomanipConfig) {
                    config.left = true;
                    config.right = false;
                }
            }
        };
        rt.scope[0].variables["left"] = _left;

        const _right: IomanipOperator = {
            t: type,
            v: {
                name: "right",
                f(config: IomanipConfig) {
                    config.right = true;
                    config.left = false;
                }
            }
        };
        rt.scope[0].variables["right"] = _right;

        const _hex: IomanipOperator = {
            t: type,
            v: {
                name: "hex",
                f(config: IomanipConfig) {
                    config.hex = true;
                    config.oct = false;
                    config.dec = false;
                }
            }
        };
        rt.scope[0].variables["hex"] = _hex;

        const _oct: IomanipOperator = {
            t: type,
            v: {
                name: "oct",
                f(config: IomanipConfig) {
                    config.oct = true;
                    config.hex = false;
                    config.dec = false;
                }
            }
        };
        rt.scope[0].variables["oct"] = _oct;

        const _dec: IomanipOperator = {
            t: type,
            v: {
                name: "dec",
                f(config: IomanipConfig) {
                    config.dec = true;
                    config.oct = false;
                    config.hex = false;
                }
            }
        };
        rt.scope[0].variables["dec"] = _dec;

        const _boolalpha: IomanipOperator = {
            t: type,
            v: {
                name: "boolalpha",
                f(config: IomanipConfig) {
                    config.boolalpha = true;
                    config.noboolalpha = false;
                }
            }
        };
        rt.scope[0].variables["boolalpha"] = _boolalpha;

        const _noboolalpha: IomanipOperator = {
            t: type,
            v: {
                name: "noboolalpha",
                f(config: IomanipConfig) {
                    config.noboolalpha = true;
                    config.boolalpha = false;
                }
            }
        };
        rt.scope[0].variables["noboolalpha"] = _noboolalpha;

        const _addIOManipulator = function (rt: CRuntime, _cout: Cout, m: IomanipOperator) {
            if (!_cout.manipulators) {
                _cout.manipulators = {
                    config: {},
                    active: {},
                    use(o: Variable) {
                        let tarStr: any;
                        if (rt.isBoolType(o.t)) {
                            if (this.active.boolalpha) {
                                tarStr = o.v ? "true" : "false";
                            }
                        }
                        if (rt.isNumericType(o) && rt.isIntegerType(o) && !((o.v === 10) || (o.v === 13))) {
                            if (this.active.hex) {
                                tarStr = o.v.toString(16);
                            }
                            if (this.active.oct) {
                                tarStr = o.v.toString(8);
                            }                            
                            if (this.active.dec) {
                                tarStr = o.v.toString(10);
                            }                            
                        }
                        if (tarStr != null) {
                            return rt.makeCharArrayFromString(tarStr);
                        } else {
                            return o;
                        }
                    }
                };
            }
            m.v.f(_cout.manipulators.config);
            if (m.v.name == "hex") {
                delete _cout.manipulators.active["oct"];
                delete _cout.manipulators.active["dec"];
            }
            if (m.v.name == "oct") {

                delete _cout.manipulators.active["hex"];
                delete _cout.manipulators.active["dec"];
            }                            
            if (m.v.name == "dec") {
                delete _cout.manipulators.active["oct"];
                delete _cout.manipulators.active["hex"];
            }             
            if (m.v.name == "boolalpha") {
                delete _cout.manipulators.active["noboolalpha"];
            }             
            if (m.v.name == "noboolalpha") {
                delete _cout.manipulators.active["boolalpha"];
            }             
            _cout.manipulators.active[m.v.name] = m.v.f;
            return _cout;
        };

        rt.regOperator(_addIOManipulator, coutType, "<<", [type], coutType);

    }
};
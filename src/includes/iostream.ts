/* eslint-disable no-shadow */
import { CRuntime, OpSignature } from "../rt";
//import { Cin, Cout, IomanipOperator, IomanipConfig } from "../shared/iomanip_types";
import { sizeNonSpace, sizeUntilNewline, skipSpace } from "../shared/string_utils";
import { AbstractVariable, ArithmeticVariable, CFunction, InitArithmeticVariable, InitIndexPointerVariable, InitPointerVariable, InitValue, MaybeLeft, PointerVariable, Variable, variables } from "../variables";
import * as unixapi from "../shared/unixapi";


interface IStreamType {
    readonly sig: "CLASS",
    readonly identifier: "istream",
    readonly templateSpec: [],
    readonly memberOf: null,
};

type IStreamVariable = AbstractVariable<IStreamType, IStreamValue>;

interface IStreamValue extends InitValue<IStreamVariable> {
    members: {
        "buf": InitIndexPointerVariable<ArithmeticVariable>,
        "fd": InitArithmeticVariable,
        "eofbit": InitArithmeticVariable,
        "badbit": InitArithmeticVariable,
        "failbit": InitArithmeticVariable,
    },
}

interface OStreamType {
    readonly sig: "CLASS",
    readonly identifier: "ostream",
    readonly templateSpec: [],
    readonly memberOf: null,
};

interface OStreamValue extends InitValue<OStreamVariable> {
    members: {
        "fd": InitArithmeticVariable,
    },
}


type OStreamVariable = AbstractVariable<OStreamType, OStreamValue>;

export = {
    load(rt: CRuntime) {
        const charType = variables.arithmeticType("I8");
        rt.defineStruct("{global}", "istream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticVariable>(variables.arrayMemory(charType, []), 0, false, "SELF")
            },
            {
                name: "fd",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "eofbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "badbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "failbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
        ]);
        const cinType = rt.simpleType(["istream"]) as MaybeLeft<IStreamType>;
        const cin = variables.clone(rt.defaultValue(cinType.t, "SELF") as IStreamVariable, "SELF", false, rt.raiseException);
        variables.arithmeticAssign(cin.v.members.fd, unixapi.FD_STDIN, rt.raiseException);

        rt.addToNamespace("std", "cin", cin);

        type OpHandler = {
            type: string,
            op: OpSignature,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable | Promise<Variable>)
        };

        rt.defineStruct("{global}", "ostream", [
            {
                name: "fd",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
        ]);
        const coutType = rt.simpleType(["ostream"]) as MaybeLeft<OStreamType>;
        const cout = variables.clone(rt.defaultValue(coutType.t, "SELF") as OStreamVariable, "SELF", false, rt.raiseException);
        variables.arithmeticAssign(cout.v.members.fd, unixapi.FD_STDOUT, rt.raiseException);

        rt.addToNamespace("std", "cout", cout);

        const endl = rt.getCharArrayFromString("\n");
        rt.addToNamespace("std", "endl", endl);

        const opHandlers: OpHandler[] = [{
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > LREF Arithmetic )",
            async default(rt: CRuntime, l: IStreamVariable, r: ArithmeticVariable): Promise<IStreamVariable> {
                const stdio = rt.stdio();
                stdio.cinStop();

                const inputPromise: Promise<[boolean]> = new Promise((resolve) => {
                    let result = l.v.members.buf;
                    if (result.v.index + 1 >= result.v.pointee.values.length) {
                        stdio.getInput().then((result) => {
                            variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0, rt.raiseException);
                            resolve([false]);
                        });
                    } else {
                        resolve([true]);
                    }
                });
                try {
                    const [is_raw] = await inputPromise;
                    let b = l.v.members.buf;
                    variables.arithmeticAssign(l.v.members.eofbit, (b.v.pointee.values.length === 0) ? 1 : 0, rt.raiseException);
                    skipSpace(rt, b);
                    const len = sizeNonSpace(rt, b);
                    const strseq = rt.getStringFromCharArray(b, len);
                    const num = Number.parseFloat(strseq);
                    if (Number.isNaN(num)) {
                        variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                        stdio.cinProceed();
                        return l;
                    }
                    variables.arithmeticAssign(r, num, rt.raiseException);
                    rt.adjustArithmeticValue((r as InitArithmeticVariable));
                    variables.arithmeticAssign(l.v.members.failbit, (len === 0) ? 1 : 0, rt.raiseException);
                    variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + len, rt.raiseException);

                    if (stdio.isMochaTest) {
                        stdio.write(String(rt.arithmeticValue(r)) + "\n");
                    } else if (!is_raw) {
                        stdio.write(String(strseq) + "\n");
                    }

                    stdio.cinProceed();
                    return l;
                } catch (err) {
                    console.log(err);
                    stdio.promiseError(err.message);
                    return l;
                }
            }

        },
        {
            op: "o(_<<_)",
            type: "FUNCTION LREF CLASS ostream < > ( LREF CLASS ostream < > PTR I8 )",
            default(rt: CRuntime, l: OStreamVariable, r: PointerVariable<ArithmeticVariable>): OStreamVariable {
                const iptr = variables.asInitIndexPointerOfElem(r, variables.uninitArithmetic("I8", null));
                if (iptr === null) {
                    rt.raiseException("Variable is not an initialised index pointer");
                }
                unixapi.write(rt, l.v.members.fd, iptr);
                return l;
            }
        },
        {
            op: "o(_<<_)",
            type: "FUNCTION LREF CLASS ostream < > ( LREF CLASS ostream < > Arithmetic )",
            default(rt: CRuntime, l: OStreamVariable, r: ArithmeticVariable): OStreamVariable {
                const str = rt.getCharArrayFromString(String(rt.arithmeticValue(r)))
                unixapi.write(rt, l.v.members.fd, str);
                return l;
            }
        }
        ];

        opHandlers.forEach((x) => {
            rt.regFunc(x.default as CFunction, "{global}", x.op, rt.typeSignature(x.type));
        })


        type FunHandler = {
            type: string,
            op: string,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable)
        };
        function _getline(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0, rt.raiseException);
                        resolve([false, l]);
                    });
                } else {
                    resolve([true, l]);
                }
            });
            inputPromise.then(([_is_raw, l]) => {
                let b = l.v.members.buf;
                const count = rt.arithmeticValue(_count);
                const delim = rt.arithmeticValue(_delim);
                const s = variables.asInitIndexPointerOfElem(_s, variables.uninitArithmetic("I8", null));
                if (s === null) {
                    rt.raiseException("Not an index pointer");
                }
                const oldiptr = variables.clone(b, "SELF", false, rt.raiseException);
                variables.arithmeticAssign(l.v.members.eofbit, (b.v.pointee.values.length === 0) ? 1 : 0, rt.raiseException);
                let cnt = 0;
                while (cnt < count - 1) {
                    const si = rt.unbound(variables.arrayMember(s.v.pointee, s.v.index + cnt)) as ArithmeticVariable;
                    const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(b, b.v.index + 1, rt.raiseException);
                        break;
                    }
                    variables.arithmeticAssign(si, bi, rt.raiseException);
                    variables.indexPointerAssignIndex(b, b.v.index + 1, rt.raiseException);
                    cnt++;
                }
                if (cnt === 0) {
                    variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                }

                debugger;
                stdio.write(rt.getStringFromCharArray(oldiptr, b.v.index - oldiptr.v.index));

                stdio.cinProceed();
            }).catch((err) => {
                console.log(err);
                stdio.promiseError(err.message);
            })
            return l;
        }

        const cinHandlers: FunHandler[] = [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS istream < > )",
                default(rt: CRuntime, l: IStreamVariable): InitArithmeticVariable {
                    /*const stdio = rt.stdio();
                    stdio.cinStop();
                    const inputPromise: Promise<[boolean]> = new Promise((resolve) => {
                        let result = l.v.members.buf;
                        if (result.v.index >= result.v.pointee.values.length) {
                            stdio.getInput().then((result) => {
                                variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result).v.pointee, 0, rt.raiseException);
                                resolve([false]);
                            });
                        } else {
                            resolve([true]);
                        }
                    });
                    try {
                        const [is_raw] = await inputPromise;*/
                    let b = l.v.members.buf;
                    if (b.v.pointee.values.length === 0) {
                        variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                    }
                    const top = variables.arrayMember(b.v.pointee, b.v.index);
                    if (top.v.state === "UNBOUND") {
                        debugger;
                        return variables.arithmetic("I32", -1, null);
                    }
                    //if (eof) {
                    //    variables.arithmeticAssign(l.v.members.failbit, (len === 0) ? 1 : 0, rt.raiseException);
                    //}
                    variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + 1, rt.raiseException);

                    /*if (stdio.isMochaTest) {
                        stdio.write(String(rt.arithmeticValue(top)) + "\n");
                    } else if (!is_raw) {
                        stdio.write(String(rt.arithmeticValue(top)) + "\n");
                    }*/

                    //stdio.cinProceed();
                    debugger;
                    return variables.clone((rt.expectValue(top) as InitArithmeticVariable), null, false, rt.raiseException);
                    /*} catch (err) {
                        console.log(err);
                        stdio.promiseError(err.message);
                        return variables.arithmetic("I32", -1, null);
                    }*/
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, _delim);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 )",
                default(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"));
                }
            }
        ]

        cinHandlers.forEach((x) => {
            rt.regFunc(x.default, cin.t, x.op, rt.typeSignature(x.type));
        })

        /*const _cinString = function(rt: CRuntime, _cin: Cin, t: ArrayVariable) {
            if (!rt.isStringType(t.t)) {
                rt.raiseException("only a pointer to string can be used as storage");
            }
            stdio.cinStop();
            stdio.getInput().then(result => {
                _cin.v.buf = result;

                let b = _cin.v.buf;
                _cin.v.eofbit = b.length === 0;

                b = skipSpace(b);*/
        //const r = read(rt, /^\S*/, b, t.t)[0];
        /*_cin.v.failbit = r.length === 0;
        _cin.v.buf = b.substring(r.length);

        const initialPos = t.v.position;
        const tar = t.v.target;
        if ((tar.length - initialPos) <= r.length) {
            rt.raiseException(`target string buffer is ${r.length - (tar.length - initialPos)} too short`);
        }

        for (let i = 0, end = r.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            tar[i + initialPos] = rt.val(rt.charTypeLiteral, r.charCodeAt(i));
        }
        tar[r.length + initialPos] = rt.val(rt.charTypeLiteral, 0);
        stdio.cinProceed();
    }).catch((err) => {
        console.log(err);
        stdio.promiseError(err.message);
    });

    return _cin;
};
rt.regOperator(_cinString, cin.t, ">>", [pchar], cin.t);

const _getline = function(rt: CRuntime, _cin: Cin, t: ArrayVariable, limitV: IntVariable, delimV: IntVariable) {
    stdio.cinStop();
    stdio.getInput().then(result => {
        let removeDelim;
        _cin.v.buf = result;
        if (!rt.isStringType(t.t)) {
            rt.raiseException("only a pointer to string can be used as storage");
        }
        const limit = limitV.v;
        const delim = (delimV != null) ? String.fromCharCode(delimV.v) : '\n';
        const b = _cin.v.buf;
        _cin.v.eofbit = b.length === 0;

        let r = read(rt, new RegExp(`^[^${delim}]*`), b, t.t)[0];
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
            tar[i + initialPos] = rt.val(rt.charTypeLiteral, r.charCodeAt(i));
        }
        tar[r.length + initialPos] = rt.val(rt.charTypeLiteral, 0);

        stdio.write(b + "\n");
        stdio.cinProceed();
    }).catch((err) => {
        console.log(err);
        stdio.promiseError(err.message);
    });
    return _cin;
};

rt.regFunc(_getline, cin.t, "getline", [pchar, rt.intTypeLiteral, rt.charTypeLiteral], cin.t);
rt.regFunc(_getline, cin.t, "getline", [pchar, rt.intTypeLiteral], cin.t);

const _get = function(rt: CRuntime, _cin: Cin) {
    const b = _cin.v.buf;
    _cin.v.eofbit = b.length === 0;

    if (_cin.v.eofbit) {
        return rt.val(rt.intTypeLiteral, "\n".charCodeAt(0));
    } else {
        const r = read(rt, /^.|[\r\n]/, b, rt.charTypeLiteral);
        _cin.v.buf = b.substring(r.length);
        const v = r[0].charCodeAt(0);
        return rt.val(rt.intTypeLiteral, v);
    }
};

rt.regFunc(_get, cin.t, "get", [], rt.intTypeLiteral);

const _bool = (rt: CRuntime, _cin: Cin) => rt.val(rt.boolTypeLiteral, !_cin.v.failbit);

rt.regOperator(_bool, cin.t, "bool", [], rt.boolTypeLiteral);

// ######################### cout*/

        /*const type = rt.newClass("coutmanipulator", []);

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

        rt.addToNamespace("std", "cout", cout);
        rt.addToNamespace("std", "cerr", cout);

        const coutTypeSig = rt.getTypeSignature(cout.t);
        rt.types[coutTypeSig].handlers = {
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
                        rt.raiseException("<< operator in ostream cannot accept " + rt.makeTypeString(t?.t));
                    }
                    _cout.v.ostream.write(r);
                    return _cout;
                }
            }
        };

        const endl = rt.val(rt.charTypeLiteral, "\n".charCodeAt(0));
        rt.addToNamespace("std", "endl", endl);

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
        rt.addToNamespace("std", "left", _left);

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
        rt.addToNamespace("std", "right", _right);

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
        rt.addToNamespace("std", "hex", _hex);

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
        rt.addToNamespace("std", "oct", _oct);

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
        rt.addToNamespace("std", "dec", _dec);

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
        rt.addToNamespace("std", "boolalpha", _boolalpha);

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
        rt.addToNamespace("std", "noboolalpha", _noboolalpha);

        const _addIOManipulator = function(rt: CRuntime, _cout: Cout, m: IomanipOperator) {
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

        rt.regOperator(_addIOManipulator, coutType, "<<", [type], coutType);*/

    }
};

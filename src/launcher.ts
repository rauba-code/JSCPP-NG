// logger = require("tracer").colorConsole();
import { CRuntime, CRuntimeError, IncludeModule, JSCPPConfig, mergeConfig } from "./rt";

import { Interpreter } from "./interpreter";
import ast = require("./ast");
import preprocessor = require("./preprocessor");
import Debugger from "./debugger"
// @ts-ignore;
import * as PEGUtil from "pegjs-util";
import * as defaults from "./defaults";
import { InitArithmeticValue, MaybeUnboundArithmeticValue } from "./variables";

const includes: { [fileName: string]: IncludeModule } = {
    iostream: require("./includes/iostream"),
    iomanip: require("./includes/iomanip"),
    _bits__unixapi: require("./includes/bits/unixapi"),
    ifstream: require("./includes/ifstream"),
    ofstream: require("./includes/ofstream"),
    fstream: require("./includes/fstream"),
    cstring: require("./includes/cstring"),
    ctime: require("./includes/ctime"),
    climits: require("./includes/climits"),
    cmath: require("./includes/cmath"),
    cstdlib: require("./includes/cstdlib"),
    cstddef: require("./includes/cstddef"),
    cstdio: require("./includes/cstdio"),
    string: require("./includes/string"),
    sstream: require("./includes/sstream"),
    algorithm: require("./includes/algorithm"),
    vector: require("./includes/vector"),
    set: require("./includes/set"),
    unordered_set: require("./includes/unordered_set"),
    cctype: require("./includes/cctype"),
    numeric: require("./includes/numeric"),
    utility: require("./includes/utility"),
    map: require("./includes/map"),
    // array: require("./includes/array"),
    iterator: require("./includes/iterator"),
    /*functional: require("./includes/functional"),
    _bits__stdcpp: require("./includes/bits/stdcpp")*/
};

const headerAlias: { [filename: string]: string } = {
    "ctype.h": "cctype",
    "limits.h": "climits",
    "string.h": "cstring",
    "math.h": "cmath",
    "stdio.h": "cstdio",
    "stdlib.h": "cstdlib",
    "stddef.h": "cstddef",
    //"bits/stdc++.h": "_bits__stdcpp",
    "bits/unixapi.h": "_bits__unixapi",
    "time.h": "ctime"
};

for (const alias of Object.keys(headerAlias)) {
    const realName = headerAlias[alias];
    includes[alias] = includes[realName];
}

export type InputFunction = () => Promise<string>;

function run(code: string, input: InputFunction, config: JSCPPConfig): Debugger | number | void {
    let step;
    let inputbuffer = ""; // input.toString();
    let proceed = true;
    let startTime: number;
    let readResult = "";

    const fstream = (function() {
        const testFiles: any = {
            "TestInput.txt": { value: "4 2 2 147.00 80.15 1 2 163.00 95.50 2 1 147.00 80.15 1 1 163.00 95.50" },
            "TestOutput.txt": { value: "" }
        };

        const openFiles: any = {};

        return {
            open(_context: object, fileName: string) {
                const openFileNode: any = testFiles[fileName] || ({ [fileName]: { value: "" } });
                openFiles[fileName] = {
                    name: fileName,
                    _open: openFileNode != null,
                    is_open() {
                        return this._open;
                    },
                    read() {
                        if (!this.is_open())
                            return;

                        return openFileNode.value;
                    },
                    clear() {
                        openFileNode.value = "";
                    },
                    write(data: string) {
                        if (!this.is_open())
                            return;

                        openFileNode.value += data;
                    },
                    close() {
                        this._open = false;
                    }
                };

                return openFiles[fileName];
            }
        };
    })();

    const _config: JSCPPConfig = {
        fstream,
        stdio: {
            promiseError(promise_error) {
                console.log(promise_error.message);
            },
            cinStop() {
                handleStop();
            },
            cinProceed() {
                handleProceed();
            },
            cinState() {
                return proceed;
            },
            setReadResult(_result: string) {
                readResult = _result;
            },
            getReadResult() {
                return readResult;
            },
            drain() {
                const x = inputbuffer;
                inputbuffer = "";
                return x;
            },
            getInput(): Promise<string> {
                return Promise.resolve(input?.() ?? "'InputFunction' is missing.");
            },
            finishCallback(_ExitCode: number) {

            },
            write(s) {
                process.stdout?.write(s); // write to node.js standard output
            }
        },
        includes: this.includes,
        loadedLibraries: [],
        unsigned_overflow: "error",
    };

    function handleStop() {
        proceed = false;
    }

    function handleProceed() {
        proceed = true;
        performStep();
    }

    let performedSteps = 0;
    async function performStep() {
        try {
            while (proceed) {
                if (_config.stopExecutionCheck?.())
                    throw new Error("Execution terminated manually.");

                step = mainGen.next();
                performedSteps++;

                if (step.done) {
                    const exitVal = step.value.v as MaybeUnboundArithmeticValue;
                    if (exitVal.state === "UNINIT") {
                        throw new Error("[return statement] Access of an uninitialised variable");
                    } else if (exitVal.state === "UNBOUND") {
                        throw new Error("[return statement] Access of an out-of-bounds variable");
                    } else {
                        const exitCode = (exitVal as InitArithmeticValue).value;
                        (_config.stdio as any).finishCallback(exitCode);
                        return exitCode;
                    }
                }
                if (performedSteps > (_config.maxExecutionSteps as number))
                    throw new Error("The execution step limit has been reached.");
                else if (_config.maxTimeout && ((Date.now() - startTime) > _config.maxTimeout))
                    throw new Error("Time limit exceeded.");

                if ((performedSteps % (_config.eventLoopSteps as number)) === 0) {
                    await new Promise((resolve) => setImmediate(resolve));
                }
            }
        } catch (error) {
            (_config.stdio as any).promiseError(error);
        }
    }

    mergeConfig(_config, config);
    const rt = new CRuntime(_config);
    defaults.addDefaultOperations(rt);

    code = code.toString();
    const oldCode = code;
    const pcode = preprocessor.parse(rt, code);

    const mydebugger = new Debugger(pcode, oldCode);

    const result = PEGUtil.parse(ast, pcode);
    if (result.error != null) {
        throw new CRuntimeError(`[line ${result.error.line}:${result.error.column}] Syntax error`, result.error.line, result.error.column);
    }
    const interpreter = new Interpreter(rt);
    const defGen = interpreter.run(result.ast, pcode);
    while (true) {
        step = defGen.next();
        if (step.done) { break; }
    }
    const mainGen = rt.invokeCall(rt.getFuncByParams("{global}", "main", [], []), []) as Generator;
    if (_config.debug) {
        mydebugger.start(rt, mainGen);
        return mydebugger;
    } else {
        startTime = Date.now();
        performStep();
        /*
        while (true) {
            step = mainGen.next();
            if (step.done) { break; }
            if (_config.maxTimeout && ((Date.now() - startTime) > _config.maxTimeout)) {
                throw new Error("Time limit exceeded.");
            }
        }
        */
        // return step.value.v as number;
    }
}

export default {
    includes,
    run,
};

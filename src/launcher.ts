// logger = require("tracer").colorConsole();
import { CRuntime, IncludeModule, JSCPPConfig, mergeConfig } from "./rt";

import { Interpreter } from "./interpreter";
const ast = require("./ast");
const preprocessor = require("./preprocessor");
import Debugger from "./debugger"
// @ts-ignore;
import * as PEGUtil from "pegjs-util";

const includes: { [fileName: string]: IncludeModule } = {
    string: require("./includes/string"),
    iostream: require("./includes/iostream"),
    cctype: require("./includes/cctype"),
    climits: require("./includes/climits"),
    cstring: require("./includes/cstring"),
    cmath: require("./includes/cmath"),
    cstdio: require("./includes/cstdio"),
    cstdlib: require("./includes/cstdlib"),
    ctime: require("./includes/ctime"),
    iomanip: require("./includes/iomanip"),
    foo: require("./includes/dummy_class_foo")
};

const headerAlias: { [filename: string]: string } = {
    "ctype.h": "cctype",
    "limits.h": "climits",
    "string.h": "cstring",
    "math.h": "cmath",
    "stdio.h": "cstdio",
    "stdlib.h": "cstdlib",
    "time.h": "ctime"
};

for (const alias of Object.keys(headerAlias)) {
    const realName = headerAlias[alias];
    includes[alias] = includes[realName];
}

type InputFunction = () => Promise<string>;

function run(code: string, input: InputFunction, config: JSCPPConfig): Debugger | number {
    let step;
    let inputbuffer = ""; //input.toString();
    let proceed = true;
    let startTime: number;
    let readResult = "";

    const _config: JSCPPConfig = {
        stdio: {
            promiseError(promise_error) {
                console.log(promise_error);
            },
            cinStop() {
                handleStop();
            },
            cinProceed() {
                handleProceed();
            },
            setReadResult(result: string) {
                readResult = result;
            },
            getReadResult() {
                return readResult;
            },
            drain() {
                const x = inputbuffer;
                inputbuffer = null;
                return x;
            },
            getInput() {
                return input();
            },
            finishCallback(ExitCode: number) {

            },
            write(s) {
                process.stdout.write(s);
            }
        },
        includes: this.includes,
        unsigned_overflow: "error"
    };

    function handleStop() {
        proceed = false;
    }

    function handleProceed() {
        proceed = true;
        performStep();
    }

    function performStep() {
        while (proceed) {
            step = mainGen.next();
            if (step.done) { 
                _config.stdio.finishCallback(step.value.v as number);
                return; 
            }
            if (_config.maxTimeout && ((Date.now() - startTime) > _config.maxTimeout)) {
                throw new Error("Time limit exceeded.");
            }
        }
    }    

    mergeConfig(_config, config);
    const rt = new CRuntime(_config);
    code = code.toString();
    const oldCode = code;
    code = preprocessor.parse(rt, code);

    const mydebugger = new Debugger(code, oldCode);

    const result = PEGUtil.parse(ast, code);
    if (result.error != null) {
        throw new Error("ERROR: Parsing Failure:\n" + PEGUtil.errorMessage(result.error, true));
    }
    const interpreter = new Interpreter(rt);
    const defGen = interpreter.run(result.ast, code);
    while (true) {
        step = defGen.next();
        if (step.done) { break; }
    }
    const mainGen = rt.getFunc("global", "main", [])(rt, null);
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
        //return step.value.v as number;
    }
}

export default {
    includes,
    run,
};

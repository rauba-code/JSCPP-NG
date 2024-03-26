type Callback = (result: boolean) => void;
import { strict as assert } from 'assert';
import * as fs from "fs";
import JSCPP, { InputFunction } from "../src/launcher";
import * as chai from "chai";
import * as yaml from "js-yaml";
import * as Mocha from "mocha";

let _describe: Mocha.SuiteFunction | ((title: string, cb: () => void) => void);
let _it: Mocha.TestFunction | ((title: string, cb: () => void) => void);

const {
    expect
} = chai;

interface SingleTestCase {
    cpp: string;
    in?: string;
    out?: string;
    exception?: string;
    exitcode?: number;
    config?: any;
    after?: string[];
}

interface TestCase {
    after: string[];
    cases: SingleTestCase | SingleTestCase[];
}

interface Test {
    name: string;
    test: TestCase
}

const testFolder = './unit-tests/';

const prepareOutput = function(str: string) {
    if (str != null) {
        return str.replace(/\r\n/g, "\n").replace(/\r/, "\n").replace(/[ \t]+\n/, "\n").replace(/\s$/, "");
    }
    return "";
};

if (process.argv[2] === "direct") {
    _describe = (title: string, cb: () => void) => { cb(); };
    _it = function (title: string, cb: () => void) {
        try {
            cb();
            console.log("passed");
        } catch (err) {
            console.log("failed");
        }
    };
} else {
    _describe = describe;
    _it = it;
}

const passedTest: string[] = [];
const failedTest: string[] = [];
const skippedTest: { name: string; reason: string }[] = [];

const doTest = function (test: TestCase, cb: (result: boolean | "skip", reason?: string) => void) {
    let success = true;
    let { cases } = test;
    if (!Array.isArray(cases)) {
        cases = [cases];
    }
    doCases(cases, result => success = success && result);
    cb(success);
};

function doCases(cases: SingleTestCase[], cb: Callback) {
    let success = true;
    for (const sample of cases) {
        const cppFile = sample.cpp;
        const code = fs.readFileSync(testFolder + cppFile, "utf-8");
        const input = sample.in;
        const expected = sample.out;
        const except = sample.exception ?? "default_exception";
        const { exitcode, config } = sample;
        _describe(`${cppFile}`, () => doSample(code, input, expected, except, exitcode, config, (result: boolean) => success = success && result));
    }
    cb(success);
};

function doSample(code: string, input: string, expected: string | null, except: string | null, exp_exitcode: number | undefined, config: any, cb: Callback) {
    let exitcode: number;
    let outputBuffer = "";
    let takenInputIdx = 0;

    config = {
        ...config,
        stdio: {
            isMochaTest: true,
            write(str: string) {
                outputBuffer += str;
                return str.length;
            },
            finishCallback(ExitCode: number) {
                exitcode = ExitCode;
            },
            promiseError(e: string) {
                if (except) {
                    _it("expected exception", function() {
                        const eStr = prepareOutput(e.toString());
                        const ok = eStr!.match(except);
                        assert.ok(ok);
                        cb(ok != null);
                    });
                } else {
                    _it("an error occurred", function () {
                        console.log(e);
                        assert.ok(false);
                        cb(false);
                    });
                }
            },
            getInput() { 
                return Promise.resolve(input.split("\n")[takenInputIdx++]);
            },
        },
        // maxTimeout: 5 * 1000 // should be set insided test.yaml for each test-case
    };
    try {
        JSCPP.run(code, () => Promise.resolve(input), config);
    } catch (e) {
        config.stdio.promiseError(e);
    } finally {
        if (expected != null) {
            _it("should match expected output", function() {
                const trimmedOutputBuffer = outputBuffer.trimEnd();
                const trimmedExpectedBuffer = expected.trimEnd();

                expect(trimmedOutputBuffer).to.equal(trimmedExpectedBuffer);
                return cb(trimmedOutputBuffer === trimmedExpectedBuffer);
            });
        } else if (exp_exitcode != null) {
            _it("should match exit code", function () {
                expect(exitcode).to.equal(exp_exitcode);
                cb(exitcode === exp_exitcode);
            });
        }
    }
};

const tests = yaml.load(fs.readFileSync(testFolder + "test.yaml", "utf-8")) as { tests: { [testName: string]: TestCase } };
const todolist: Test[] = [];

for (const testName of Object.keys(tests.tests)) {
    const test = tests.tests[testName];
    todolist.push({
        name: testName,
        test
    });
}

const totalNum = todolist.length;

const tryAddTest = function (testName: string, test: TestCase) {
    const { after } = test;

    let waitingFor: string = "";
    if (after != null) {
        for (const dep of after) {
            if (!passedTest.includes(dep)) {
                if (failedTest.includes(dep)) {
                    testFinished(testName)("skip", `test ${testName} failed`);
                    break;
                } else if (skippedTest.find(t => t.name === dep) != null) {
                    testFinished(testName)("skip", `test ${testName} skipped`);
                    return;
                } else {
                    waitingFor = dep;
                    break;
                }
            }
        }
    }

    if (waitingFor !== "") {
        if (!pendingTests.has(waitingFor)) {
            pendingTests.set(waitingFor, []);
        }
        
        pendingTests.get(waitingFor)?.push({
            name: testName,
            test
        });
    } else {
        _describe(testName, () => doTest(test, testFinished(testName)));
    }
};

const pendingTests = new Map<string, Test[]>();

function testFinished(testName: string) {
    return (function (result: boolean | "skip", reason?: string) {
        if (result === true) {
            passedTest.push(testName);
        } else if (result === false) {
            failedTest.push(testName);
        } else if (result === "skip") {
            skippedTest.push({
                name: testName,
                reason: reason ?? "undefined"
            });
        }

        if (pendingTests.has(testName)) {
            let awaitingTask: Test | undefined;
            const tasks = pendingTests.get(testName);
            while (tasks != null && (awaitingTask = tasks.pop()) != null) {
                if (result === true) {
                    tryAddTest(awaitingTask.name, awaitingTask.test);
                } else if (result === false) {
                    testFinished(awaitingTask.name)("skip", `test ${testName} failed`);
                } else if (result === "skip") {
                    testFinished(awaitingTask.name)("skip", `test ${testName} skipped`);
                }
            }

            if ((tasks != null ? tasks.length : undefined) === 0) {
                pendingTests.delete(testName);
            }
        }

        if (todolist.length === 0) {
            // should finish
            if (pendingTests.size > 0) {
                console.warn(`circular task dependency detected ${(() => {
                    const result1: string[] = [];
                    for (const t of pendingTests.entries()) {
                        result1.push(t[0]);
                    }
                    return result1;
                })()}`);
            }

            if ((failedTest.length + passedTest.length + skippedTest.length) === totalNum) {
                skippedTest.map((skipped) =>
                    console.warn(`${skipped.name} is skipped because ${skipped.reason}`));
            }
        }
    });
};

let task: Test | undefined;
while ((task = todolist.shift())) {
    tryAddTest(task.name, task.test);
}
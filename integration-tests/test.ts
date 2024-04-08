import JSCPP from "../src/launcher";
import { XMLParser } from "fast-xml-parser";
import { strict as assert } from 'assert';
import * as fs from "fs";
import * as chai from "chai";
import * as Mocha from "mocha";
import { JSCPPConfig } from "../src/rt";

const { expect } = chai;

interface SingleTestCase {
    testID?: string;
    fileName: string;
    code: string;
    scenarios: TestScenario;
    exception?: string;
    exitcode?: number;
    config?: JSCPPConfig | any;
}

interface TestScenario {
    input_filename?: string;
    output_filename?: string;
    input: string;
    output: string;
}

interface TestCase {
    after: string[];
    cases: SingleTestCase | SingleTestCase[];
}

interface Test {
    name: string;
    test: TestCase
}

const testRunner = (function() {
    const prepareOutput = function(str: string) {
        if (str != null) {
            return str.replace(/\r\n/g, "\n").replace(/\r/, "\n").replace(/[ \t]+\n/, "\n").replace(/\s$/, "");
        }
        return "";
    };

    type Callback = (result: boolean) => void;

    let _describe: Mocha.SuiteFunction | ((title: string, cb: () => void) => void);
    let _it: Mocha.TestFunction | ((title: string, cb: () => void) => void);
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

    let todolist: Test[];

    const passedTest: string[] = [];
    const failedTest: string[] = [];
    const skippedTest: { name: string; reason: string }[] = [];
    const pendingTests = new Map<string, Test[]>();

    const doSample = function(sample: SingleTestCase, cb: Callback) {
        let outputBuffer = "";

        let { code, scenarios: { input, output: expected, input_filename, output_filename }, exception, exitcode, config } = sample;

        const fstream = (input_filename || output_filename) && (function() {
            const testFiles: any = { 
                [input_filename]: { value: input }, 
                [output_filename]: { value: "" } 
            };
    
            const openFiles: any = {};
    
            return {
                open: function(context: object, fileName: string) {
                    const openFileNode: any = testFiles[fileName] || ({ [fileName]: { value: "" } });
                    openFiles[fileName] = { 
                        name: fileName,
                        _open: openFileNode != null, 
                        is_open: function() {
                            return this._open;
                        },
                        read: function() {
                            if (!this.is_open())
                                return;
            
                            return openFileNode.value;
                        },
                        clear: function() {
                            openFileNode.value = "";
                        },
                        write: function(data: string) {
                            if (!this.is_open())
                                return;
            
                            openFileNode.value += data;
                        },
                        close: function() {
                            this._open = false;
                        }
                    };
    
                    return openFiles[fileName];
                },

                getExpectedOutput: function() {
                    outputBuffer = testFiles[output_filename as string].value;
                }
            };
        })();

        config = {
            ...config,
            fstream,
            stdio: {
                isMochaTest: true,
                write(str: string) {
                    outputBuffer += str;
                    return str.length;
                }
            },
            maxTimeout: 5000
        };

        try {
            exitcode = JSCPP.run(code, () => Promise.resolve(input), config) as number;
        } catch (e) {
            if (exception) {
                _it("expected exception", function() {
                    const eStr = prepareOutput(e.toString());
                    const ok = eStr!.match(exception as string);
                    assert.ok(ok);
                    cb(ok != null);
                });
            } else {
                _it("an error occurred", function() {
                    console.log(e);
                    assert.ok(false);
                    cb(false);
                });
            }
        } finally {
            if (expected != null) {
                _it("should match expected output", function() {
                    output_filename && (fstream as any)?.getExpectedOutput();

                    const trimmedOutputBuffer = outputBuffer.trimEnd();
                    const trimmedExpectedBuffer = expected.trimEnd();

                    expect(trimmedOutputBuffer).to.equal(trimmedExpectedBuffer);
                    return cb(trimmedOutputBuffer === trimmedExpectedBuffer);
                });
            } else if (exitcode != null) {
                _it("should match exit code", function () {
                    expect(exitcode).to.equal(exitcode);
                    cb(exitcode === exitcode);
                });
            }
        }
    };

    const doCases = function(cases: SingleTestCase[], cb: Callback) {
        let success = true;

        for(let i=0; i < cases.length; i++) {
            const sample = cases[i];

            _describe((sample.testID ?? `test_${i + 1}`), () => doSample(sample, (result: boolean) => success = success && result));
        }

        cb(success);
    };

    const doTest = function (test: TestCase, cb: (result: boolean | "skip", reason?: string) => void) {
        let success = true;
        let { cases } = test;
        if (!Array.isArray(cases)) {
            cases = [cases];
        }
        doCases(cases, result => success = success && result);
        cb(success);
    };

    const testFinished = function(testName: string) {
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

                if ((failedTest.length + passedTest.length + skippedTest.length) === todolist.length) {
                    skippedTest.map((skipped) => console.warn(`${skipped.name} is skipped because ${skipped.reason}`));
                }
            }
        });
    };

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

    return {
        run: function(tests: Test[]) {
            todolist = tests;

            let task: Test | undefined;
            while ((task = todolist.shift())) {
                tryAddTest(task.name, task.test);
            }
        }
    }
})();

const parseFromXML = (function() {
    const parser = new XMLParser({
        ignoreAttributes: false
    });

    return function(filePath: string, fileName: string): object {
        const xml_content = fs.readFileSync(filePath + fileName, "utf-8");
        const parsedObject = parser.parse(xml_content);
        
        return {
            fileName,
            ...parsedObject
        };
    };
})();

const objectToTest = (function() {
    const parseConsoleInput = function(parsed: any): TestScenario {
        return {
            input: parsed.input["#text"],
            output: parsed.output["#text"]
        };
    };

    const parseFileInput = function(parsed: any): TestScenario {
        if (!parsed)
            return ({} as TestScenario);

        return {
            input_filename: parsed.input?.["@_filename"],
            output_filename: parsed.output?.["@_filename"],
            input: parsed.input?.["#text"],
            output: parsed.output?.["#text"]
        };
    };

    const mergeScenarios = function(obj1: any, obj2: any): TestScenario {
        const result = { ...obj1 };
        for (const key in obj2) {
            if (obj2[key] != null)
                result[key] = obj2[key];
        }
        return result;
    };

    return function(object: any): Test {
        const fileName: string = object.fileName.replace(".xml", "");
    
        return {
            name: fileName,
            test: {
                after: [],
                cases: [object.tests.test].flat().map((test: any) => ({
                    testID: test["@_id"],
                    fileName: fileName,
                    code: object.code,
                    scenarios: mergeScenarios(parseConsoleInput(test.console), parseFileInput(test.files))
                }) as SingleTestCase)
            }
        };
    };
})();

const readAllTests = (function() {
    const path = require('path');
    const testFolder = './integration-tests/';

    return function() {
        const files = fs.readdirSync(testFolder);
        const xmlFiles = files.filter((file) => path.extname(file) === '.xml');
        // const xmlFiles = files.filter((file) => path.extname(file) === '.xml' && file == "subjects.xml" );
    
        const tests: Test[] = [];
        xmlFiles.forEach((xmlFile) => {
            const test: Test = objectToTest(parseFromXML(testFolder, xmlFile));
            tests.push(test);
        });

        return tests;
    };
})();

testRunner.run(readAllTests());
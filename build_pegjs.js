// @ts-check
"use strict"
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import child_process from "node:child_process";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);

/** 
 * Print message with the basename of the script.
 * @param {string} msg
 * @returns {void} 
 */
function log(msg) {
    console.log(`${basename}: ${msg}`);
}

/** 
 * @param {fs.PathLike | string} path
 * @returns {void}
 */
function ensureFileSync(path) {
    if (!fs.existsSync(path)) {
        throw new Error(`${basename}: File ${JSON.stringify(path)} does not exist`);
    }
    if (!fs.statSync(path).isFile()) {
        throw new Error(`${basename}: Path ${JSON.stringify(path)} is not a file`);
    }

}

/** 
 * @param {fs.PathLike | string} dirPath
 * @returns {void}
 */
function ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
    if (!fs.statSync(dirPath).isDirectory()) {
        throw new Error(`${basename}: Path ${JSON.stringify(dirPath)} is not a directory`);
    }
}

/** 
 * @param {string} inpath
 * @param {string} outpath
 * @returns {child_process.ChildProcess} 
 */
function execPeg(inpath, outpath) {
    const programName = "npx";
    const args = ["pegjs", "-o", outpath, inpath];
    log(`Executing \`${programName} ${args.map((x) => JSON.stringify(x)).join(" ")}\``);
    return child_process.execFile(programName, args);
}

/** @returns {Promise<void>} */
async function main() {
    const outDir = path.resolve(__dirname, "src", "generated");
    log(`Ensuring directory ${JSON.stringify(outDir)} exists`);
    ensureDirSync(outDir);

    const inDir = path.resolve(__dirname, "pegjs");
    const inNames = ["ast.pegjs", "prepast.pegjs"];
    const inputs = inNames.map((inName) => {
        const inPath = path.resolve(inDir, inName);
        ensureFileSync(inPath);
        return {
            basename: inName,
            inPath,
            outPath: path.resolve(outDir, inName.replace(".pegjs", ".js"))
        }
    });
    const children = inputs.map((x) => execPeg(x.inPath, x.outPath));
    let completed = 0;
    return new Promise((resolve, _reject) => {
        for (const child of children) {
            child.stdout?.on('data', (data) => {
                console.log(`[CHILD PROCESS]: ${String(data).trimEnd()}`);
            })
            child.stderr?.on('data', (data) => {
                console.error(`[CHILD PROCESS]: ${String(data).trimEnd()}`);
            })
            child.on("exit", (retCode) => {
                if (retCode !== 0) {
                    throw new Error(`${basename}: Child process \`${child.spawnargs.map((x) => JSON.stringify(x)).join(" ")}\` failed with exit code ${retCode}.`)
                }
                if (++completed === children.length) {
                    resolve()
                }
            })
        }
    });
}

if (import.meta.main) {
    // @ts-ignore
    main().then(() => {
        log("Done")
        process.exit(0);
    });
}


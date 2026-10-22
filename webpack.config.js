'use strict';
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    mode: "production",
    entry: "./src/index.ts",
    target: "web",
    output: {
        filename: "app.bundle.js",
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            { test: /\.ts$/, use: "ts-loader" },
        ],
    },
    resolve: {
        extensions: [ '.ts', '.js' ],
        extensionAlias: {
            '.ts': ['.js', '.ts'],
        }
    }
};

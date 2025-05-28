import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { getTempPath } from '../config';
import { Cell } from '../types';
import path from 'path';

let tempDir = getTempPath();

export let processCellsJavascript = (cells: Cell[]): ChildProcessWithoutNullStreams => {
    let innerScope = '';

    for (const cell of cells) {
        innerScope += `\nconsole.log("!!output-start-cell");\n`;
        let lines = cell.contents.split('\n');
        for (let line of lines) {
            line = line.trim();
            innerScope += line;
            innerScope += '\n';
        }
    }

    let mainFile = path.join(tempDir, 'main.js');
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, innerScope);

    return spawn('node', [mainFile]);
};

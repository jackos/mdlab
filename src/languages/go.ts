import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import {
    NotebookCell,
    NotebookCellExecution,
    NotebookCellOutput,
    NotebookCellOutputItem,
} from 'vscode';
import { getTempPath } from '../config';
import { Cell } from '../types';
let lastImportNumber = 0;

export let processCellsGo = (cells: Cell[]): ChildProcessWithoutNullStreams => {
    let imports = '';
    let importNumber = 0;
    let outerScope = '';
    let innerScope = '';
    let containsMain = false;
    let parsingImports = false;
    let parsingFunc = false;
    let parsingIter = 0;
    let funcRegex = /func\s+(\w+)\s*\(/;
    let funcRecRegex = /func\s+\((\w+)\)\s*\w/;

    for (const cell of cells) {
        innerScope += `\nfmt.Println("!!output-start-cell");\n`;
        let lines = cell.contents.split('\n');
        for (let line of lines) {
            line = line.trim();
            let funcResult = line.match(funcRegex);
            let funcRecResult = line.match(funcRecRegex);
            if (funcResult) {
                if (funcResult[1] === 'main') {
                    containsMain = true;
                    continue;
                } else {
                    parsingFunc = true;
                }
            }
            if (funcRecResult) {
                parsingFunc = true;
            }
            if (line.startsWith('type')) {
                parsingFunc = true;
            }

            if (line.startsWith('import (')) {
                parsingImports = true;
            } else if (parsingImports) {
                if (line === ')') {
                    parsingImports = false;
                } else {
                    importNumber++;
                    imports += 'import ' + line + '\n';
                }
            } else if (line.startsWith('import')) {
                importNumber++;
                imports += line;
                imports += '\n';
            } else if (parsingFunc) {
                outerScope += line;
                outerScope += '\n';
            } else {
                innerScope += line;
                innerScope += '\n';
            }

            if (parsingFunc) {
                if (line[0] === '}') {
                    if (parsingIter === 1) {
                        parsingIter = 0;
                        parsingFunc = false;
                    } else {
                        parsingIter--;
                    }
                }
                if (line[line.length - 1] === '{') {
                    parsingIter++;
                }
            }
        }
        // Drop the closing curly brace if there was a main function
        if (containsMain) {
            innerScope = innerScope.trim().slice(0, -1);
            containsMain = false;
        }
    }
    let main =
        'package main\n' +
        imports +
        outerScope +
        'func main() {\nlog.SetOutput(os.Stdout)\n' +
        innerScope +
        '}';
    let dir = getTempPath();
    let mainFile = path.join(dir, 'main.go');
    mkdirSync(dir, { recursive: true });
    writeFileSync(mainFile, main);
    spawnSync('gopls', ['imports', '-w', mainFile]);
    return spawn('go', ['run', mainFile], { cwd: dir });
};

export let fixImportsGo = (exec: NotebookCellExecution, cell: NotebookCell): Promise<number> => {
    return new Promise((resolve, reject) => {
        let encoder = new TextEncoder();
        let tempDir = getTempPath();
        let goMod = 'module github.com/mdl/temp\ngo 1.21\n';
        let goModFile = path.join(tempDir, 'go.mod');
        writeFileSync(goModFile, goMod);
        let tidy = spawn('go', ['mod', 'tidy'], { cwd: tempDir });
        tidy.stderr.on('data', (tidyData: Uint8Array) => {
            const x = new NotebookCellOutputItem(tidyData, 'text/plain');
            exec.appendOutput([new NotebookCellOutput([x])], cell);
        });
        tidy.stdout.on('data', (tidyData: Uint8Array) => {
            const x = new NotebookCellOutputItem(tidyData, 'text/plain');
            exec.appendOutput([new NotebookCellOutput([x])], cell);
        });
        tidy.on('close', async (_) => {
            exec.clearOutput(cell);
            let finished = encoder.encode('Go has finished tidying modules, rerun cells now...');
            const x = new NotebookCellOutputItem(finished, 'text/plain');
            exec.appendOutput([new NotebookCellOutput([x])], cell);
            exec.end(false, new Date().getTime());
            resolve(0);
        });
    });
};

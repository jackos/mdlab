import { ChildProcessWithoutNullStreams, spawn, execSync, spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { getTempPath } from '../config';
import { Cell } from '../types';
import * as vscode from 'vscode';
import { dirname } from 'path';
import { env } from 'process';
import { homedir } from 'os';

let tempDir = getTempPath();
let mainLine = 'pub fn main() !void {\n'

export const processCellsZig = (cells: Cell[]): ChildProcessWithoutNullStreams => {
    let imports = '';
    let importNumber = 0;
    let outerScope = '';
    let innerScope = '';
    let containsMain = false;
    let parsingImports = false;
    let parsingBlock = false;
    let parsingIter = 0;
    let funcRegex = /.*fn\s+(\w+)\(.*\)\s+[\w|!]+\s+{/;
    let errorRegex = /(const|var)\s+\w+\s*=\s*error\s*{/;

    for (const cell of cells) {
        innerScope += 'std.debug.print("!!output-start-cell\\n", .{});'
        let lines = cell.contents.split('\n');
        for (let line of lines) {
            let funcResult = line.match(funcRegex);
            let errorResult = line.match(errorRegex);
            if (funcResult) {
                if (funcResult[1] === 'main') {
                    containsMain = true;
                    mainLine = line + "\n";
                    continue;
                } else {
                    parsingBlock = true;
                }
            } else if (errorResult) {
                parsingBlock = true;
            }

            if (line.includes('@import')) {
                importNumber++;
                imports += line;
                imports += '\n';
            } else if (parsingBlock) {
                outerScope += line;
                outerScope += '\n';
            } else {
                innerScope += line;
                innerScope += '\n';
            }

            const trimmed = line.trim();
            if (parsingBlock) {
                if (trimmed[0] === '}') {
                    if (parsingIter === 1) {
                        parsingIter = 0;
                        parsingBlock = false;
                    } else {
                        parsingIter--;
                    }
                }
                if (trimmed[trimmed.length - 1] === '{') {
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
        imports +
        outerScope +
        mainLine +
        innerScope +
        '}';

    mkdirSync(`${tempDir}/zig`, { recursive: true });
    writeFileSync(`${tempDir}/zig/main.zig`, main);

    // Check if zig is on PATH
    let zigPath = 'zig';
    try {
        execSync('which zig', { stdio: 'pipe' });
    } catch {
        // zig not on PATH, use zvm
        const zvmZigPath = `${homedir()}/.zvm/bin/zig`;
        if (!existsSync(zvmZigPath)) {
            // Install zvm and zig master with progress terminal
            vscode.window.showInformationMessage('Installing Zig via zvm - this may take a moment...');

            const terminal = vscode.window.createTerminal({ name: 'Zig Installation' });
            terminal.show();
            terminal.sendText(`curl -fsSL https://raw.githubusercontent.com/tristanisham/zvm/master/install.sh | bash && ${homedir()}/.zvm/self/zvm i master && exit`);

            // Wait for installation to complete (poll for zig binary)
            const startTime = Date.now();
            const timeout = 5 * 60 * 1000; // 5 minute timeout
            while (!existsSync(zvmZigPath)) {
                if (Date.now() - startTime > timeout) {
                    vscode.window.showErrorMessage('Zig installation timed out');
                    throw new Error('Zig installation timed out');
                }
                spawnSync('sleep', ['1']);
            }
            vscode.window.showInformationMessage('Zig installation completed!');
        }
        zigPath = zvmZigPath;
    }

    return spawn(zigPath, ['run', `${tempDir}/zig/main.zig`]);
};
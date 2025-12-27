import { ChildProcessWithoutNullStreams, spawn, execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { getTempPath } from '../config';
import { Cell, LanguageCommand } from '../types';
import { homedir } from 'os';
import { outputChannel } from '../utils';
import * as vscode from 'vscode';


let tempDir = getTempPath();
let mainLine = 'pub fn main() !void {\n'

export const processCellsZig = (cells: Cell[]): ChildProcessWithoutNullStreams => {
    let imports = '';
    let outerScope = '';
    let innerScope = '';
    let containsMain = false;
    let parsingBlock = false;
    let parsingIter = 0;
    let funcRegex = /.*fn\s+(\w+)\(.*\)\s+[\w|!]+\s+{/;
    let globalRegex = /^(const|var)\s+\w+\s*=\s*\w*\s*{/;

    for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        innerScope += 'std.debug.print("!!output-start-cell\\n", .{});\n'
        
        // Handle metadata commands e.g. ```zig :skip
        const command = cell.cell.metadata?.command as string || '';

        // Skip this cell, unless it's the cell currently being executed,
        // for example when the user wants to display error output
        if (command.includes(LanguageCommand.once) && c !== cells.length - 1) {
            continue;
        }

        // Always skip this cell, for example showing showing code you don't
        // want the result of
        if (command.includes(LanguageCommand.skip)) {
            continue;
        }

        let lines = cell.contents.split('\n');

        for (let line of lines) {
            // Only add this cell to the program it's the active execution cell

            let funcResult = line.match(funcRegex);
            let globalResult = line.match(globalRegex);
            if (funcResult) {
                if (funcResult[1] === 'main') {
                    containsMain = true;
                    mainLine = line + "\n";
                    continue;
                } else {
                    parsingBlock = true;
                }
            } else if (globalResult) {
                parsingBlock = true;
            }
            if (line.includes('@import')) {
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
            // Install zvm and zig master with progress in terminal
            vscode.window.showInformationMessage('Installing Zig via ZVM');

            const terminal = vscode.window.createTerminal({ name: 'Zig Installation' });
            terminal.show();
            terminal.sendText(`curl -fsSL https://raw.githubusercontent.com/tristanisham/zvm/master/install.sh | bash && ${homedir()}/.zvm/self/zvm i master && exit`);
            vscode.window.showInformationMessage('Zig installation completed!\nTo use a different version of zig with mdlab run: zvm use 0.14.0');
        }
        zigPath = zvmZigPath;
    }

    return spawn(zigPath, ['run', `${tempDir}/zig/main.zig`]);
};
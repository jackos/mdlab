import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { getTempPath, modularHome } from '../config';
import { Cell, LanguageCommand } from '../types';
import path from 'path';
import { window } from 'vscode';
import { outputChannel } from '../utils';

let tempDir = getTempPath();

export let processCellsMojo = (
    cells: Cell[]
): { stream: ChildProcessWithoutNullStreams; clearOutput: boolean } => {
    const activeFilePath = path.dirname(window.activeTextEditor?.document.uri.fsPath as string);
    let outerScope = '';

    let innerScope = `def main():`;

    let cellCount = 0;
    let clearOutput = false;
    let inOuterScope = false;
    let decorator = '';

    for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];

        let deIndent = false;
        // Empty string if no command otherwise get pos 1 of the split
        innerScope += `\n    print("!!output-start-cell")\n`;
        // cell.contents = cell.contents.trim();
        const regex = /(\s*print\s*\()(.*?)(\)\s*$)/gm;

        cell.contents = cell.contents.replace(regex, (_, before, content, after) => {
            // Check if 'flush=True' is already present
            if (!content.includes('flush=True')) {
                if (content.trim()) {
                    // If there's content inside the print statement, add ', flush=True'
                    content += ', flush=True';
                } else {
                    // If the print statement is empty, just add 'flush=True'
                    content = 'flush=True';
                }
            }
            return `${before}${content}${after}`;
        });

        const command = cell.cell.metadata?.command || '';
        // Only add this cell to the program it's the active execution cell
        if (command.startsWith(LanguageCommand.once) && c !== cells.length - 1) {
            continue;
        }
        if (
            command.startsWith(LanguageCommand.skip) ||
            command.startsWith(LanguageCommand.create)
        ) {
            continue;
        }
        let lines = cell.contents.split('\n');
        const len = lines.length;
        let i = 0;
        for (let line of lines) {
            outputChannel.appendLine(line);
            i++;
            // Keep things in outerScope if they should not go in main()
            if (line.startsWith('@')) {
                decorator += line + '\n';
            }
            if (
                line.startsWith('struct') ||
                line.startsWith('trait') ||
                line.startsWith('from') ||
                line.startsWith('import')
            ) {
                inOuterScope = true;
                if (decorator) {
                    continue;
                }
            } else if (!line.startsWith('  ') && !(line === '')) {
                inOuterScope = false;
                decorator = '';
            }
            if (i === 1 && line.replace(/\s/g, '').substring(0, 6) === '#file:') {
                let file = line.split(':')[1].trim();
                if (file !== 'main.mojo') {
                    let cleaned = '';
                    for (let line2 of lines) {
                        if (line2.trim() !== 'print("!!output-start-cell")') {
                            cleaned += line2 + '\n';
                        }
                    }
                    if (path.isAbsolute(file)) {
                        writeFileSync(file, cleaned);
                    } else {
                        writeFileSync(path.join(tempDir, file), cleaned);
                    }
                }
                continue;
            }
            if (
                i === 1 &&
                cellCount === cells.length &&
                cell.cell.metadata?.command?.startsWith(LanguageCommand.clear)
            ) {
                clearOutput = true;
            }
            if (line.startsWith('fn main():') || line.startsWith('def main():')) {
                deIndent = true;
                continue;
            }

            if (
                line[0] !== ' ' &&
                i === len &&
                !line.includes('#') &&
                line.trim().split(' ').length === 1 &&
                !line.endsWith(')')
            ) {
                // if first char is `!` pretty print
                if (line[0] === '!') {
                    innerScope += `    var pprint = Python.import_module("pprint")\n`;
                    line = 'pprint(' + line.substring(1) + ')';
                } else {
                    line = 'print(' + line + ')';
                }
            }
            if (inOuterScope) {
                if (decorator) {
                    outerScope += decorator + '\n';
                    decorator = '';
                }
                outerScope += line + '\n';
            } else {
                if (!deIndent) {
                    if (decorator) {
                        innerScope += '    ' + decorator;
                        decorator = '';
                    }
                    innerScope += '    ' + line + '\n';
                } else {
                    if (decorator) {
                        innerScope += decorator;
                        decorator = '';
                    }
                    innerScope += line + '\n';
                }
            }
        }
    }

    let mainFile = path.join(tempDir, 'main.mojo');

    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, outerScope + innerScope);
    let env = process.env;
    if (typeof modularHome === 'string') {
        env = { MODULAR_HOME: modularHome, ...env };
    }

    return { stream: spawn('mojo', [mainFile], { cwd: activeFilePath, env }), clearOutput };
};

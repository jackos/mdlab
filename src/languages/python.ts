import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { getTempPath } from '../config';
import { Cell, LanguageCommand } from '../types';
import { CONSTANTS } from '../constants';
import vscode from 'vscode';
import path from 'path';
import { BaseLanguageProcessor, LanguageProcessorResult } from './languageProcessor';

export class PythonProcessor extends BaseLanguageProcessor {
    protected command: string;
    protected installUrl = CONSTANTS.INSTALL_URLS.PYTHON;

    constructor(command: string = 'python3') {
        super();
        this.command = command;
    }

    process(cells: Cell[]): LanguageProcessorResult {
        const tempDir = getTempPath();
        const activeFilePath = path.dirname(
            vscode.window.activeTextEditor?.document.uri.fsPath || ''
        );

        const { script, clearOutput } = this.buildScript(cells, tempDir, activeFilePath);

        const mainFile = path.join(tempDir, CONSTANTS.TEMP_PYTHON_FILE);
        const header = this.buildHeader(activeFilePath, tempDir);

        mkdirSync(tempDir, { recursive: true });
        writeFileSync(mainFile, header + script);

        return {
            stream: spawn(this.command, [mainFile], { cwd: activeFilePath }),
            clearOutput,
        };
    }

    private buildHeader(activeFilePath: string, tempDir: string): string {
        return `import sys\nsys.path.append("${activeFilePath}")\nsys.path.append("${tempDir}")\nfrom builtins import *\n`;
    }

    private buildScript(
        cells: Cell[],
        tempDir: string,
        activeFilePath: string
    ): { script: string; clearOutput: boolean } {
        let script = '';
        let cellCount = 0;
        let clearOutput = false;

        for (const cell of cells) {
            script += `\nprint("${CONSTANTS.OUTPUT_START_MARKER}", flush=True)\n`;

            const formattedContent = this.formatCellContent(cell);
            const processedContent = this.addFlushToPrintStatements(formattedContent);

            cellCount++;

            if (cell.cell.metadata?.command?.startsWith(LanguageCommand.skip)) {
                continue;
            }

            const lines = processedContent.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Handle file directive
                if (i === 0 && this.isFileDirective(line)) {
                    this.handleFileDirective(line, lines, tempDir);
                    continue;
                }

                // Check for clear command
                if (
                    i === 0 &&
                    cellCount === cells.length &&
                    cell.cell.metadata?.command?.startsWith(LanguageCommand.clear)
                ) {
                    clearOutput = true;
                }

                // Auto-print last line if it's a simple variable
                const processedLine = this.processLine(line, i, lines.length);
                script += processedLine + '\n';
            }
        }

        return { script, clearOutput };
    }

    private addFlushToPrintStatements(content: string): string {
        const regex = /(\s*print\s*\()(.*?)(\)\s*$)/gm;

        return content.replace(regex, (_, before, content, after) => {
            if (!content.includes('flush=True')) {
                if (content.trim()) {
                    content += ', flush=True';
                } else {
                    content = 'flush=True';
                }
            }
            return `${before}${content}${after}`;
        });
    }

    private isFileDirective(line: string): boolean {
        return line.replace(/\s/g, '').substring(0, 6) === '#file:';
    }

    private handleFileDirective(line: string, lines: string[], tempDir: string): void {
        const file = line.split(':')[1].trim();
        if (file !== 'main.py') {
            const cleaned = lines
                .filter(
                    (line2) =>
                        line2.trim() !== `print("${CONSTANTS.OUTPUT_START_MARKER}", flush=True)`
                )
                .join('\n');

            const filePath = path.isAbsolute(file) ? file : path.join(tempDir, file);
            writeFileSync(filePath, cleaned);
        }
    }

    private processLine(line: string, index: number, totalLines: number): string {
        const isLastLine = index === totalLines - 1;
        const isSimpleVariable =
            line[0] !== ' ' &&
            isLastLine &&
            !line.includes('#') &&
            line.trim().split(' ').length === 1 &&
            !line.endsWith(')');

        if (isSimpleVariable) {
            if (line[0] === '!') {
                return `from pprint import pprint\npprint(${line.substring(1)}, flush=True)`;
            } else {
                return `print(${line}, flush=True)`;
            }
        }

        return line;
    }
}

// Export the legacy function for backward compatibility
export const processCellsPython = (cells: Cell[], command: string): LanguageProcessorResult => {
    const processor = new PythonProcessor(command);
    return processor.process(cells);
};

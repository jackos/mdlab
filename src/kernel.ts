/* eslint-disable @typescript-eslint/naming-convention */
import {
    NotebookDocument,
    NotebookCell,
    NotebookController,
    NotebookCellOutput,
    NotebookCellOutputItem,
    NotebookRange,
    NotebookEdit,
    WorkspaceEdit,
    workspace,
} from 'vscode';
import { processCellsRust } from './languages/rust';
import { processCellsGo } from './languages/go';
import { processCellsJavascript } from './languages/javascript';
import { processCellsTypescript } from './languages/typescript';
import { ChildProcessWithoutNullStreams, spawnSync, spawn } from 'child_process';
import { processShell as processShell } from './languages/shell';
import { processCellsPython } from './languages/python';
import { processPowerShell } from './languages/powershell';
import * as vscode from 'vscode';
import { homedir } from 'os';
import { processCellsMojo } from './languages/mojo';
import { getTempPath } from './config';

import { Cell, ChatMessage, LanguageCommand } from './types';
import { commandNotOnPath, installMojo, outputChannel } from './utils';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { AIService } from './services/aiService';
import { processCellsZig } from './languages/zig';

export let lastRunLanguage = '';

// Kernel in this case matches Jupyter definition i.e. this is responsible for taking the frontend notebook
// and running it through different languages, then returning results in the same format.
export class Kernel {
    async executeCells(
        doc: NotebookDocument,
        cells: NotebookCell[],
        ctrl: NotebookController
    ): Promise<void> {
        outputChannel.appendLine('executing all cells...');
        for (const cell of cells) {
            await this.executeCell(doc, [cell], ctrl);
        }
        outputChannel.appendLine('finished executing all cells');
    }

    async executeCell(
        doc: NotebookDocument,
        cells: NotebookCell[],
        ctrl: NotebookController
    ): Promise<void> {
        outputChannel.appendLine('executing cell...');
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const exec = ctrl.createNotebookCellExecution(cells[0]);
        outputChannel.appendLine('created notebook cell execution');

        const currentCell = cells[cells.length - 1];
        const token = exec.token;

        // Set up cancellation handler
        token.onCancellationRequested(() => {
            exec.end(false, new Date().getTime());
        });

        // Start execution timer
        exec.start(new Date().getTime());
        const tempDir = getTempPath();
        outputChannel.appendLine('using temp directory: ' + tempDir);

        // Handle special commands
        if (await this.handleSpecialCommands(cells[0], exec, tempDir)) {
            return;
        }

        exec.clearOutput(cells[0]);

        // Get all cells up to current one
        const cellsStripped = this.getCellsUpToCurrent(doc, cells[0]);
        outputChannel.appendLine(
            `found ${cellsStripped.length} cells matching language: ${cells[0].document.languageId}`
        );

        const lang = cells[0].document.languageId;

        // Handle AI models
        if (lang === 'openai' || lang === 'groq') {
            await this.handleAIModel(lang, cellsStripped, cells[0], exec);
            return;
        }

        // Handle regular language execution
        await this.handleLanguageExecution(lang, cellsStripped, currentCell, exec, token, decoder);
    }

    private async handleSpecialCommands(
        cell: NotebookCell,
        exec: any,
        tempDir: string
    ): Promise<boolean> {
        // Check if metadata and command exist
        if (!cell.metadata || !cell.metadata.command) {
            return false;
        }

        if (cell.metadata.command.startsWith(LanguageCommand.create)) {
            const file = cell.metadata.command.split('=');
            if (file.length > 1) {
                outputChannel.appendLine(
                    'writing cell to temp file: ' + `${tempDir}/${file[1].trim()}`
                );
                writeFileSync(`${tempDir}/${file[1].trim()}`, cell.document.getText());
            }
            exec.end(true, new Date().getTime());
            return true;
        }

        if (cell.metadata.command.startsWith(LanguageCommand.skip)) {
            outputChannel.appendLine('skipping cell for execution');
            exec.end(true, new Date().getTime());
            return true;
        }

        return false;
    }

    private getCellsUpToCurrent(doc: NotebookDocument, currentCell: NotebookCell): Cell[] {
        outputChannel.appendLine('getting cells up to: ' + currentCell.index + 1);
        const range = new NotebookRange(0, currentCell.index + 1);
        const cellsUpToCurrent = doc.getCells(range);

        const cellsStripped: Cell[] = [];
        let matchingCells = 0;

        // For AI models, include all cells regardless of language
        const isAIModel =
            currentCell.document.languageId === 'openai' ||
            currentCell.document.languageId === 'groq';

        for (const cell of cellsUpToCurrent) {
            if (isAIModel || cell.document.languageId === currentCell.document.languageId) {
                matchingCells++;
                cellsStripped.push({
                    index: matchingCells,
                    contents: cell.document.getText(),
                    cell: cell,
                });
            }
        }

        return cellsStripped;
    }

    private async handleAIModel(
        lang: string,
        cellsStripped: Cell[],
        cell: NotebookCell,
        exec: any
    ): Promise<void> {
        lastRunLanguage = lang;

        // Convert all cells to a single markdown-formatted string
        let markdownContent = '';

        for (const c of cellsStripped) {
            const cellType = c.cell.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code';
            const cellLang = c.cell.document.languageId;

            if (cellType === 'markdown') {
                // Add markdown content directly
                markdownContent += c.contents + '\n\n';
            } else if (cellLang !== 'openai' && cellLang !== 'groq') {
                // Add code cells as markdown code blocks
                markdownContent += `\`\`\`${cellLang}\n${c.contents}\n\`\`\`\n\n`;
            } else {
                // Add AI prompt cells as regular text
                markdownContent += c.contents + '\n\n';
            }
        }

        // Create a single message with all the content
        const messages: ChatMessage[] = [
            {
                role: 'user' as const,
                content: markdownContent.trim(),
            },
        ];

        // Use AIService to process the request
        const generatedCells = await AIService.processAIRequest(lang, messages);

        if (generatedCells.length === 0) {
            exec.end(false, new Date().getTime());
            return;
        }

        // Insert the generated cells
        await this.insertGeneratedCells(cell, generatedCells);
        exec.end(true, new Date().getTime());
    }

    private async insertGeneratedCells(
        cell: NotebookCell,
        edits: vscode.NotebookCellData[]
    ): Promise<void> {
        const edit = new WorkspaceEdit();
        const notebook_edit = NotebookEdit.insertCells(cell.index + 1, edits);
        edit.set(cell.notebook.uri, [notebook_edit]);
        await workspace.applyEdit(edit);
    }

    private async handleLanguageExecution(
        lang: string,
        cellsStripped: Cell[],
        currentCell: NotebookCell,
        exec: any,
        token: vscode.CancellationToken,
        decoder: any
    ): Promise<void> {
        let output: ChildProcessWithoutNullStreams | null = null;
        let clearOutput = false;

        try {
            const result = await this.createLanguageProcess(lang, cellsStripped, currentCell);
            if (!result) {
                exec.end(false, new Date().getTime());
                return;
            }

            output = result.stream;
            clearOutput = result.clearOutput;

            // Set up cancellation handler for the process
            const cancellationListener = token.onCancellationRequested(() => {
                if (output) {
                    output.kill('SIGTERM');
                }
                exec.end(false, new Date().getTime());
            });

            // Set up output handlers
            await this.handleProcessOutput(
                output,
                exec,
                decoder,
                cellsStripped,
                clearOutput,
                currentCell
            );

            // Clean up cancellation listener
            cancellationListener.dispose();
        } catch (error) {
            outputChannel.appendLine(`Error during language execution: ${error}`);
            if (output) {
                output.kill('SIGTERM');
            }
            exec.end(false, new Date().getTime());
        }
    }

    private async createLanguageProcess(
        lang: string,
        cellsStripped: Cell[],
        currentCell: NotebookCell
    ): Promise<{ stream: ChildProcessWithoutNullStreams; clearOutput: boolean } | null> {
        let clearOutput = false;

        switch (lang) {
            case 'mojo':
                if (!(await this.ensureMojoAvailable())) {
                    return null;
                }
                lastRunLanguage = 'mojo';
                const mojoResult = processCellsMojo(cellsStripped);
                return { stream: mojoResult.stream, clearOutput: mojoResult.clearOutput };

            case 'rust':
                if (commandNotOnPath('cargo', 'https://rustup.rs')) {
                    return null;
                }
                lastRunLanguage = 'rust';
                return { stream: processCellsRust(cellsStripped), clearOutput };
            case 'zig':
                if (commandNotOnPath('cargo', 'https://www.zvm.app/guides/install-zvm/')) {
                    return null;
                }
                lastRunLanguage = 'zig';
                return { stream: processCellsZig(cellsStripped), clearOutput };
            case 'go':
                if (commandNotOnPath('go', 'https://go.dev/doc/install')) {
                    return null;
                }
                lastRunLanguage = 'go';
                return { stream: processCellsGo(cellsStripped), clearOutput };

            case 'python':
                const pythonCommand = this.getPythonCommand();
                if (!pythonCommand) {
                    return null;
                }
                lastRunLanguage = 'python';
                const pyResult = processCellsPython(cellsStripped, pythonCommand);
                return { stream: pyResult.stream, clearOutput: pyResult.clearOutput };

            case 'javascript':
                if (commandNotOnPath('node', 'https://nodejs.org/en/download/package-manager')) {
                    return null;
                }
                lastRunLanguage = 'javascript';
                return { stream: processCellsJavascript(cellsStripped), clearOutput };

            case 'typescript':
                if (!this.checkTypeScriptRunner()) {
                    return null;
                }
                lastRunLanguage = 'typescript';
                return { stream: processCellsTypescript(cellsStripped), clearOutput };

            case 'bash':
            case 'shellscript':
                if (
                    commandNotOnPath(
                        'bash',
                        'https://hackernoon.com/how-to-install-bash-on-windows-10-lqb73yj3'
                    )
                ) {
                    return null;
                }
                lastRunLanguage = 'shell';
                const bashResult = processShell(currentCell, 'bash');
                return { stream: bashResult.stream, clearOutput: bashResult.clearOutput };

            case 'zsh':
                if (
                    commandNotOnPath(
                        'zsh',
                        'https://github.com/ohmyzsh/ohmyzsh/wiki/Installing-ZSH'
                    )
                ) {
                    return null;
                }
                lastRunLanguage = 'shell';
                const zshResult = processShell(currentCell, 'zsh');
                return { stream: zshResult.stream, clearOutput: zshResult.clearOutput };

            case 'fish':
                if (commandNotOnPath('fish', 'https://fishshell.com/')) {
                    return null;
                }
                lastRunLanguage = 'shell';
                const fishResult = processShell(currentCell, 'fish');
                return { stream: fishResult.stream, clearOutput: fishResult.clearOutput };

            case 'nushell':
                if (commandNotOnPath('nushell', 'https://www.nushell.sh/book/installation.html')) {
                    return null;
                }
                lastRunLanguage = 'shell';
                const nuResult = processShell(currentCell, 'nushell');
                return { stream: nuResult.stream, clearOutput: nuResult.clearOutput }

            case 'powershell':
                if (commandNotOnPath('powershell', 'https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell')) {
                    return null;
                }
                lastRunLanguage = 'powershell';
                const psResult = processPowerShell(currentCell);
                return { stream: psResult.stream, clearOutput: psResult.clearOutput };


            default:
                return null;
        }
    }

    private async ensureMojoAvailable(): Promise<boolean> {
        const mojoMissing = commandNotOnPath('mojo', 'https://modular.com/mojo', true);
        if (!mojoMissing) {
            return true;
        }

        const globalMojoDir = path.join(homedir(), '.modular', 'bin');
        outputChannel.appendLine(`checking for mojo at: ${path.join(globalMojoDir, 'mojo')}`);

        if (existsSync(path.join(globalMojoDir, 'mojo'))) {
            process.env.PATH = process.env.PATH + path.delimiter + globalMojoDir;
            return true;
        }

        outputChannel.appendLine(`mojo not on path, installing...`);
        const installed = await installMojo();
        return !!installed;
    }

    private getPythonCommand(): string | null {
        if (!commandNotOnPath('python3', '')) {
            return 'python3';
        }
        if (!commandNotOnPath('python', 'https://www.python.org/downloads/')) {
            return 'python';
        }
        return null;
    }

    private checkTypeScriptRunner(): boolean {
        const esr = spawnSync('esr');
        if (esr.stdout === null) {
            const encoder = new TextEncoder();
            const response = encoder.encode(
                'To make TypeScript run fast install esr globally:\nnpm install -g esbuild-runner'
            );
            const x = new NotebookCellOutputItem(response, 'text/plain');
            // Note: We can't access exec here, so we'll return false and handle this in the caller
            return false;
        }
        return true;
    }

    private async handleProcessOutput(
        output: ChildProcessWithoutNullStreams,
        exec: any,
        decoder: any,
        cellsStripped: Cell[],
        clearOutput: boolean,
        currentCell: NotebookCell
    ): Promise<void> {
        const mimeType = 'text/plain';
        let errorText = '';
        let buf = Buffer.from([]);
        let processCompleted = false;

        // Create a promise that resolves when the process completes
        const processCompletion = new Promise<void>((resolve) => {
            output.on('close', (code) => {
                processCompleted = true;
                outputChannel.appendLine(`Process closed with code: ${code}`);

                // Determine success based on exit code and output
                const success = code === 0 || buf.length > 0;
                exec.end(success, new Date().getTime());

                // Handle image version updates if needed
                this.updateImageVersions(currentCell);

                resolve();
            });

            output.on('error', (error) => {
                outputChannel.appendLine(`Process error: ${error.message}`);
                if (!processCompleted) {
                    processCompleted = true;
                    exec.end(false, new Date().getTime());
                    resolve();
                }
            });
        });

        // Set up stderr handler
        output.stderr.on('data', (data: Uint8Array) => {
            errorText = data.toString();
            if (errorText && !processCompleted) {
                exec.appendOutput([
                    new NotebookCellOutput([NotebookCellOutputItem.text(errorText, mimeType)]),
                ]);
            }

            const arr = [buf, data];
            buf = Buffer.concat(arr);
            const outputs = decoder.decode(buf).split(/!!output-start-cell[\n,""," "]/g);
            const currentCellOutput =
                lastRunLanguage === 'shell' ? outputs[1] : outputs[currentCellLang.index];

            if (!clearOutput && currentCellOutput?.trim()) {
                exec.replaceOutput([
                    new NotebookCellOutput([NotebookCellOutputItem.text(currentCellOutput)]),
                ]);
            }
        });

        // Set up stdout handler
        const currentCellLang = cellsStripped[cellsStripped.length - 1] as Cell;

        output.stdout.on('data', (data: Uint8Array) => {
            if (processCompleted) {
                return;
            }

            const arr = [buf, data];
            buf = Buffer.concat(arr);
            const outputs = decoder.decode(buf).split(/!!output-start-cell[\n,""," "]/g);
            const currentCellOutput =
            ['shell','powershell'].includes(lastRunLanguage)
                 ? outputs[1] : outputs[currentCellLang.index];

            if (!clearOutput && currentCellOutput?.trim()) {
                exec.replaceOutput([
                    new NotebookCellOutput([NotebookCellOutputItem.text(currentCellOutput)]),
                ]);
            }
        });

        // Wait for process completion
        await processCompletion;
    }

    private updateImageVersions(currentCell: NotebookCell): void {
        const doc = currentCell.notebook;
        if (doc.getCells().length <= currentCell.index + 1) {
            return;
        }

        const nextCell = doc.getCells(
            new NotebookRange(currentCell.index + 1, currentCell.index + 2)
        )[0];
        if (nextCell.kind !== vscode.NotebookCellKind.Markup) {
            return;
        }

        const text = nextCell.document.getText();
        const updatedText = text.replace(
            /(.*[^`]*<img\s*src\s*=\s*".*?)(\?version=(\d+))?"(.*)/g,
            (match, prefix, versionQuery, versionNum, suffix) => {
                if (!match) {
                    return match;
                }

                if (versionQuery) {
                    const newVersionNum = parseInt(versionNum, 10) + 1;
                    return `${prefix}?version=${newVersionNum}"${suffix}`;
                } else {
                    return `${prefix}?version=1"${suffix}`;
                }
            }
        );

        if (updatedText !== text) {
            this.updateCellContent(nextCell, updatedText);
        }
    }

    private async updateCellContent(cell: NotebookCell, newContent: string): Promise<void> {
        const workspaceEdit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            0,
            0,
            cell.document.lineCount - 1,
            cell.document.lineAt(cell.document.lineCount - 1).text.length
        );
        workspaceEdit.replace(cell.document.uri, fullRange, newContent);
        await vscode.workspace.applyEdit(workspaceEdit);

        // Refresh the cell display
        await vscode.window.showNotebookDocument(cell.notebook, {
            viewColumn: vscode.window.activeNotebookEditor?.viewColumn,
            selections: [new NotebookRange(cell.index, cell.index + 1)],
            preserveFocus: true,
        });

        await vscode.commands.executeCommand('notebook.cell.edit');
        await vscode.commands.executeCommand('notebook.cell.quitEdit');

        await vscode.window.showNotebookDocument(cell.notebook, {
            viewColumn: vscode.window.activeNotebookEditor?.viewColumn,
            selections: [new NotebookRange(cell.index - 1, cell.index)],
            preserveFocus: false,
        });
    }
}

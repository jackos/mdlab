import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { NotebookCell } from 'vscode';
import { getTempPath } from '../config';
import { LanguageCommand } from '../types';

const tempDir = getTempPath();

export const processPowerShell = (
    cell: NotebookCell
): { stream: ChildProcessWithoutNullStreams; clearOutput: boolean } => {
    const prog = process.platform === 'win32' ? 'powershell' : 'pwsh';

    const contents = cell.document.getText(); // optionally escape quotes

    const main = `
Write-Host "!!output-start-cell"
& {${contents}}
`;

    const filename = path.join(tempDir, 'main.ps1');
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(filename, main);

    let clearOutput = false;
    if (cell.metadata?.command?.startsWith(LanguageCommand.clear)) {
        clearOutput = true;
    }

    return {
        stream: spawn(prog, ['-NoProfile', '-File', filename], { cwd: tempDir }),
        clearOutput,
    };
};

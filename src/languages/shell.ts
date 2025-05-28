import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { writeFileSync, chmodSync, mkdirSync } from 'fs';
import { getTempPath } from '../config';
import * as vscode from 'vscode';
import path from 'path';
import { NotebookCell } from 'vscode';
import { LanguageCommand } from '../types';

let tempDir = getTempPath();

export const processShell = (
    cell: NotebookCell,
    language: string
): { stream: ChildProcessWithoutNullStreams; clearOutput: boolean } => {
    let prog = '';
    switch (language) {
        case 'nushell':
            prog = 'nu';
            break;
        case 'fish':
            prog = 'fish';
            break;
        default:
            prog = 'bash';
            break;
    }

    // These shell scripts track changes that commands have made to environment variables
    // to restore them when the cell is re-run
    const env_before = `#!/bin/bash
    if [ -f "${tempDir}/env_changes.sh" ]; then
    source "${tempDir}/env_changes.sh"
    fi
    env | sort | awk -F '=' '{if ($2 ~ / /) printf "%s=\\"%s\\"\\n", $1, $2; else print $0}' > ${tempDir}/env_before.txt
    echo '!!output-start-cell'
    `;

    const env_after = `
    env | sort | awk -F '=' '{if ($2 ~ / /) printf "%s=\\"%s\\"\\n", $1, $2; else print $0}' > ${tempDir}/env_after.txt

    comm -13 ${tempDir}/env_before.txt ${tempDir}/env_after.txt >> ${tempDir}/env_changes.sh

    # Extract words from file1 and file2 and sort them
    file1_words=$(grep '.*=' ${tempDir}/env_before.txt | cut -d'=' -f1 | sort)
    file2_words=$(grep '.*=' ${tempDir}/env_after.txt | cut -d'=' -f1 | sort)

    # Use comm to find lines unique to file2
    unset_vars=$(comm -13 <(echo "$file2_words") <(echo "$file1_words") | awk '{print "unset "$0}')
    echo "$unset_vars" >> ${tempDir}/env_changes.sh

    sort ${tempDir}/env_changes.sh | uniq | grep . > ${tempDir}/filename.tmp && mv ${tempDir}/filename.tmp ${tempDir}/env_changes.sh
    `;

    let fileName = vscode.window.activeTextEditor?.document.fileName as string;
    // Get directory by slicing off last slash
    let dir = fileName.substring(0, fileName.lastIndexOf('/'));
    if (dir === '') {
        dir = fileName.substring(0, fileName.lastIndexOf('\\'));
    }
    let main = '';
    // Ignore all the clutter from the generated files when running tree
    let contents = cell.document.getText();

    // Fix up tree output to filter out generated files if user calls that command
    if (contents.trim() === 'tree') {
        writeFileSync(
            path.join(tempDir, '.gitignore'),
            `env_before.txt
env_after.txt
env_changes.sh
main
__pycache__
rust/target
venv
        `
        );
        contents = 'tree --gitignore';
    }

    // Save and load env vars on each shell incarnation
    main += env_before + contents + env_after;

    let clearOutput = false;
    if (cell.metadata?.command?.startsWith(LanguageCommand.clear)) {
        clearOutput = true;
    }
    const filename = path.join(tempDir, `main`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(filename, main);
    chmodSync(filename, 0o755);

    return { stream: spawn(prog, [filename], { cwd: tempDir }), clearOutput };
};

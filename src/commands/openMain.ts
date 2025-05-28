import * as vscode from 'vscode';
import { getTempPath } from '../config';
import { lastRunLanguage } from '../kernel';
import { outputChannel } from '../utils';
import path from 'path';

const LANGUAGE_FILE_MAP: Record<string, string> = {
    rust: 'main.rs',
    go: 'main.go',
    javascript: 'main.js',
    typescript: 'main.ts',
    python: 'mdlab.py',
    mojo: 'main.mojo',
    shell: 'main.sh',
};

export async function openMain(): Promise<void> {
    try {
        const tempPath = getTempPath();
        const fileName = getMainFileName();

        if (!fileName) {
            vscode.window.showInformationMessage(
                'No supported language file found. Run a code cell first.'
            );
            return;
        }

        const filePath = path.join(tempPath, fileName);
        outputChannel.appendLine(`Opening main file: ${filePath}`);

        // Add temp folder to workspace
        await addTempFolderToWorkspace(tempPath);

        // Open the file
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);

        outputChannel.appendLine('Main file opened successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error in openMain: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to open main file: ${errorMessage}`);
    }
}

function getMainFileName(): string | null {
    return LANGUAGE_FILE_MAP[lastRunLanguage] || null;
}

async function addTempFolderToWorkspace(tempPath: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const tempUri = vscode.Uri.file(tempPath);

    // Check if temp folder is already in workspace
    const isAlreadyInWorkspace = workspaceFolders.some(
        (folder: vscode.WorkspaceFolder) => folder.uri.fsPath === tempPath
    );

    if (!isAlreadyInWorkspace) {
        const success = vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, null, {
            uri: tempUri,
        });

        if (!success) {
            throw new Error('Failed to add temp folder to workspace');
        }

        outputChannel.appendLine(`Added ${tempPath} to workspace`);
    }
}

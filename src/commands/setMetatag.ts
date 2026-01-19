import * as vscode from 'vscode';
import { LanguageCommand } from '../types';

interface MetatagOption {
    label: string;
    value: string;
    description: string;
}

const metatagOptions: MetatagOption[] = [
    {
        label: 'None',
        value: '',
        description: 'No metatag (default behavior)',
    },
    {
        label: 'restart',
        value: LanguageCommand.restart,
        description: 'Restart execution from this cell',
    },
    {
        label: 'global',
        value: LanguageCommand.global,
        description: 'Place code in global scope',
    },
    {
        label: 'skip',
        value: LanguageCommand.skip,
        description: 'Always skip this cell during execution',
    },
    {
        label: 'once',
        value: LanguageCommand.once,
        description: 'Only execute this cell when it is the current cell',
    },
    {
        label: 'create',
        value: LanguageCommand.create,
        description: 'Create a file from this cell (use :create=filename)',
    },
];

export async function setMetatagCommand(): Promise<void> {
    const editor = vscode.window.activeNotebookEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active notebook editor');
        return;
    }

    const cell = editor.notebook.cellAt(editor.selection.start);
    if (!cell) {
        vscode.window.showErrorMessage('No cell selected');
        return;
    }

    // Only allow metatags on code cells
    if (cell.kind !== vscode.NotebookCellKind.Code) {
        vscode.window.showInformationMessage('Metatags can only be set on code cells');
        return;
    }

    const currentCommand = cell.metadata?.command || '';

    // Show quick pick with current selection
    const selected = await vscode.window.showQuickPick(metatagOptions, {
        placeHolder: 'Select a metatag for this cell',
        matchOnDescription: true,
    });

    if (selected === undefined) {
        return; // User cancelled
    }

    let commandValue = selected.value;

    // If create is selected, prompt for filename
    if (selected.value === LanguageCommand.create) {
        const filename = await vscode.window.showInputBox({
            prompt: 'Enter the filename to create',
            placeHolder: 'example.jai',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Filename cannot be empty';
                }
                return null;
            },
        });

        if (!filename) {
            return; // User cancelled
        }

        commandValue = `${LanguageCommand.create}=${filename.trim()}`;
    }

    // Update cell metadata
    const edit = new vscode.WorkspaceEdit();
    const notebookEdit = vscode.NotebookEdit.updateCellMetadata(cell.index, {
        ...cell.metadata,
        command: commandValue,
    });
    edit.set(cell.notebook.uri, [notebookEdit]);
    await vscode.workspace.applyEdit(edit);

    // Show confirmation
    if (commandValue === '') {
        vscode.window.showInformationMessage('Metatag removed');
    } else if (commandValue.startsWith(LanguageCommand.create)) {
        vscode.window.showInformationMessage(`Metatag set to: ${commandValue}`);
    } else {
        vscode.window.showInformationMessage(`Metatag set to: ${selected.label}`);
    }
}

import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell, LANG_IDS } from './markdownParser';
import { searchNotes } from './commands/search';
import { Kernel } from './kernel';
import * as vscode from 'vscode';
import { openMain } from './commands/openMain';
import { getTempPath } from './config';
import { rmSync } from 'fs';
import { outputChannel, getOutputChannel } from './utils';
import { CONSTANTS } from './constants';

const kernel = new Kernel();

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(getOutputChannel());
    outputChannel.appendLine('mdlab registering...');

    registerCommands(context);
    registerNotebookController(context);
    registerNotebookSerializer(context);

    outputChannel.appendLine('mdlab ready');
}

function registerCommands(context: vscode.ExtensionContext): void {
    outputChannel.appendLine('registering commands...');

    context.subscriptions.push(
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.SEARCH, searchNotes),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.OPEN_MAIN, openMain),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.DELETE_TEMP, () =>
            rmSync(getTempPath(), { recursive: true, force: true })
        )
    );

    outputChannel.appendLine('finished registering commands');
}

function registerNotebookController(context: vscode.ExtensionContext): void {
    const controller = vscode.notebooks.createNotebookController(
        CONSTANTS.NOTEBOOK_ID,
        CONSTANTS.NOTEBOOK_ID,
        CONSTANTS.NOTEBOOK_ID
    );

    controller.supportedLanguages = [
        'rust',
        'go',
        'javascript',
        'typescript',
        'shellscript',
        'fish',
        'bash',
        'nushell',
        'zsh',
        'json',
        'plaintext',
        'openai',
        'groq',
        'python',
        'mojo',
        "zig",
        "powershell"
    ];

    controller.executeHandler = (
        cells: vscode.NotebookCell[],
        doc: vscode.NotebookDocument,
        ctrl: vscode.NotebookController
    ) => {
        if (cells.length > 1) {
            kernel.executeCells(doc, cells, ctrl);
        } else {
            kernel.executeCell(doc, cells, ctrl);
        }
    };
}

function registerNotebookSerializer(context: vscode.ExtensionContext): void {
    const notebookSettings = {
        transientOutputs: false,
        transientCellMetadata: {
            inputCollapsed: true,
            outputCollapsed: true,
        },
    };

    outputChannel.appendLine('registering notebook serializer...');

    context.subscriptions.push(
        vscode.workspace.registerNotebookSerializer(
            CONSTANTS.NOTEBOOK_ID,
            new MarkdownProvider(),
            notebookSettings
        )
    );

    outputChannel.appendLine('finished registering notebook serializer');
}

class MarkdownProvider implements vscode.NotebookSerializer {
    deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData {
        outputChannel.appendLine('deserializing notebook...');

        const contentString = Buffer.from(content).toString('utf8');
        const cellRawData = parseMarkdown(contentString);
        const cells = cellRawData.map(rawToNotebookCellData);

        outputChannel.appendLine('finished deserializing notebook');

        return { cells };
    }

    serializeNotebook(content: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array {
        outputChannel.appendLine('serializing notebook...');

        const stringOutput = writeCellsToMarkdown(content.cells);

        outputChannel.appendLine('serialized notebook complete');
        return Buffer.from(stringOutput);
    }
}

export function rawToNotebookCellData(data: RawNotebookCell): vscode.NotebookCellData {
    const langSplit = data.language.split(':');
    const lang = langSplit.length > 0 ? langSplit[0].trim() : data.language;
    const languageId = LANG_IDS.get(lang) || lang;
    const command = langSplit.length > 1 ? langSplit[1] : '';

    return {
        kind: data.kind,
        languageId,
        metadata: {
            leadingWhitespace: data.leadingWhitespace,
            trailingWhitespace: data.trailingWhitespace,
            indentation: data.indentation,
            command: command,
        },
        outputs: data.outputs || [],
        value: data.content,
    };
}

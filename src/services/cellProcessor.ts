import * as vscode from 'vscode';
import { Cell } from '../types';

export class CellProcessor {
    static extractCellsForLanguage(
        doc: vscode.NotebookDocument,
        currentCell: vscode.NotebookCell,
        language: string
    ): Cell[] {
        const range = new vscode.NotebookRange(0, currentCell.index + 1);
        const cellsUpToCurrent = doc.getCells(range);

        const cells: Cell[] = [];
        let matchingCells = 0;

        for (const cell of cellsUpToCurrent) {
            if (cell.document.languageId === language) {
                matchingCells++;
                cells.push({
                    index: matchingCells,
                    contents: cell.document.getText(),
                    cell: cell,
                });
            }
        }

        return cells;
    }

    static async updateImageVersions(
        doc: vscode.NotebookDocument,
        cellIndex: number
    ): Promise<void> {
        if (doc.getCells().length <= cellIndex + 1) {
            return;
        }

        const nextCell = doc.getCells(new vscode.NotebookRange(cellIndex + 1, cellIndex + 2))[0];
        if (nextCell.kind !== vscode.NotebookCellKind.Markup) {
            return;
        }

        const text = nextCell.document.getText();
        const updatedText = this.incrementImageVersions(text);

        if (updatedText !== text) {
            await this.replaceDocumentContent(nextCell.document, updatedText);
            await this.refreshCellDisplay(nextCell);
        }
    }

    private static incrementImageVersions(text: string): string {
        return text.replace(
            /(.*[^`]*<img\s*src\s*=\s*".*?)(\?version=(\d+))?"(.*)/g,
            (match, prefix, versionQuery, versionNum, suffix) => {
                if (!match) {
                    return text;
                }

                if (versionQuery) {
                    const newVersionNum = parseInt(versionNum, 10) + 1;
                    return `${prefix}?version=${newVersionNum}"${suffix}`;
                } else {
                    return `${prefix}?version=1"${suffix}`;
                }
            }
        );
    }

    private static async replaceDocumentContent(
        document: vscode.TextDocument,
        newContent: string
    ): Promise<void> {
        const workspaceEdit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            0,
            0,
            document.lineCount - 1,
            document.lineAt(document.lineCount - 1).text.length
        );
        workspaceEdit.replace(document.uri, fullRange, newContent);
        await vscode.workspace.applyEdit(workspaceEdit);
    }

    private static async refreshCellDisplay(cell: vscode.NotebookCell): Promise<void> {
        const notebook = vscode.window.activeNotebookEditor?.notebook;
        if (!notebook) {
            return;
        }

        // Show the cell to refresh it
        await vscode.window.showNotebookDocument(notebook, {
            viewColumn: vscode.window.activeNotebookEditor?.viewColumn,
            selections: [new vscode.NotebookRange(cell.index, cell.index + 1)],
            preserveFocus: true,
        });

        // Toggle edit mode to force refresh
        await vscode.commands.executeCommand('notebook.cell.edit');
        await vscode.commands.executeCommand('notebook.cell.quitEdit');

        // Return focus to the previous cell
        await vscode.window.showNotebookDocument(notebook, {
            viewColumn: vscode.window.activeNotebookEditor?.viewColumn,
            selections: [new vscode.NotebookRange(cell.index - 1, cell.index)],
            preserveFocus: false,
        });
    }
}

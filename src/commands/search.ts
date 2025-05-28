import * as vscode from 'vscode';
import { getBasePath } from '../config';
import { outputChannel } from '../utils';

export async function searchNotes(): Promise<void> {
    try {
        const basePath = getBasePath();
        outputChannel.appendLine(`Searching notes in: ${basePath}`);

        // Add base path to workspace if not already present
        await addToWorkspace(basePath);

        // Open search in files
        await vscode.commands.executeCommand('workbench.action.findInFiles');

        outputChannel.appendLine('Search command executed successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error in searchNotes: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to search notes: ${errorMessage}`);
    }
}

async function addToWorkspace(folderPath: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    // Check if folder is already in workspace
    const isAlreadyInWorkspace = workspaceFolders.some(
        (folder: vscode.WorkspaceFolder) => folder.uri.fsPath === folderPath
    );

    if (!isAlreadyInWorkspace) {
        const folderUri = vscode.Uri.file(folderPath);
        const newIndex = workspaceFolders.length;

        const success = vscode.workspace.updateWorkspaceFolders(newIndex, null, { uri: folderUri });

        if (!success) {
            throw new Error('Failed to add folder to workspace');
        }

        outputChannel.appendLine(`Added ${folderPath} to workspace`);
    } else {
        outputChannel.appendLine(`${folderPath} is already in workspace`);
    }
}

let welcomeMessage = `
# mdlab
## Introduction
Welcome to mdlab, run your Markdown code blocks interactively and save to a standard Markdown format that renders on Github!

## Searching notes
Pressing \`alt+f\` will add the default base path \`~/mdlab\` to your workspace so you can search through your markdown notes, and open this index.md file. Any edits you do this file, or extra \`.md\` files you add to \`~/mdlab\` will be searchable from any project via \`alt+f\`.

## Supported Lanugages
Try running the below cells, only Typescript and Javascript currently support language servers
\`\`\`rust
let x = "Rust is working!";
println!("{x}");
\`\`\`

\`\`\`go
x := "Go is working!"
fmt.Println(x)
\`\`\`

\`\`\`js
let x = "Javascript is working!";
console.log(x);
\`\`\`

\`\`\`ts
let y: string = "Typescript is working!";
console.log(y)
\`\`\`

## Previous Cells
This notebook implementation holds no state in a runtime, it simply runs all previous cells that match the language on every cell execution, try editing the previous Go cell without running it, then run this cell:
\`\`\`go
fmt.Println("Using previous cell:", x)
\`\`\`

## Generated Code
This is a simplification of conventional Notebooks that having long running kernels, \`mdlab\` simply generates code in your \`temp\` directory and runs it using the language's toolchain. Try pressing \`alt+o\` to see what the generated code looks like.

The \`!!output-start-cell\` lines are what's used to split the outputs for each cell, so on every run if a previous cell has changed, it's updated as well.

This generated code will also allow you to check the generated code with your language server, native language servers for Notebook cells are still a work in progress.

## Imports
Importing external crates and packages are supported, Go will create a \`go.mod\` and run a \`go mod tidy\` if anything is missing, Rust will add it to \`Cargo.toml\`. Give it a try:
\`\`\`rust
use rand::prelude::*;

let i: i32 = rand::random();
println!("The random i32 is {}", i);
\`\`\`
\`\`\`go
import "github.com/google/uuid"

u := uuid.New()
fmt.Println(u)
\`\`\`
`;

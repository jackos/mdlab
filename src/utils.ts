import { ChildProcessWithoutNullStreams, execSync, spawn } from 'child_process';
import vscode from 'vscode';
import { ChatResponse } from './types';
import { homedir } from 'os';
import * as path from 'path';
import { CONSTANTS } from './constants';
import { existsSync } from 'fs';
import { resolve } from "path";
import { env } from 'process';

export const outputChannel = vscode.window.createOutputChannel('mdlab', { log: true });

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
}

export const commandNotOnPath = (
    command: string,
    link: string,
    tryInstall: boolean = false
): boolean => {
    try {
        // Use the "where" command on Windows or the "which" command on macOS/Linux
        const cmd = process.platform === 'win32' ? 'where' : 'which';
        outputChannel.appendLine(`checking if ${command} is on path...`);
        execSync(`${cmd} ${command}`, { stdio: 'ignore' });
        outputChannel.appendLine(`${command} was on path...`);
        return false;
    } catch (error) {
        outputChannel.appendLine(`${command} not on path with error: ${error}`);

        if (tryInstall) {
            vscode.window.showInformationMessage(
                `${command} not on path, attempting to install...`
            );
        } else if (link) {
            outputChannel.appendLine(`returning link to install ${command} for the user`);
            vscode.window
                .showErrorMessage(
                    CONSTANTS.ERRORS.COMMAND_NOT_FOUND_WITH_LINK(command),
                    CONSTANTS.ERRORS.INSTALL_COMMAND(command)
                )
                .then(() => {
                    vscode.env.openExternal(vscode.Uri.parse(link));
                });
        } else {
            vscode.window.showErrorMessage(CONSTANTS.ERRORS.COMMAND_NOT_FOUND(command));
        }
        return true;
    }
};

export const logAndShowError = (message: string): void => {
    outputChannel.appendLine(`Error: ${message}`);
    vscode.window.showErrorMessage(message);
}

export const checkPath = (executableOrPath: string, config: string): string | null => {
    const trimmed = executableOrPath.trim();
    const isPath = trimmed.includes("/") || trimmed.includes("\\") || trimmed.startsWith("~");

    if (isPath) {
        const expanded = trimmed.startsWith("~")
            ? resolve(homedir(), trimmed.slice(1).replace(/^[/\\]/, ""))
            : trimmed;
        const resolved = resolve(expanded);

        if (!existsSync(resolved)) {
            logAndShowError(`Update ${config} in settings.json, executable not found at path: ${resolved}`);
            return null;
        }

        return resolved;
    } else {
        try {
            const command = process.platform === "win32" ? `where ${trimmed}` : `which ${trimmed}`;
            const result = execSync(command, { encoding: "utf-8" }).trim();
            return result.split(/\r?\n/)[0];
        } catch {
            logAndShowError(`Update ${config} in settings.json, executable "${trimmed}" not found on PATH: ${env["PATH"]}`);
            return null;
        }
    }
}




export const post = async (
    url: string,
    headers: Record<string, string>,
    body: string
): Promise<ChatResponse | null> => {
    try {
        const response = await fetch(url, { headers, body, method: 'POST' });

        // Check if status code starts with 2
        if (response.status >= 300) {
            vscode.window.showErrorMessage(
                `Error getting response: ${response.status}\n${await response.text()}`
            );
            return null;
        }

        const json = await response.json();
        vscode.window.showInformationMessage(`Response from LLM: ${JSON.stringify(json, null, 2)}`);
        return json as ChatResponse;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Error with fetch request: ${errorMessage}`);
        return null;
    }
};

/**
 * Runs a shell command using spawn and returns a promise that resolves with the command output.
 */
function runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child: ChildProcessWithoutNullStreams = spawn(command, { shell: true });
        let output = '';

        child.stdout.on('data', (data: Uint8Array) => {
            output += data.toString();
        });

        child.stderr.on('data', (data: Uint8Array) => {
            output += data.toString();
        });

        child.on('error', (err: Error) => {
            reject(err);
        });

        child.on('close', (code: number) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`Command "${command}" exited with code ${code}`));
            }
        });
    });
}

export async function installMojo(): Promise<boolean> {
    try {
        vscode.window.showInformationMessage(CONSTANTS.MESSAGES.INSTALLING_MAGIC);
        await runCommand('curl -ssL https://magic.modular.com | bash');

        vscode.window.showInformationMessage(CONSTANTS.MESSAGES.INSTALLING_MOJO);
        await runCommand('magic global install max');

        vscode.window.showInformationMessage(CONSTANTS.MESSAGES.EXPOSING_MOJO);
        await runCommand('magic global expose add -e max mojo');

        const mojoPath = path.join(homedir(), CONSTANTS.PATHS.MODULAR_BIN);
        process.env.PATH = process.env.PATH + path.delimiter + mojoPath;

        vscode.window.showInformationMessage(CONSTANTS.MESSAGES.MOJO_INSTALLED);
        return true;
    } catch (err: any) {
        vscode.window.showErrorMessage(`Error during Mojo installation: ${err.message}`);
        return false;
    }
}

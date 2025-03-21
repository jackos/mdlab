import { ChildProcessWithoutNullStreams, execSync, spawn } from "child_process";
import vscode from "vscode"
import { ChatResponse } from "./types";
import { homedir } from "os";
import * as path from 'path';

export let outputChannel = vscode.window.createOutputChannel('mdlab', { log: true });
export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
}
export const commandNotOnPath = (command: string, link: string, tryInstall: boolean = false): boolean => {
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
        vscode.window.showInformationMessage(`${command} not on path, attempting to install...`);
    }
    else if(link) {
        outputChannel.appendLine(`returning link to install ${command} for the user`);
        vscode.window.showErrorMessage(`command: ${command} not on path. Add to path or follow link to install`, ...[`Install ${command}`]).then((_)=>{
            vscode.env.openExternal(vscode.Uri.parse(link));
        });
    } else {
        vscode.window.showErrorMessage(`command: ${command} not on path. Install and add it to path`);
    }
    return true;
  }
}


export const post = async (url: string, headers: Record<string, string>, body: string): Promise<ChatResponse> => {
    try {
        let response = await fetch(url, { headers, body, method: 'POST' });

        // Check if status code starts with 2
        if (response.status >= 300) {
            vscode.window.showErrorMessage(`Error getting response: ${response.status}\n${await response.text()}`);
            return {} as ChatResponse;
        }

        let json = await response.json()
        vscode.window.showInformationMessage(`Response from LLM: ${JSON.stringify(json, null, 2)}`);
        return json as ChatResponse;
        // Proceed with the `result` if needed
    } catch (error: unknown) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage("Error with fetch request:" + error.message);
        } else {
            vscode.window.showErrorMessage("Error with fetch request:" + String(error));
        }
        return {} as ChatResponse;
    }
}


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
    vscode.window.showInformationMessage("Installing Magic, the Mojo package manager...");
    await runCommand("curl -ssL https://magic.modular.com | bash");

    vscode.window.showInformationMessage("Installing Mojo...");
    await runCommand("magic global install max");

    vscode.window.showInformationMessage("Exposing Mojo...");
    await runCommand(`magic global expose add -e max mojo`);

    const mojoPath = path.join(homedir(), ".modular", "bin");
    process.env.PATH = process.env.PATH + path.delimiter + mojoPath;

    vscode.window.showInformationMessage("Mojo installed successfully!");
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error during Mojo installation: ${err.message}`);
    return false;
  }
}
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { getJaiPath, getTempPath } from '../config';
import { Cell, LanguageCommand } from '../types';
import { checkPath, outputChannel } from '../utils';
import * as vscode from 'vscode';

const metaprogram = String.raw`//
#module_parameters (OUTPUT_EXECUTABLE_EXTENSION := DEFAULT_EXTENSION, LAUNCHER_COMMAND: [] string = DEFAULT_LAUNCHER_COMMAND) () {
    #if OS == .WINDOWS {
        DEFAULT_EXTENSION        :: ".exe";
        DEFAULT_LAUNCHER_COMMAND :: string.[];
    } else {
        DEFAULT_EXTENSION        :: "";
        DEFAULT_LAUNCHER_COMMAND :: string.[];
    }
}

run_build_result :: (w: Workspace, args: []string = .{}) {
    using options := Compiler.get_build_options(w);
    slash_or_not := "";
    if output_path {
        c := output_path[output_path.count-1];
        if c != #char "/" && c != #char "\\" {
            slash_or_not = "/"; // Needs a trailing slash.
        }
    }

    executable_name := tprint("%1%2%3%4", output_path, slash_or_not, output_executable_name, OUTPUT_EXECUTABLE_EXTENSION);

    command: [..] string;
    array_add(*command, ..LAUNCHER_COMMAND);
    array_add(*command, executable_name);
    array_add(*command, ..args);
    result := Process.run_command(..command);

    if result.exit_code != 0 {
        if result.type == {
            case .FAILED_TO_LAUNCH; Compiler.compiler_report("[mdlab] Program failed to launch.");
            case .EXITED;           Compiler.compiler_report(tprint("[mdlab] Program exited with code %.", result.exit_code));
            case .SIGNALED;         Compiler.compiler_report(tprint("[mdlab] Program quit due to signal %.", result.signal));
            case;                   Compiler.compiler_report(tprint("[mdlab] Unexpected result from running the program: %", result));
        }
    }
}

get_plugin :: () -> *Plugin {
    p := New(My);

    p.init     = init;
    p.message  = message;
    p.shutdown = shutdown;

    return p;
}

init :: (_p: *Plugin, options: [] string) -> bool {
    p := cast(*My) _p;
    p.args = options;
    return true;
}

message :: (_p: *Plugin, message: *Compiler.Message) {
    p := cast(*My) _p;

    if message.kind == .COMPLETE {
        complete := cast(*Compiler.Message_Complete) message;
        if complete.error_code != .NONE {
            p.should_run = false;
        }
    }
}

shutdown :: (_p: *Plugin) {
    p := cast(*My) _p;

    if p.should_run {
        run_build_result(p.workspace, p.args);
    } else {
        log("[mdlab] There were errors, so we are not running.\n");
    }

    free(p);
}

#scope_module

My :: struct {
    #as using base: Plugin;

    should_run := true;
    args:      [] string;
}


#import "Basic";
Compiler :: #import "Compiler";
Process  :: #import "Process";
String   :: #import "String";

Plugin   :: Compiler.Metaprogram_Plugin;
`

const newCell = '\n\nprint("!!output-start-cell\\n");\n\n\n'

export const processCellsJai = (command: string, cells: Cell[]): ChildProcessWithoutNullStreams => {
    let start = 'main :: () {\n'
    let inner = '';
    let global = '#import "Basic";\n\n';
    let end = '}\n';

    let mainRegex = /main\s*:\s*:\s*\(.*\)\s*{/;

    let lastRestartId = 0;

    for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const command = cell.cell.metadata?.command as string || '';
        if (command.includes(LanguageCommand.restart)) {
            lastRestartId = c;
        }
    }

    for (let i = 0; i < lastRestartId; i++) {
        inner += newCell;
    }

    for (let c = lastRestartId; c < cells.length; c++) {
        const cell = cells[c];
        inner += newCell;
        
        // Handle metadata commands e.g. ```jai :skip
        const command = cell.cell.metadata?.command as string || '';

        // Skip this cell, unless it's the cell currently being executed,
        // for example when the user wants to display error output
        if (command.includes(LanguageCommand.once) && c !== cells.length - 1) {
            continue;
        }

        // Always skip this cell, for example showing showing code you don't
        // want the result of
        if (command.includes(LanguageCommand.skip)) {
            continue;
        }

        
        // instead of match, find index of main function
        let mainMatch = cell.contents.match(mainRegex);
        
        if (mainMatch) {
            // Do nothing if main cell but not current cell running
            if ( c == cells.length -1) {
                const beforeMain = cell.contents.substring(0, mainMatch.index);
                start = 'mdlab_inner :: () {\n';
                // Replace the main function opening and keep everything after
                const afterMainOpening = cell.contents.substring(mainMatch.index! + mainMatch[0].length);
                end = '}\n\n' + beforeMain + 'main :: () {\n    mdlab_inner();\n' + afterMainOpening;
            }
        } else {
            // Put the contents in the global scope, not inside main function
            if (command.includes(LanguageCommand.global)) {
                global += cell.contents + '\n';
            } else {
                inner += cell.contents + '\n';
            }
        }

    }
    let main = global + start + inner + end;

    const tempDir = getTempPath();

    mkdirSync(`${tempDir}/jai/modules`, { recursive: true });

    // Only write metaprogram if it doesn't already exist
    if (!existsSync(`${tempDir}/jai/modules/mdlab.jai`)) {
        writeFileSync(`${tempDir}/jai/modules/mdlab.jai`, metaprogram);
    }

    writeFileSync(`${tempDir}/jai/main.jai`, main);
    
    return spawn(command, [`${tempDir}/jai/main.jai`, "-quiet", "+mdlab"], {cwd: `${tempDir}/jai`});
};
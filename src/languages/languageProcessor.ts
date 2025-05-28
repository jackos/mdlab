import { ChildProcessWithoutNullStreams } from 'child_process';
import { Cell } from '../types';

export interface LanguageProcessorResult {
    stream: ChildProcessWithoutNullStreams;
    clearOutput: boolean;
}

export interface LanguageProcessor {
    process(cells: Cell[], additionalCells?: Cell[]): LanguageProcessorResult;
    getCommand(): string;
    getInstallUrl(): string;
}

export abstract class BaseLanguageProcessor implements LanguageProcessor {
    protected abstract command: string;
    protected abstract installUrl: string;

    abstract process(cells: Cell[], additionalCells?: Cell[]): LanguageProcessorResult;

    getCommand(): string {
        return this.command;
    }

    getInstallUrl(): string {
        return this.installUrl;
    }

    protected formatCellContent(cell: Cell): string {
        return cell.contents.trim();
    }
}

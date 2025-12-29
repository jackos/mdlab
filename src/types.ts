import { NotebookCell } from 'vscode';

export interface Cell {
    index: number;
    contents: string;
    cell: NotebookCell;
}

export interface ChatResponse {
    id: string;
    object: string;
    created: number;
    choices: [
        {
            index: 0;
            message: {
                role: string;
                content: string;
            };
            finish_reason: string;
        },
    ];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ChatRequest {
    model: string;
    messages: ChatMessage[];
}

export interface ChatMessage {
    role: string;
    content: string;
}

export enum LanguageCommand {
    clear = 'clear',
    skip = 'skip',
    create = 'create',
    once = 'once',
    restart = 'restart',
    global = 'global',
}

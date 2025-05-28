import * as vscode from 'vscode';
import { ChatMessage, ChatRequest } from '../types';
import { post } from '../utils';
import { CONSTANTS } from '../constants';
import {
    getOpenAIKey,
    getOpenAIModel,
    getOpenAIOrgID,
    getGroqAIKey,
    getGroqModel,
} from '../config';

export interface AIModelConfig {
    url: string;
    headers: Record<string, string>;
    model: string;
}

export class AIService {
    static async processAIRequest(
        language: string,
        messages: ChatMessage[]
    ): Promise<vscode.NotebookCellData[]> {
        const config = this.getAIConfig(language, messages);
        if (!config) {
            return [];
        }

        const response = await this.sendRequest(config, messages);
        if (!response) {
            return [];
        }

        return this.parseResponseToNotebookCells(response.choices[0].message.content);
    }

    private static getAIConfig(language: string, messages: ChatMessage[]): AIModelConfig | null {
        switch (language) {
            case 'groq':
                return {
                    url: CONSTANTS.AI_MODELS.GROQ_URL,
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${getGroqAIKey()}`,
                    },
                    model: getGroqModel() || CONSTANTS.AI_MODELS.DEFAULT_GROQ_MODEL,
                };

            case 'openai':
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getOpenAIKey()}`,
                };
                const orgId = getOpenAIOrgID();
                if (orgId) {
                    headers['OpenAI-Organization'] = orgId;
                }
                return {
                    url: CONSTANTS.AI_MODELS.OPENAI_URL,
                    headers,
                    model: getOpenAIModel() || CONSTANTS.AI_MODELS.DEFAULT_OPENAI_MODEL,
                };

            default:
                return null;
        }
    }

    private static async sendRequest(config: AIModelConfig, messages: ChatMessage[]) {
        const systemMessage = {
            role: 'system',
            content:
                'You are a helpful bot named mdlab, that generates concise code blocks to solve programming problems',
        };
        const allMessages = [systemMessage, ...messages];

        const data: ChatRequest = {
            model: config.model,
            messages: allMessages,
        };

        const body = JSON.stringify(data);
        vscode.window.showInformationMessage(body);

        return await post(config.url, config.headers, body);
    }

    private static parseResponseToNotebookCells(content: string): vscode.NotebookCellData[] {
        const codeBlocks = content.split('```');
        const cells: vscode.NotebookCellData[] = [];

        for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];

            if (i === 0 || !block) {
                // First block or empty block - treat as markdown
                const trimmed = block.trim();
                if (trimmed) {
                    cells.push(
                        new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Markup,
                            trimmed,
                            'markdown'
                        )
                    );
                }
            } else if (block[0] !== '\n') {
                // Code block with language
                const lines = block.split('\n');
                const language = lines[0];
                const code = lines.slice(1).join('\n').trim();

                if (code) {
                    cells.push(
                        new vscode.NotebookCellData(vscode.NotebookCellKind.Code, code, language)
                    );
                }
            } else {
                // Code block without language or additional markdown
                const trimmed = block.trim();
                if (trimmed) {
                    cells.push(
                        new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Markup,
                            trimmed,
                            'markdown'
                        )
                    );
                }
            }
        }

        return cells;
    }
}

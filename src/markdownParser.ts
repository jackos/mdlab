import { TextDecoder, TextEncoder } from 'util';
import { NotebookCellKind, NotebookCellData } from 'vscode';

export interface RawNotebookCell {
    indentation?: string;
    leadingWhitespace: string;
    trailingWhitespace: string;
    language: string;
    content: string;
    kind: NotebookCellKind;
    outputs?: [any];
}

export const LANG_IDS = new Map([
    ['js', 'javascript'],
    ['ts', 'typescript'],
    ['rust', 'rust'],
    ['go', 'go'],
    ['nu', 'nushell'],
    ['sh', 'bash'],
    ['fish', 'fish'],
    ['zsh', 'zsh'],
    ['openai', 'openai'],
    ['groq', 'groq'],
]);

const LANG_ABBREVS = new Map(Array.from(LANG_IDS.keys()).map((k) => [LANG_IDS.get(k), k]));

class MarkdownParser {
    private lines: string[];
    private cells: RawNotebookCell[] = [];
    private currentIndex = 0;

    constructor(content: string) {
        this.lines = content.split(/\r?\n/g);
    }

    parse(): RawNotebookCell[] {
        if (this.lines.length < 2) {
            return this.cells;
        }

        while (this.currentIndex < this.lines.length) {
            const leadingWhitespace =
                this.currentIndex === 0 ? this.parseWhitespaceLines(true) : '';

            const lang = this.parseCodeBlockStart(this.lines[this.currentIndex]);

            if (lang) {
                this.parseCodeBlock(leadingWhitespace, lang);
            } else {
                this.parseMarkdownParagraph(leadingWhitespace);
            }
        }

        return this.cells;
    }

    private parseWhitespaceLines(isFirst: boolean): string {
        const start = this.currentIndex;
        const nextNonWhitespaceLineOffset = this.lines.slice(start).findIndex((l) => l !== '');

        let end: number;
        let isLast = false;

        if (nextNonWhitespaceLineOffset < 0) {
            end = this.lines.length;
            isLast = true;
        } else {
            end = start + nextNonWhitespaceLineOffset;
        }

        this.currentIndex = end;
        const numWhitespaceLines = end - start + (isFirst || isLast ? 0 : 1);
        return '\n'.repeat(numWhitespaceLines);
    }

    private parseCodeBlock(leadingWhitespace: string, lang: string): void {
        const startSourceIdx = ++this.currentIndex;

        while (this.currentIndex < this.lines.length) {
            if (this.isCodeBlockEndLine(this.lines[this.currentIndex])) {
                this.currentIndex++; // consume block end marker
                break;
            }
            this.currentIndex++;
        }

        const content = this.lines.slice(startSourceIdx, this.currentIndex - 1).join('\n');

        const trailingWhitespace = this.parseWhitespaceLines(false);

        if (lang === 'text') {
            // Add output to previous cell
            const textEncoder = new TextEncoder();
            if (this.cells.length > 0) {
                this.cells[this.cells.length - 1].outputs = [
                    {
                        items: [
                            {
                                data: textEncoder.encode(content),
                                mime: 'text/plain',
                            },
                        ],
                    },
                ];
            }
        } else {
            this.cells.push({
                language: lang,
                content,
                kind: NotebookCellKind.Code,
                leadingWhitespace,
                trailingWhitespace,
            });
        }
    }

    private parseMarkdownParagraph(leadingWhitespace: string): void {
        const startSourceIdx = this.currentIndex;

        while (this.currentIndex < this.lines.length) {
            if (this.isCodeBlockStart(this.lines[this.currentIndex])) {
                break;
            }
            this.currentIndex++;
        }

        const content = this.lines.slice(startSourceIdx, this.currentIndex).join('\n').trim();

        if (content) {
            this.cells.push({
                language: 'markdown',
                content,
                kind: NotebookCellKind.Markup,
                leadingWhitespace,
                trailingWhitespace: '',
            });
        }
    }

    private parseCodeBlockStart(line: string): string | null {
        const match = line.match(/(    |\t)?```(.*)/);
        return match ? match[2] : null;
    }

    private isCodeBlockStart(line: string): boolean {
        return !!this.parseCodeBlockStart(line);
    }

    private isCodeBlockEndLine(line: string): boolean {
        return !!line.match(/^\s*```/);
    }
}

export function parseMarkdown(content: string): RawNotebookCell[] {
    const parser = new MarkdownParser(content);
    return parser.parse();
}

const stringDecoder = new TextDecoder();

export function writeCellsToMarkdown(cells: ReadonlyArray<NotebookCellData>): string {
    let result = '';

    for (const cell of cells) {
        result += '\n\n';

        if (cell.kind === NotebookCellKind.Code) {
            result += formatCodeCell(cell);
        } else {
            result += cell.value.trim();
        }
    }

    // Remove leading newlines
    return result.substring(2);
}

function formatCodeCell(cell: NotebookCellData): string {
    let result = '';

    // Format code block
    const languageAbbrev = LANG_ABBREVS.get(cell.languageId) ?? cell.languageId;
    let codePrefix = '```' + languageAbbrev;

    if (cell.metadata?.command) {
        codePrefix += ` :${cell.metadata.command}`;
    }
    codePrefix += '\n';

    const contents = cell.value.split(/\r?\n/g).join('\n');
    const codeSuffix = '\n```';

    result += codePrefix + contents + codeSuffix;

    // Format output if present
    const outputText = extractOutputText(cell.outputs);
    if (outputText) {
        result += '\n\n```text\n' + outputText;
        if (!outputText.endsWith('\n')) {
            result += '\n';
        }
        result += '```';
    }

    return result;
}

function extractOutputText(outputs: any[] | undefined): string {
    if (!outputs) {
        return '';
    }

    let outputText = '';
    for (const output of outputs) {
        if (output.items?.[0]?.mime?.includes('text') && output.items[0].data.length) {
            outputText += stringDecoder.decode(output.items[0].data);
        }
    }

    return outputText;
}

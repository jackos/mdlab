import { LanguageProcessor } from './languageProcessor';
import { PythonProcessor } from './python';
import { CONSTANTS } from '../constants';
import { commandNotOnPath } from '../utils';

export class LanguageProcessorFactory {
    private static processors: Map<string, () => LanguageProcessor | null> = new Map([
        [
            'python',
            () => {
                const command = commandNotOnPath('python3', '') ? 'python' : 'python3';
                if (commandNotOnPath(command, CONSTANTS.INSTALL_URLS.PYTHON)) {
                    return null;
                }
                return new PythonProcessor(command);
            },
        ],
    ]);

    static getProcessor(language: string): LanguageProcessor | null {
        const processorFactory = this.processors.get(language);
        if (!processorFactory) {
            return null;
        }
        return processorFactory();
    }

    static registerProcessor(language: string, factory: () => LanguageProcessor | null): void {
        this.processors.set(language, factory);
    }
}

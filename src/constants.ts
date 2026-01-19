export const CONSTANTS = {
    // Output markers
    OUTPUT_START_MARKER: '!!output-start-cell',

    // File names
    TEMP_PYTHON_FILE: 'mdlab.py',

    // Commands
    COMMANDS: {
        SEARCH: 'mdlab.search',
        OPEN_MAIN: 'mdlab.openMain',
        DELETE_TEMP: 'mdlab.deleteTemp',
        SET_METATAG: 'mdlab.setMetatag',
    },

    // Language IDs
    NOTEBOOK_ID: 'mdlab',

    // AI Models
    AI_MODELS: {
        OPENAI_URL: 'https://api.openai.com/v1/chat/completions',
        GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
        DEFAULT_OPENAI_MODEL: 'llama3-8b-8192',
        DEFAULT_GROQ_MODEL: 'llama3-8b-8192',
    },

    // Error messages
    ERRORS: {
        COMMAND_NOT_FOUND: (cmd: string) =>
            `command: ${cmd} not on path. Install and add it to path`,
        COMMAND_NOT_FOUND_WITH_LINK: (cmd: string) =>
            `command: ${cmd} not on path. Add to path or follow link to install`,
        INSTALL_COMMAND: (cmd: string) => `Install ${cmd}`,
    },

    // Success messages
    MESSAGES: {
        MOJO_INSTALLED: 'Mojo installed successfully!',
        INSTALLING_MAGIC: 'Installing Magic, the Mojo package manager...',
        INSTALLING_MOJO: 'Installing Mojo...',
        EXPOSING_MOJO: 'Exposing Mojo...',
    },

    // Paths
    PATHS: {
        MODULAR_BIN: '.modular/bin',
        MOJO_BINARY: 'mojo',
    },

    // Installation URLs
    INSTALL_URLS: {
        RUST: 'https://rustup.rs',
        GO: 'https://go.dev/doc/install',
        PYTHON: 'https://www.python.org/downloads/',
        NODE: 'https://nodejs.org/en/download/package-manager',
        BASH: 'https://hackernoon.com/how-to-install-bash-on-windows-10-lqb73yj3',
        ZSH: 'https://github.com/ohmyzsh/ohmyzsh/wiki/Installing-ZSH',
        FISH: 'https://fishshell.com/',
        NUSHELL: 'https://www.nushell.sh/book/installation.html',
        MOJO: 'https://modular.com/mojo',
        ZIG: 'https://www.zvm.app/guides/install-zvm/',
    },
} as const;

export type LanguageCommand = (typeof CONSTANTS.COMMANDS)[keyof typeof CONSTANTS.COMMANDS];

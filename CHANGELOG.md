# Changelog

## v0.6.20

- Add activation for `.mdx` files

## v0.6.19

- Add `:once` directive for long running function code doesn't have dependent cells
- Move Mojo alias and functions into inner scope in main function, to fix closures
- Fix up the initial Mojo installation if not found

## v0.6.18

- Fix installation process bug for Mojo
- Move log messages outside of loop

## v0.6.17

- Fix issue with notebook editor sometimes hanging
- Migrate to compiling with tsc instead of esbuild
- Fix strict TSC checks
- Add logging to output channel `mdlab` to help debug issues

## v0.6.16

- Small README updates

## v0.6.15

- Remove console.log statements

## v0.6.14

- Fix Mojo trying to reinstall on every cell run
- Fix Python language commands

## v0.6.13

- Finish rename to `mdlab`
- Install Mojo globally if not on PATH
- Fix python language commands
- Publish on push instead of tag

## v0.6.12

- Fix issue with vscode marketplace

## v0.6.11

- Update vscode engine to work with latest Cursor

## v0.6.10

- Fix shortname

## v0.6.9

- Change name to `Markdown Lab`

## v0.6.8

- Add `:clear`, `:skip`, and `:create` commands to language cells
- Fix up some issues with `cd` and shell scripts keeping env vars
- Update vscode to latest engine, previously had some issues with renderer hanging

## v0.6.7

- Auto generate module from python cells when running Mojo cell

## v0.6.6

- Default to using mdlab when opening a .md file
- Improve README.md

## v0.6.5

- Add github actions CI

## v0.6.4

- Fix outputs from ML models having empty cells
- Add Groq llama3-8B option - 400ms latency
- Update to latest dependencies

## v0.6.3

- Add Mojo calling Python support via `py` module.

## v0.6.2

- Add `python3` check if `python` not on path
- Shellscript cells now save environment changes

## v0.6.1

- Add ability to clear output in Mojo and Python
- Add `# file:` to generate files with Mojo
- In shells `tree` ignore `__pycache__` and other generated files
- For shell scripts, just run a single cell not every previous cell as well
- Ignore whitespace when checking for first comment with `# file:` in python files 
- Writing files was causing multiple prints when importing another module
- Fix parsing to and from markdown, trim cells and get whitespace right
- Make cancellation of running cell always work
- Fix `Run all cells`

## v0.6.0

- Add Mojo
- Add `# file:` comment in python file to generate extra file
- Put files in same path so Mojo can call Python files
- Rename `chatgpt` to `openai` and allow selecting model
- Shell scripts now run in context of temp folder
- Allow deleting temp folder
- If command missing now comes up with error, and button to download
- Give error messages if something wrong with OpenAI api key

## v0.5.0

- Add chatgpt to generate code blocks

## v0.4.3

- Run shell commands from directory of the open file

## v0.4.2

- Update readme to show how to set default editor

## v0.4.1

- Change to `gopls imports` as this tool is installed by default with VS Code

## v0.4.0

- Add ability to use a [package] and set up your own `cargo.toml`
- Add `tokio::main` support
- Add shell languages

## v0.3.0

- Make end statement a dbg! instead of print to print a much larger array of types. 
- Added macro dbg_pretty! and dbg_named! to retain variable name when doing something in a loop.
- Added the ability to use `#` if last line is an expression to pretty print debug

## v0.2.1

- Make dbg! not print line numbers and file name

## v0.2.0

- Add auto formatting to Rust code when opening the source file
- Add print statements for final variables in Rust
- Add ability to put `#[restart]` and `#[ignore]` tags in blocks of Rust code
- Make `dbg!` macro print to `stdout` for Rust code, stop it sometimes going to a different cell when nodejs gets stdout and stderr out of sync

## v0.1.7

- Kill related process when the stop button is pressed

## v0.1.6

- Use esbuild-runner instead of ts-node for typescript, give warning text if not installed

## v0.1.5

- Bug with Rust outputs sometimes containing unwanted text

## v0.1.4

- Support Rust main functions with different signatures
- Fix rust imports using `_` seperators

## v0.1.3

- Fixed `dbg` outputs from Rust and other `stderr` text not being displayed on final output

## v0.1.2

- Sometimes using the mimetypes e.g. "text/x-rust" will fail, also doesn't look right with errors, removed for now, will need custom renderers

## v0.1.1

- Simplified all the stdout and stderr operations, fixed outputs not displaying in rust

## v0.1.0

- Add `nushell` support
- Fix stderr sometimes being cleared when there is some empty data sitting in stdout

## v0.0.1

Working notebook with Rust, Go, Javascript and Typescript
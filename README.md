# Markdown Lab

Generate notebook code blocks with LLMs that you can run interactively with any programming language. The source code is pure markdown and can render anywhere.

![render-anywhere](https://github.com/jackos/mdl/assets/77730378/e8327299-7d6d-42e8-a0bd-eaf1e93d2645)

## Quick Start

- Open or create a `.md` document and create a new cell
- Select a language down the bottom right
- Click the run button to generate the output which is saved to markdown

__Important Note__
When you right-click on a file and select `Reopen Editor With...` you can `configure default editor` to be the standard `Text Editor` if you choose, and then reopen wth `mdlab` only when you need it.

## AI Code Generation

![generate-primes](https://github.com/jackos/mdl/assets/77730378/35f34cc1-c7a0-4a5e-9f1e-edec2a593857)

### OpenAI

- [Set up an OpenAI key here](https://platform.openai.com/account/api-keys) and change the setting: `mdlab: openai key`
- Default model is `gpt-3.5-turbo`, change the setting with `mdlab: openai model` e.g. `gpt-4`
- Select `openai` as your language in the bottom right and ask a question
- Run the code blocks it generates for you

### Groq

- [Set up a Groq key here](https://console.groq.com/keys) and change the setting: `mdlab: Groq key`
- Default model is `llama3-8b-8192`, change the setting with `mdlab: groq model` to use other models like `llama3-70b-8192`, `llama-3.1-8b-instant`, `gemma2-9b-it`, `qwen-qwq-32b`, etc.
- Select `groq` as your language and ask it a question
- Run the code blocks it generates for you

## How it works

Straight nodejs stateless implementation for notebooks with no external binaries or npm runtime dependencies, works with compiled languages. Rather than using complicated kernels, it simply spawns a process that runs your local toolchain for the language you're using, and returns the output.

You don't have to go back and run old cells if you change them, every execution runs the whole program and sends output to the correct cell.

## Keybindings

You can change keybindings in File > Preferences > Keybindings > search for "mdlab". Or you can run them via command palette typing in "mdlab"

### Search notes

Set up a folder with `.md` documents in `mdlab: base path` and press `alt+f` to open a open search. This allows you to quickly search through your notes and execute code blocks. If you've ever used vimwiki this might bring back memories, but it's not reliant on a specific structure so you can set up your files for whatever static site generator you like.

### Open generated code

Press `alt+o` to open up the source code being used to generate outputs, which will allow you to check your code with a language server if it's not supported in the cells yet.

## Language Support

It's very simple to add your own language, look inside [src/languages/rust.ts](https://github.com/jackos/mdlab/blob/main/src/languages/python.ts) for an example, then add your language to the switch statement in the [`src/kernel.ts`](https://github.com/jackos/mdlab/blob/main/src/kernel.ts) `createLanguageProcess` function. PRs welcomed!

This README.md was created with `mdlab`, these are some special features for different languages:

### Python

Python has full LSP support and features you expect from Jupyter like printing out the last expression or variable in a cell:

```python
x = [5, 6, 7, 8]
x.reverse()
x
```

```text
[8, 7, 6, 5]
```

### Mojo

Mojo is a new Systems programming language for AI developers with Python syntax. 

It works with top level code and has some extra features like printing the last line.

LSP features don't work yet

### Rust

Can run top level code, and runs `dbg!` on the last line:

```rust
let mut x = vec![];
for i in 5..=8 {
    x.push(i);
}
x.reverse();
x
```

```text
[8, 7, 6, 5]
```

### Go

```groq
You can write top level code in Go:
```

```go
import "fmt"
import "os"
import "log"

// Create a slice of integers
numbers := []int{5, 6, 7, 8}

// Reverse the slice
for i, j := 0, len(numbers)-1; i < j; i, j = i+1, j-1 {
	numbers[i], numbers[j] = numbers[j], numbers[i]
}

// Print the reversed slice
fmt.Println("Reversed slice:", numbers)
```

```text
Reversed slice: [8 7 6 5]
```

### Javascript / TypeScript

JavaScript and TypeScript both work with LSP support, TypeScript uses esbuild for much faster responses. It will ask you to run:

```
npm install -g esbuild-runner
```

```ts
let numbers: number[] = [5, 6, 7, 8];
numbers = numbers.reverse();
console.log(numbers)
```

```text
[ 8, 7, 6, 5 ]
```

### Shell

You can use different shell languages to run scripts on the host system.

Experimental: Saves ENV changes as you run cells

- nu
- fish
- bash

```shellscript
#!/bin/bash
declare -a my_vec=(5 6 7 8)
reversed=($(printf '%s\n' "${my_vec[@]}" | tac))
echo "[ "${reversed[@]} "]"
```

```text
[ 8 7 6 5 ]
```

## Tests

The project includes end-to-end tests that verify the expected outputs for all
supported languages. To run the test suite:

```bash
npm run test
```

```plaintext
🧪 Running Kernel End-to-End Tests

✅ Python: Simple print statement
✅ Python: Variables and arithmetic
✅ Python: Functions
✅ Python: Import math module
✅ Python: Error handling
✅ Python: List comprehensions
✅ Python: Dictionary operations
✅ Python: Class definition
✅ JavaScript: Console.log
✅ JavaScript: Arrow functions
✅ JavaScript: Array methods
✅ JavaScript: Object destructuring
✅ JavaScript: Promises
✅ Bash: Echo command
✅ Bash: Variables
✅ Bash: Arithmetic
✅ Bash: For loop
✅ Bash: Function
✅ Go: Hello World
✅ Go: Functions and variables
✅ Rust: Hello World
✅ Rust: Functions

📊 Results: 22 passed, 0 failed
```

If you don't have a language installed, the tests for that language will be skipped.
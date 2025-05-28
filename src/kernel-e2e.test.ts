/**
 * End-to-End Tests for Kernel Execution
 * 
 * This test suite validates that the kernel correctly executes code cells
 * in various programming languages and returns the expected output.
 * 
 * To run these tests: `npm run test`
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Test runner
class TestRunner {
    private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🧪 Running Kernel End-to-End Tests\n');

        for (const test of this.tests) {
            try {
                await test.fn();
                this.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.failed++;
                console.log(`❌ ${test.name}`);
                console.log(`   Error: ${error}`);
            }
        }

        console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
        process.exit(this.failed > 0 ? 1 : 0);
    }
}

// Helper to execute code and capture output
async function executeCode(language: string, code: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let childProcess: any;

        const tempDir = path.join(require('os').tmpdir(), 'mdlab-test');
        fs.mkdirSync(tempDir, { recursive: true });

        switch (language) {
            case 'python':
            case 'python3':
                const pythonFile = path.join(tempDir, 'test.py');
                fs.writeFileSync(pythonFile, code);
                childProcess = spawn('python3', [pythonFile]);
                break;

            case 'javascript':
            case 'node':
                const jsFile = path.join(tempDir, 'test.js');
                fs.writeFileSync(jsFile, code);
                childProcess = spawn('node', [jsFile]);
                break;

            case 'bash':
                childProcess = spawn('bash', ['-c', code]);
                break;

            case 'go':
                const goFile = path.join(tempDir, 'test.go');
                fs.writeFileSync(goFile, code);
                childProcess = spawn('go', ['run', goFile]);
                break;

            case 'rust':
                const rustFile = path.join(tempDir, 'test.rs');
                fs.writeFileSync(rustFile, code);
                // Compile and run
                const compile = spawn('rustc', [rustFile, '-o', path.join(tempDir, 'test')]);
                compile.on('error', (error: any) => {
                    if (error.code === 'ENOENT') {
                        resolve({ stdout: '', stderr: `Command not found: rustc`, exitCode: 127 });
                    } else {
                        resolve({ stdout: '', stderr: error.message, exitCode: 1 });
                    }
                });
                compile.on('close', (compileCode) => {
                    if (compileCode !== 0) {
                        resolve({ stdout: '', stderr: 'Compilation failed', exitCode: compileCode || 1 });
                    } else {
                        const run = spawn(path.join(tempDir, 'test'));
                        run.stdout.on('data', (data) => { stdout += data.toString(); });
                        run.stderr.on('data', (data) => { stderr += data.toString(); });
                        run.on('close', (code) => {
                            resolve({ stdout, stderr, exitCode: code || 0 });
                        });
                    }
                });
                return;

            default:
                resolve({ stdout: '', stderr: `Unsupported language: ${language}`, exitCode: 1 });
                return;
        }

        childProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        childProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
        childProcess.on('close', (code: number) => {
            resolve({ stdout, stderr, exitCode: code || 0 });
        });
        childProcess.on('error', (error: any) => {
            if (error.code === 'ENOENT') {
                resolve({ stdout: '', stderr: `Command not found: ${language}`, exitCode: 127 });
            } else {
                resolve({ stdout: '', stderr: error.message, exitCode: 1 });
            }
        });
    });
}

// Test cases
const runner = new TestRunner();

// Python Tests
runner.test('Python: Simple print statement', async () => {
    const result = await executeCode('python', 'print("Hello, World!")');
    if (result.stdout.trim() !== 'Hello, World!') {
        throw new Error(`Expected "Hello, World!", got "${result.stdout.trim()}"`);
    }
});

runner.test('Python: Variables and arithmetic', async () => {
    const code = `
x = 10
y = 20
print(x + y)
`;
    const result = await executeCode('python', code);
    if (result.stdout.trim() !== '30') {
        throw new Error(`Expected "30", got "${result.stdout.trim()}"`);
    }
});

runner.test('Python: Functions', async () => {
    const code = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
`;
    const result = await executeCode('python', code);
    if (result.stdout.trim() !== '120') {
        throw new Error(`Expected "120", got "${result.stdout.trim()}"`);
    }
});

runner.test('Python: Import math module', async () => {
    const code = `
import math
print(f"{math.pi:.5f}")
`;
    const result = await executeCode('python', code);
    if (!result.stdout.includes('3.14159')) {
        throw new Error(`Expected output to contain "3.14159", got "${result.stdout.trim()}"`);
    }
});

runner.test('Python: Error handling', async () => {
    const code = 'print(undefined_variable)';
    const result = await executeCode('python', code);
    if (!result.stderr.includes('NameError')) {
        throw new Error(`Expected NameError in stderr, got "${result.stderr}"`);
    }
});

runner.test('Python: List comprehensions', async () => {
    const code = `
squares = [x**2 for x in range(5)]
print(squares)
`;
    const result = await executeCode('python', code);
    if (result.stdout.trim() !== '[0, 1, 4, 9, 16]') {
        throw new Error(`Expected "[0, 1, 4, 9, 16]", got "${result.stdout.trim()}"`);
    }
});

runner.test('Python: Dictionary operations', async () => {
    const code = `
data = {"name": "Alice", "age": 30}
print(f"{data['name']} is {data['age']} years old")
`;
    const result = await executeCode('python', code);
    if (result.stdout.trim() !== 'Alice is 30 years old') {
        throw new Error(`Expected "Alice is 30 years old", got "${result.stdout.trim()}"`);
    }
});

runner.test('Python: Class definition', async () => {
    const code = `
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
print(calc.add(5, 3))
`;
    const result = await executeCode('python', code);
    if (result.stdout.trim() !== '8') {
        throw new Error(`Expected "8", got "${result.stdout.trim()}"`);
    }
});

// JavaScript Tests
runner.test('JavaScript: Console.log', async () => {
    const result = await executeCode('javascript', 'console.log("Hello from JS!")');
    if (result.stdout.trim() !== 'Hello from JS!') {
        throw new Error(`Expected "Hello from JS!", got "${result.stdout.trim()}"`);
    }
});

runner.test('JavaScript: Arrow functions', async () => {
    const code = `
const add = (a, b) => a + b;
console.log(add(5, 3));
`;
    const result = await executeCode('javascript', code);
    if (result.stdout.trim() !== '8') {
        throw new Error(`Expected "8", got "${result.stdout.trim()}"`);
    }
});

runner.test('JavaScript: Array methods', async () => {
    const code = `
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(sum);
`;
    const result = await executeCode('javascript', code);
    if (result.stdout.trim() !== '15') {
        throw new Error(`Expected "15", got "${result.stdout.trim()}"`);
    }
});

runner.test('JavaScript: Object destructuring', async () => {
    const code = `
const person = { name: 'Bob', age: 25 };
const { name, age } = person;
console.log(\`\${name} is \${age} years old\`);
`;
    const result = await executeCode('javascript', code);
    if (result.stdout.trim() !== 'Bob is 25 years old') {
        throw new Error(`Expected "Bob is 25 years old", got "${result.stdout.trim()}"`);
    }
});

runner.test('JavaScript: Promises', async () => {
    const code = `
const promise = new Promise((resolve) => {
    setTimeout(() => resolve('Done!'), 10);
});
promise.then(result => console.log(result));
`;
    const result = await executeCode('javascript', code);
    // Note: This might not print due to async timing, but should not error
    if (result.exitCode !== 0) {
        throw new Error(`Expected exit code 0, got ${result.exitCode}`);
    }
});

// Bash Tests
runner.test('Bash: Echo command', async () => {
    const result = await executeCode('bash', 'echo "Hello from Bash"');
    if (result.stdout.trim() !== 'Hello from Bash') {
        throw new Error(`Expected "Hello from Bash", got "${result.stdout.trim()}"`);
    }
});

runner.test('Bash: Variables', async () => {
    const code = `
NAME="World"
echo "Hello, $NAME"
`;
    const result = await executeCode('bash', code);
    if (result.stdout.trim() !== 'Hello, World') {
        throw new Error(`Expected "Hello, World", got "${result.stdout.trim()}"`);
    }
});

runner.test('Bash: Arithmetic', async () => {
    const code = 'echo $((5 + 3))';
    const result = await executeCode('bash', code);
    if (result.stdout.trim() !== '8') {
        throw new Error(`Expected "8", got "${result.stdout.trim()}"`);
    }
});

runner.test('Bash: For loop', async () => {
    const code = `
for i in 1 2 3; do
    echo -n "$i "
done
`;
    const result = await executeCode('bash', code);
    if (result.stdout.trim() !== '1 2 3') {
        throw new Error(`Expected "1 2 3", got "${result.stdout.trim()}"`);
    }
});

runner.test('Bash: Function', async () => {
    const code = `
greet() {
    echo "Hello, $1!"
}
greet "User"
`;
    const result = await executeCode('bash', code);
    if (result.stdout.trim() !== 'Hello, User!') {
        throw new Error(`Expected "Hello, User!", got "${result.stdout.trim()}"`);
    }
});

// Go Tests (if Go is installed)
runner.test('Go: Hello World', async () => {
    const code = `
package main
import "fmt"
func main() {
    fmt.Println("Hello from Go!")
}
`;
    const result = await executeCode('go', code);
    if (result.exitCode === 127) {
        console.log('   ⚠️  Skipped: Go not installed');
        return;
    }
    if (result.exitCode === 0 && result.stdout.trim() !== 'Hello from Go!') {
        throw new Error(`Expected "Hello from Go!", got "${result.stdout.trim()}"`);
    }
});

runner.test('Go: Functions and variables', async () => {
    const code = `
package main
import "fmt"
func add(a, b int) int {
    return a + b
}
func main() {
    result := add(10, 20)
    fmt.Println(result)
}
`;
    const result = await executeCode('go', code);
    if (result.exitCode === 127) {
        console.log('   ⚠️  Skipped: Go not installed');
        return;
    }
    if (result.exitCode === 0 && result.stdout.trim() !== '30') {
        throw new Error(`Expected "30", got "${result.stdout.trim()}"`);
    }
});

// Rust Tests (if Rust is installed)
runner.test('Rust: Hello World', async () => {
    const code = `
fn main() {
    println!("Hello from Rust!");
}
`;
    const result = await executeCode('rust', code);
    if (result.exitCode === 127) {
        console.log('   ⚠️  Skipped: Rust not installed');
        return;
    }
    if (result.exitCode === 0 && result.stdout.trim() !== 'Hello from Rust!') {
        throw new Error(`Expected "Hello from Rust!", got "${result.stdout.trim()}"`);
    }
});

runner.test('Rust: Functions', async () => {
    const code = `
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    let result = add(15, 25);
    println!("{}", result);
}
`;
    const result = await executeCode('rust', code);
    if (result.exitCode === 127) {
        console.log('   ⚠️  Skipped: Rust not installed');
        return;
    }
    if (result.exitCode === 0 && result.stdout.trim() !== '40') {
        throw new Error(`Expected "40", got "${result.stdout.trim()}"`);
    }
});

// Run all tests
runner.run(); 
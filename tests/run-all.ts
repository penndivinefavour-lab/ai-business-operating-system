// tests/run-all.ts
import { run } from 'node:test';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const testsDir = new URL('.', import.meta.url).pathname;
const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log(`Running ${testFiles.length} test files...\n`);

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  console.log(`\n── ${file} ──────────────────────`);
  try {
    const result = await new Promise<number>((resolve) => {
      const proc = spawn('node', ['--experimental-strip-types', '--test', join(testsDir, file)], {
        stdio: 'inherit',
      });
      proc.on('exit', (code) => resolve(code ?? 1));
    });
    if (result === 0) {
      passed++;
      console.log(`✓ ${file} PASSED`);
    } else {
      failed++;
      console.log(`✗ ${file} FAILED`);
    }
  } catch (err) {
    failed++;
    console.log(`✗ ${file} ERROR:`, err);
  }
}

console.log(`\n════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

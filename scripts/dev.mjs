// Translate the supervised preview's Vite-style flags while retaining Next.js.
import { spawn } from 'node:child_process';
const args = process.argv
  .slice(2)
  .filter((arg) => arg !== '--strictPort')
  .map((arg) => (arg === '--host' ? '--hostname' : arg));
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', ...args],
  { stdio: 'inherit' },
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const response = await fetch('https://registry.npmjs.org/npm/-/npm-11.6.0.tgz');
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
fs.mkdirSync('.sites-runtime/npm', {recursive: true});
fs.writeFileSync('.sites-runtime/npm/npm.tgz', Buffer.from(await response.arrayBuffer()));
execFileSync('tar', ['-xzf', '.sites-runtime/npm/npm.tgz', '-C', '.sites-runtime/npm']);
fs.writeFileSync('.sites-runtime/npm/npm.cmd', '@echo off\r\nnode "%~dp0package\\bin\\npm-cli.js" %*\r\n');

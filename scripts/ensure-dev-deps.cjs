#!/usr/bin/env node
const {existsSync} = require('node:fs');
const {join} = require('node:path');
const {spawnSync} = require('node:child_process');

const projectRoot = process.cwd();
const targetPath = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

const log = message => console.log(`[ensure-dev-deps] ${message}`);

if (existsSync(targetPath)) {
  log('Dependencies already present.');
  process.exit(0);
}

log('Next.js binary not found. Installing dependencies with Yarn.');

const yarnArgs = ['install', '--frozen-lockfile', '--check-files'];
const run = (command, args) => spawnSync(command, args, {stdio: 'inherit'});

let result = run('corepack', ['yarn', ...yarnArgs]);

if (result.error || result.status !== 0) {
  log('corepack yarn install failed. Trying plain yarn.');
  result = run('yarn', yarnArgs);
}

if (result.error || result.status !== 0) {
  log('Yarn install failed.');
  process.exit(result.status ?? 1);
}

if (!existsSync(targetPath)) {
  log('Dependencies installation completed but Next.js binary is still missing.');
  process.exit(1);
}

log('Dependencies installed successfully.');


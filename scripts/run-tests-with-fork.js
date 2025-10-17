#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const process = require('process');

require('dotenv').config();

const HARDHAT_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const NODE_PATH = process.execPath;

const FORK_RPC_URL = process.env.MAINNET_FORK_RPC_URL || process.env.RPC_URL;
const FORK_PORT = process.env.MAINNET_FORK_PORT || String(Math.floor(Math.random() * 10000) + 40000);
const FORK_HOST = process.env.MAINNET_FORK_HOST || '127.0.0.1';

if (!FORK_RPC_URL) {
  console.error('MAINNET_FORK_RPC_URL or RPC_URL must be set to a mainnet provider for forking.');
  process.exit(1);
}

let hardhatProcess;
let testsProcess;
let hasStartedTests = false;
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  if (testsProcess && !testsProcess.killed) {
    testsProcess.kill('SIGINT');
  }

  if (hardhatProcess && !hardhatProcess.killed) {
    hardhatProcess.kill('SIGINT');
    setTimeout(() => {
      if (hardhatProcess && !hardhatProcess.killed) {
        hardhatProcess.kill('SIGKILL');
      }
    }, 2000);
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
process.on('exit', () => {
  if (hardhatProcess && !hardhatProcess.killed) {
    hardhatProcess.kill('SIGINT');
  }
});

function startTests() {
  if (hasStartedTests) {
    return;
  }
  hasStartedTests = true;

  const testEnv = {
    ...process.env,
    RPC_URL: `http://${FORK_HOST}:${FORK_PORT}`
  };

  testsProcess = spawn(
    NODE_PATH,
    ['--test', path.join(__dirname, '..', 'tests', 'api.test.js')],
    {
      env: testEnv,
      stdio: 'inherit'
    }
  );

  testsProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Tests exited with code ${code}`);
      shutdown(code);
    } else {
      console.log('Tests completed successfully.');
      shutdown(0);
    }
  });
}

function startHardhatNode() {
  console.log(`Starting Hardhat mainnet fork on port ${FORK_PORT}...`);

  const hardhatEnv = {
    ...process.env,
    MAINNET_FORK_RPC_URL: FORK_RPC_URL
  };

  const args = ['hardhat', 'node', '--hostname', FORK_HOST, '--port', FORK_PORT];

  hardhatProcess = spawn(HARDHAT_CMD, args, {
    env: hardhatEnv,
    cwd: path.join(__dirname, '..'),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  let startupBuffer = '';

  hardhatProcess.stdout.on('data', (data) => {
    const message = data.toString();
    process.stdout.write(message);
    startupBuffer += message;

    if (
      startupBuffer.includes('Started HTTP and WebSocket JSON-RPC server at') ||
      startupBuffer.includes('Hardhat Network started') ||
      (startupBuffer.includes('http://') && startupBuffer.includes(FORK_PORT))
    ) {
      setTimeout(() => startTests(), 2000);
    }
  });

  hardhatProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  hardhatProcess.on('close', (code) => {
    if (!hasStartedTests) {
      console.error(`Hardhat node exited before tests could start. Exit code: ${code}`);
      shutdown(code || 1);
    }
  });
}

startHardhatNode();

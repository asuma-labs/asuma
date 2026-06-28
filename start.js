import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESTART_DELAY = 3000;

let child = null;
let restarting = false;
let shuttingDown = false;

function start() {
    restarting = false;

    const args = [path.join(__dirname, 'index.js'), ...process.argv.slice(2)];

    console.log(chalk.blue.bold('[BOT] Starting process...'));

    child = spawn(process.argv[0], args, {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });

    child.once('message', handleMessage);
    child.once('error', handleError);
    child.once('exit', handleExit);
}

function handleMessage(data) {
    switch (data) {
        case 'reset':
            if (restarting || shuttingDown) return;

            restarting = true;

            console.log(chalk.yellow.bold('[BOT] Restart requested.'));
            child.kill();

            break;

        case 'uptime':
            child.send(process.uptime());
            break;

        case 'exit':
            shuttingDown = true;
            child.kill();
            break;
    }

    child.once('message', handleMessage);
}

function handleError(err) {
    console.error(chalk.red.bold('[BOT] Failed to start subprocess.'));
    console.error(err);
}

function handleExit(code, signal) {
    child = null;

    if (shuttingDown) {
        console.log(chalk.green.bold('[BOT] Shutdown complete.'));
        process.exit(0);
    }

    if (restarting) {
        console.log(chalk.yellow.bold(`[BOT] Restarting in ${RESTART_DELAY / 1000}s...`));
        return setTimeout(start, RESTART_DELAY);
    }

    if (code !== 0 || signal) {
        console.error(
            chalk.red.bold(
                `[BOT] Process crashed (code=${code}, signal=${signal}). Restarting...`
            )
        );

        return setTimeout(start, RESTART_DELAY);
    }

    console.log(chalk.green.bold('[BOT] Process exited normally.'));
    process.exit(0);
}

process.on('SIGINT', () => {
    shuttingDown = true;
    if (child) child.kill();
    else process.exit(0);
});

process.on('SIGTERM', () => {
    shuttingDown = true;
    if (child) child.kill();
    else process.exit(0);
});

process.on('uncaughtException', err => {
    console.error(chalk.red.bold('[BOT] Uncaught Exception'));
    console.error(err);
});

process.on('unhandledRejection', reason => {
    console.error(chalk.red.bold('[BOT] Unhandled Rejection'));
    console.error(reason);
});

start();

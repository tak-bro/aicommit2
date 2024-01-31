import readline from 'readline';

import chalk from 'chalk';
import figlet from 'figlet';
import ora, { Ora } from 'ora';

import { getDetectedMessage } from '../utils/git.js';

export class LogManager {
    private title = 'aicommit2';

    printTitle() {
        console.log(figlet.textSync(this.title, { font: 'Small' }));
    }

    displaySpinner(text: string): Ora {
        return ora(text).start();
    }

    stopSpinner(spinner: Ora) {
        spinner.stop();
        spinner.clear();
    }

    printStagedFiles(staged: { files: string[]; diff: string }) {
        console.log(chalk.bold.green('✔ ') + chalk.bold(`${getDetectedMessage(staged.files)}:`));
        console.log(`${staged.files.map(file => `     ${file}`).join('\n')}\n`);
    }

    printAnalyzed() {
        console.log(`\n${chalk.bold.green('✔')} ${chalk.bold(`Changes analyzed`)}`);
    }

    printCommitted() {
        console.log(`\n${chalk.bold.green('✔')} ${chalk.bold(`Successfully committed!`)}`);
    }

    printSavedCommitMessage() {
        console.log(`\n${chalk.bold.green('✔')} ${chalk.bold(`Saved commit message`)}`);
    }

    printCancelledCommit() {
        console.log(`\n${chalk.bold.yellow('⚠')} ${chalk.yellow('Commit cancelled')}`);
    }

    printErrorMessage(message: string) {
        console.log(`\n${chalk.bold.red('✖')} ${chalk.red(`${message}`)}`);
    }

    moveCursorUp() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        readline.moveCursor(process.stdout, 0, -1);
        rl.close();
    }

    moveCursorDown() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        readline.moveCursor(process.stdout, 0, 1);
        rl.close();
    }
}

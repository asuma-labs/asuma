import chalk from 'chalk';

const logger = {
    box: (title, color, items) => {
        const width = 58;
        const boxTop = `╭${'─'.repeat(width)}╮`;
        const boxBottom = `╰${'─'.repeat(width)}╯`;
        
        console.log(chalk.hex(color).bold(boxTop));
        console.log(chalk.hex(color).bold(`│ ${title.padEnd(width - 2)} │`));
        console.log(chalk.hex(color).bold(`├${'─'.repeat(width)}┤`));
        
        items.forEach(item => {
            const visibleLength = item.replace(/\u001b\[[0-9;]*m/g, '').length;
            const padSize = Math.max(0, width - 2 - visibleLength);
            console.log(chalk.hex(color).bold(`│ ${item}${' '.repeat(padSize)} │`));
        });
        
        console.log(chalk.hex(color).bold(boxBottom));
    },
    
    error: (msg, err) => {
        console.error(chalk.red.bold('Error:'), msg, err || '');
    },
    
    info: (msg) => {
        console.log(chalk.cyan.bold('Info:'), msg);
    }
};

export default logger;

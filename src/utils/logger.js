const chalk = require('chalk');

class Logger {
  static getTimestamp() {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  static success(message) {
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.green('✓')} ${message}`);
  }

  static info(message) {
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.blue('•')} ${message}`);
  }

  static warning(message) {
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.yellow('⚠')} ${message}`);
  }

  static error(message, error = null) {
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.red('✗')} ${message}`);
    if (error && process.env.NODE_ENV === 'development') {
      console.log(chalk.red(`   ${error.message || error}`));
    }
  }

  static webhook(message, eventType = null) {
    const event = eventType ? chalk.dim(`[${eventType}] `) : '';
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.green('📨')} ${event}${message}`);
  }

  static storyblok(message, operation = null) {
    const op = operation ? chalk.dim(`[${operation}] `) : '';
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.blue('🔹')} ${op}${message}`);
  }

  static server(message) {
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.cyan('🚀')} ${message}`);
  }

  static test(message) {
    console.log(`${chalk.gray(this.getTimestamp())} ${chalk.magenta('🧪')} ${message}`);
  }

  static space() {
    console.log('');
  }

  static section(title) {
    console.log('');
    console.log(chalk.dim(`─── ${title} ───`));
  }
}

module.exports = Logger;
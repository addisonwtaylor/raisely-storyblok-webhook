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
    console.log(`${chalk.green('✓')} ${chalk.green(message)}`);
  }

  static info(message) {
    console.log(`  ${chalk.dim(message)}`);
  }

  static step(message) {
    console.log(`  → ${message}`);
  }

  static warning(message) {
    console.log(`${chalk.yellow('⚠')} ${chalk.yellow(message)}`);
  }

  static error(message, error = null) {
    console.log(`${chalk.red('✗')} ${chalk.red(message)}`);
    if (error && process.env.NODE_ENV === 'development') {
      console.log(`     ${chalk.red(error.message || error)}`);
    }
  }

  static webhook(message, eventType = null) {
    console.log(`${chalk.blue('📨')} ${message}`);
  }

  static result(message) {
    console.log(`${chalk.green('✓')} ${message}`);
  }

  static server(message) {
    console.log(`🚀 ${message}`);
  }

  static test(message) {
    console.log(`🧪 ${message}`);
  }

  static space() {
    console.log('');
  }

  static section(title) {
    console.log('');
    console.log(chalk.bold.blue(`━━━ ${title} ━━━`));
  }
}

module.exports = Logger;
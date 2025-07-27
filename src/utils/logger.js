const chalk = require('chalk');

class Logger {
  static verboseMode = process.env.VERBOSE === 'true' || process.env.NODE_ENV === 'development';

  static getTimestamp() {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  // Always show important results
  static success(message) {
    console.log(`${chalk.green('✓')} ${chalk.green(message)}`);
  }

  // Show detailed info only in verbose mode
  static info(message) {
    if (this.verboseMode) {
      console.log(`  ${chalk.dim(message)}`);
    }
  }

  // Show processing steps (controlled verbosity)
  static step(message) {
    if (this.verboseMode) {
      console.log(`  → ${message}`);
    }
  }

  // Always show warnings
  static warning(message) {
    console.log(`${chalk.yellow('⚠')} ${chalk.yellow(message)}`);
  }

  // Always show errors
  static error(message, error = null) {
    console.log(`${chalk.red('✗')} ${chalk.red(message)}`);
    if (error && this.verboseMode) {
      console.log(`     ${chalk.red(error.message || error)}`);
    }
  }

  // Always show webhook activity
  static webhook(message, eventType = null) {
    console.log(`${chalk.blue('📨')} ${message}`);
  }

  // Always show results
  static result(message) {
    console.log(`${chalk.green('✓')} ${message}`);
  }

  // Always show server messages
  static server(message) {
    console.log(`🚀 ${message}`);
  }

  // Show test messages only in verbose mode
  static test(message) {
    if (this.verboseMode) {
      console.log(`🧪 ${message}`);
    }
  }

  // Controlled spacing
  static space() {
    if (this.verboseMode) {
      console.log('');
    }
  }

  // Always show sections
  static section(title) {
    console.log('');
    console.log(chalk.bold.blue(`━━━ ${title} ━━━`));
  }

  // New method for compact progress updates
  static progress(message) {
    console.log(`${chalk.cyan('►')} ${message}`);
  }

  // New method for compact operation summaries
  static summary(message) {
    console.log(`${chalk.magenta('📊')} ${message}`);
  }
}

module.exports = Logger;
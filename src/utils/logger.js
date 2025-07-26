/**
 * Simple logging utility with timestamps and emojis
 */
class Logger {
  static info(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ℹ️  ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static success(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static warning(message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️  ${message}`);
    if (data) {
      console.warn(JSON.stringify(data, null, 2));
    }
  }

  static error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}`);
    if (error) {
      console.error(error.stack || error);
    }
  }

  static webhook(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📨 ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

module.exports = Logger;
class Logger {
  constructor() {
    this.isDebug = false;
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
  }

  // 设置调试模式
  setDebug(enabled) {
    this.isDebug = enabled;
  }

  // 记录调试信息
  debug(message, ...args) {
    if (this.isDebug) {
      this._log('DEBUG', message, ...args);
    }
  }

  // 记录普通信息
  info(message, ...args) {
    this._log('INFO', message, ...args);
  }

  // 记录警告信息
  warn(message, ...args) {
    this._log('WARN', message, ...args);
  }

  // 记录错误信息
  error(message, error = null, ...args) {
    this._log('ERROR', message, ...args);
    if (error) {
      console.error('Error details:', error);
      // 可以在这里添加错误上报逻辑
      this._reportError(error);
    }
  }

  // 内部日志方法
  _log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message, ...args);
        break;
      case 'INFO':
        console.info(prefix, message, ...args);
        break;
      case 'WARN':
        console.warn(prefix, message, ...args);
        break;
      case 'ERROR':
        console.error(prefix, message, ...args);
        break;
    }

    // 保存日志到storage
    this._saveLog(level, message, args);
  }

  // 保存日志到storage
  async _saveLog(level, message, args) {
    try {
      const log = {
        timestamp: new Date().toISOString(),
        level,
        message,
        args
      };

      // 获取现有日志
      const result = await chrome.storage.local.get(['logs']);
      const logs = result.logs || [];
      
      // 添加新日志
      logs.push(log);
      
      // 只保留最近100条日志
      if (logs.length > 100) {
        logs.shift();
      }
      
      // 保存日志
      await chrome.storage.local.set({ logs });
    } catch (error) {
      console.error('保存日志失败:', error);
    }
  }

  // 错误上报
  async _reportError(error) {
    try {
      // 获取错误详情
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      };

      // 获取现有错误记录
      const result = await chrome.storage.local.get(['errors']);
      const errors = result.errors || [];
      
      // 添加新错误
      errors.push(errorInfo);
      
      // 只保留最近50条错误记录
      if (errors.length > 50) {
        errors.shift();
      }
      
      // 保存错误记录
      await chrome.storage.local.set({ errors });
    } catch (e) {
      console.error('保存错误记录失败:', e);
    }
  }

  // 获取日志
  async getLogs() {
    try {
      const result = await chrome.storage.local.get(['logs']);
      return result.logs || [];
    } catch (error) {
      console.error('获取日志失败:', error);
      return [];
    }
  }

  // 获取错误记录
  async getErrors() {
    try {
      const result = await chrome.storage.local.get(['errors']);
      return result.errors || [];
    } catch (error) {
      console.error('获取错误记录失败:', error);
      return [];
    }
  }

  // 清除日志
  async clearLogs() {
    try {
      await chrome.storage.local.set({ logs: [] });
    } catch (error) {
      console.error('清除日志失败:', error);
    }
  }

  // 清除错误记录
  async clearErrors() {
    try {
      await chrome.storage.local.set({ errors: [] });
    } catch (error) {
      console.error('清除错误记录失败:', error);
    }
  }
}

// 导出单例实例
export const logger = new Logger(); 
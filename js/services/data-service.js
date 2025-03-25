import { logger } from './logger.js';

export class DataService {
  constructor() {
    this.retryCount = 3;
    this.retryDelay = 1000; // 1秒
  }

  // 获取期权数据
  async fetchOptionData(symbols) {
    try {
      logger.debug(`开始获取期权数据: ${symbols.join(', ')}`);
      
      // 模拟数据，实际项目中需要替换为真实API调用
      const data = symbols.map(symbol => ({
        symbol,
        impliedVolatility: Math.random() * 30 + 10, // 10-40之间的随机数
        updateTime: new Date().toLocaleTimeString()
      }));
      
      logger.info('期权数据获取成功');
      return data;
    } catch (error) {
      logger.error('获取期权数据失败', error);
      throw error;
    }
  }

  // 验证数据
  validateData(data) {
    try {
      if (!Array.isArray(data)) {
        logger.warn('数据格式无效：不是数组');
        return [];
      }

      const validData = data.filter(item => {
        if (!item.symbol || typeof item.impliedVolatility !== 'number') {
          logger.warn(`数据项无效: ${JSON.stringify(item)}`);
          return false;
        }
        return true;
      });

      if (validData.length === 0) {
        logger.warn('没有有效数据');
      }

      return validData;
    } catch (error) {
      logger.error('验证数据失败', error);
      return [];
    }
  }

  // 计算波动率变化
  calculateIVChange(current, previous) {
    try {
      if (!previous || !previous.impliedVolatility) {
        return 0;
      }

      const change = ((current.impliedVolatility - previous.impliedVolatility) / previous.impliedVolatility) * 100;
      logger.debug(`计算波动率变化: ${current.symbol} ${change.toFixed(2)}%`);
      return change;
    } catch (error) {
      logger.error('计算波动率变化失败', error);
      return 0;
    }
  }
}

// 导出单例实例
export const dataService = new DataService(); 
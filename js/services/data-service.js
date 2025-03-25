import { logger } from './logger.js';

export class DataService {
  constructor() {
    this.retryCount = 3;
    this.retryDelay = 1000; // 1秒
    this.apiBaseUrl = 'http://localhost:3000/api'; // 本地开发API代理服务器地址
  }

  // 获取期权数据，支持真实API和模拟数据
  async fetchOptionData(symbols, useRealData = false) {
    try {
      logger.debug(`开始获取期权数据: ${symbols.join(', ')}, 使用真实数据: ${useRealData}`);
      
      if (useRealData) {
        return await this.fetchRealOptionData(symbols);
      } else {
        // 模拟数据，测试时使用
        const data = symbols.map(symbol => ({
          symbol,
          impliedVolatility: Math.random() * 30 + 10, // 10-40之间的随机数
          updateTime: new Date().toLocaleTimeString()
        }));
        
        logger.info('期权数据获取成功(模拟数据)');
        return data;
      }
    } catch (error) {
      logger.error('获取期权数据失败', error);
      throw error;
    }
  }

  // 获取真实期权数据
  async fetchRealOptionData(symbols) {
    try {
      logger.debug('开始请求真实期权数据');
      
      const data = [];
      
      // 处理每个符号
      for (const symbol of symbols) {
        // 根据符号类型选择合适的API
        let endpoint = '';
        if (symbol.includes('50') || symbol === 'ETF50') {
          endpoint = '/index_option_50etf_qvix';
        } else if (symbol.includes('300') || symbol === 'CSI300') {
          endpoint = '/index_option_300index_qvix';
        } else if (symbol.includes('1000')) {
          endpoint = '/index_option_1000index_qvix';
        } else if (symbol.includes('IF')) {
          endpoint = '/index_option_300index_qvix'; // IF期货对应沪深300指数
        } else if (symbol.includes('IC')) {
          endpoint = '/index_option_500index_qvix'; // IC期货对应中证500指数
        } else if (symbol.includes('IH')) {
          endpoint = '/index_option_50index_qvix'; // IH期货对应上证50指数
        }
        
        if (endpoint) {
          try {
            // 发起API请求
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
            
            if (!response.ok) {
              throw new Error(`API响应错误: ${response.status}`);
            }
            
            const result = await response.json();
            
            // 处理获取到的数据
            if (result && result.length > 0) {
              // 取最新一条记录
              const latestData = result[result.length - 1];
              
              data.push({
                symbol,
                impliedVolatility: parseFloat(latestData.close),
                price: 0, // 注意：这个API可能不返回价格，需要通过其他接口获取
                updateTime: new Date().toLocaleTimeString(),
                date: latestData.date
              });
              
              logger.debug(`成功获取${symbol}数据: IV=${latestData.close}`);
            }
          } catch (apiError) {
            logger.error(`获取${symbol}数据失败`, apiError);
            // 出错时添加默认数据，避免整个请求失败
            data.push({
              symbol,
              impliedVolatility: symbol.includes('F') ? 4.4 : 3.6,
              updateTime: new Date().toLocaleTimeString(),
              isDefault: true
            });
          }
        } else {
          // 没有匹配的接口时使用默认数据
          data.push({
            symbol,
            impliedVolatility: symbol.includes('F') ? 4.4 : 3.6,
            updateTime: new Date().toLocaleTimeString(),
            isDefault: true
          });
        }
      }
      
      logger.info(`真实期权数据获取成功，共${data.length}条`);
      return data;
    } catch (error) {
      logger.error('获取真实期权数据失败', error);
      // 失败时返回模拟数据
      return symbols.map(symbol => ({
        symbol,
        impliedVolatility: symbol.includes('F') ? 4.4 : 3.6,
        updateTime: new Date().toLocaleTimeString(),
        isDefault: true
      }));
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
import { dataService } from './js/services/data-service.js';
import { logger } from './js/services/logger.js';

// 初始化配置
chrome.runtime.onInstalled.addListener(async () => {
  try {
    logger.info('插件安装/更新');
    
    // 设置默认配置
    await chrome.storage.local.set({
      symbols: ['IF', 'IC', 'IH'],
      refreshInterval: 60,
      notifications: {
        enabled: true,
        threshold: 5 // 波动率变化超过5%时通知
      }
    });
    
    logger.info('默认配置已设置');
    
    // 创建定时任务
    setupAlarm();
  } catch (error) {
    logger.error('初始化配置失败', error);
  }
});

// 设置定时任务
function setupAlarm() {
  try {
    chrome.alarms.create('refreshData', {
      periodInMinutes: 1 // 每分钟更新一次
    });
    logger.info('定时任务已设置');
  } catch (error) {
    logger.error('设置定时任务失败', error);
  }
}

// 监听定时任务
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshData') {
    await refreshData();
  }
});

// 刷新数据
async function refreshData() {
  try {
    logger.debug('开始刷新数据');
    
    // 获取配置
    const config = await chrome.storage.local.get(['symbols', 'notifications']);
    const symbols = config.symbols || ['IF', 'IC', 'IH'];
    
    // 获取数据
    const data = await dataService.fetchOptionData(symbols);
    
    // 验证数据
    const validData = dataService.validateData(data);
    if (validData.length === 0) {
      throw new Error('没有有效数据');
    }
    
    // 获取上次数据用于比较
    const previousData = await chrome.storage.local.get(['lastData']);
    const lastData = previousData.lastData || {};
    
    // 检查是否需要发送通知
    if (config.notifications?.enabled) {
      checkAndNotify(validData, lastData, config.notifications.threshold);
    }
    
    // 保存当前数据
    await chrome.storage.local.set({ lastData: validData });
    
    // 广播数据更新消息
    chrome.runtime.sendMessage({
      type: 'DATA_UPDATED',
      data: validData
    });
    
    logger.info('数据刷新完成');
  } catch (error) {
    logger.error('刷新数据失败', error);
  }
}

// 检查并发送通知
function checkAndNotify(currentData, previousData, threshold) {
  try {
    currentData.forEach(item => {
      const previousItem = previousData[item.symbol];
      if (previousItem) {
        const ivChange = dataService.calculateIVChange(item, previousItem);
        if (Math.abs(ivChange) >= threshold) {
          sendNotification(item, ivChange);
        }
      }
    });
  } catch (error) {
    logger.error('检查通知条件失败', error);
  }
}

// 发送通知
function sendNotification(item, ivChange) {
  try {
    const direction = ivChange >= 0 ? '上涨' : '下跌';
    const title = `${item.symbol} 隐含波动率${direction}提醒`;
    const message = `当前隐含波动率: ${item.impliedVolatility.toFixed(2)}%\n变化幅度: ${ivChange.toFixed(2)}%`;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon128.png',
      title: title,
      message: message
    });
    
    logger.info(`已发送通知: ${title}`);
  } catch (error) {
    logger.error('发送通知失败', error);
  }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_IV_DATA') {
    refreshData().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      logger.error('处理GET_IV_DATA请求失败', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  }
  
  if (request.type === 'UPDATE_CONFIG') {
    try {
      chrome.storage.local.set(request.config).then(() => {
        logger.info('配置已更新');
        sendResponse({ success: true });
      });
    } catch (error) {
      logger.error('更新配置失败', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
}); 
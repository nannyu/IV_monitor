import { dataService } from './js/services/data-service.js';
import { logger } from './js/services/logger.js';

// 保存创建的窗口ID
let monitorWindowId = null;

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
    await setupAlarm();
    
    // 初始化时立即刷新一次数据
    await refreshData();
  } catch (error) {
    logger.error('初始化配置失败', error);
  }
});

// 监听扩展图标点击
chrome.action.onClicked.addListener(async () => {
  try {
    // 检查窗口是否已存在
    if (monitorWindowId !== null) {
      // 如果窗口已存在，则聚焦该窗口
      try {
        await chrome.windows.update(monitorWindowId, { focused: true });
        return;
      } catch (e) {
        // 如果更新窗口失败，可能窗口已关闭，重新创建
        monitorWindowId = null;
      }
    }
    
    // 创建新窗口 - 适应新的UI设计
    const win = await chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 350,
      height: 210,
      focused: true,
      // 添加窗口属性使其始终置顶
      alwaysOnTop: true
    });
    
    // 保存窗口ID
    monitorWindowId = win.id;
    
    // 监听窗口关闭事件
    chrome.windows.onRemoved.addListener((windowId) => {
      if (windowId === monitorWindowId) {
        monitorWindowId = null;
      }
    });
    
    logger.info('创建监控窗口成功');
  } catch (error) {
    logger.error('创建监控窗口失败', error);
  }
});

// 设置定时任务
async function setupAlarm() {
  try {
    // 获取用户设置的刷新间隔
    const result = await chrome.storage.local.get(['refreshInterval']);
    const refreshInterval = result.refreshInterval || 60; // 默认60秒
    
    // 清除现有的alarm
    await chrome.alarms.clear('refreshData');
    
    // 创建新的alarm，按照用户设置的时间间隔执行
    chrome.alarms.create('refreshData', {
      periodInMinutes: Math.max(1, Math.round(refreshInterval / 60)) // 转换为分钟，最小1分钟
    });
    
    logger.info(`定时任务已设置，间隔为 ${refreshInterval} 秒`);
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
    const config = await chrome.storage.local.get(['symbols', 'notifications', 'useRealData']);
    const symbols = config.symbols || ['IF', 'IC', 'IH'];
    const useRealData = config.useRealData || false; // 是否使用真实API数据
    
    logger.debug(`获取到的股指期货符号: ${symbols.join(', ')}, 使用真实数据: ${useRealData}`);
    
    let currentData;
    
    // 如果启用了真实数据，则通过API获取
    if (useRealData) {
      try {
        currentData = await dataService.fetchOptionData(symbols, true);
        logger.info('已成功获取真实API数据');
      } catch (apiError) {
        logger.error('获取真实API数据失败，将使用模拟数据', apiError);
        // 失败后回退到模拟数据
        currentData = await generateMockData(symbols);
      }
    } else {
      // 使用模拟数据
      currentData = await generateMockData(symbols);
    }
    
    // 验证数据
    const validData = currentData.filter(item => {
      return item.symbol && typeof item.impliedVolatility === 'number';
    });
    
    if (validData.length === 0) {
      throw new Error('没有有效数据');
    }
    
    // 获取上次数据
    const previousData = await chrome.storage.local.get(['lastData']);
    const lastData = previousData.lastData || [];
    
    // 计算变化值并添加到数据中
    const dataWithChanges = validData.map(item => {
      const prevItem = lastData.find(prev => prev && prev.symbol === item.symbol);
      
      // 如果找到了之前的数据，计算变化值，否则生成一个小的随机变化
      let change = 0;
      
      if (prevItem) {
        change = item.impliedVolatility - prevItem.impliedVolatility;
      } else {
        // 生成一个小的随机变化，范围在0.01%到0.20%之间
        change = (Math.random() * 0.19 + 0.01) * (Math.random() > 0.5 ? 1 : -1);
      }
      
      return {
        ...item,
        change: change
      };
    });
    
    // 检查是否需要发送通知
    if (config.notifications?.enabled) {
      checkAndNotify(dataWithChanges, lastData, config.notifications.threshold);
    }
    
    // 保存当前数据
    await chrome.storage.local.set({ lastData: dataWithChanges });
    
    // 广播数据更新消息
    chrome.runtime.sendMessage({
      type: 'DATA_UPDATED',
      data: dataWithChanges
    });
    
    logger.info('数据刷新完成');
  } catch (error) {
    logger.error('刷新数据失败', error);
  }
}

// 生成模拟数据
async function generateMockData(symbols) {
  try {
    // 获取上次数据用于计算微小变化
    const previousData = await chrome.storage.local.get(['lastData']);
    const lastData = previousData.lastData || [];
    
    const mockData = [];
    
    const generateIV = (symbol) => {
      // 查找上次数据
      const prevItem = lastData.find(item => item && item.symbol === symbol);
      
      if (prevItem) {
        // 在上次数据基础上增加随机小波动 (-0.2 到 +0.2)
        const randomChange = (Math.random() * 0.4 - 0.2);
        return Math.max(0.1, prevItem.impliedVolatility + randomChange);
      } else {
        // 首次生成IV数据
        return symbol.includes('F') ? 4.4 : 3.6; 
      }
    };
    
    const generatePrice = (symbol) => {
      // 查找上次数据
      const prevItem = lastData.find(item => item && item.symbol === symbol);
      
      if (prevItem && prevItem.price) {
        // 在上次价格基础上增加随机小波动 (-2 到 +2)
        const randomChange = (Math.random() * 4 - 2);
        return Math.max(3800, prevItem.price + randomChange);
      } else {
        // 首次生成价格数据，接近3900
        return 3900 + (Math.random() * 30 - 15);
      }
    };
    
    // 为每个符号生成模拟数据
    for (const symbol of symbols) {
      mockData.push({
        symbol,
        impliedVolatility: generateIV(symbol),
        price: generatePrice(symbol),
        updateTime: new Date().toLocaleTimeString()
      });
    }
    
    logger.debug(`生成的模拟数据: ${JSON.stringify(mockData)}`);
    return mockData;
  } catch (error) {
    logger.error('生成模拟数据失败', error);
    throw error;
  }
}

// 检查并发送通知
function checkAndNotify(currentData, previousData, threshold) {
  try {
    currentData.forEach(item => {
      if (!previousData || !Array.isArray(previousData)) return;
      
      const previousItem = previousData.find(prev => prev && prev.symbol === item.symbol);
      if (previousItem) {
        const change = ((item.impliedVolatility - previousItem.impliedVolatility) / previousItem.impliedVolatility) * 100;
        if (Math.abs(change) >= threshold) {
          sendNotification(item, change);
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

// 处理配置更新
async function handleUpdateConfig(config) {
  try {
    // 保存配置到本地存储
    await chrome.storage.local.set(config);
    
    // 根据新配置更新定时任务
    await setupAlarm();
    
    // 立即刷新数据以应用新配置
    await refreshData();
    
    logger.info('配置已更新并应用');
    return { success: true };
  } catch (error) {
    logger.error('更新配置失败', error);
    return { success: false, error: error.message };
  }
}

// 监听来自content script和popup页面的消息
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
    handleUpdateConfig(request.config).then(response => {
      sendResponse(response);
    }).catch(error => {
      logger.error('处理UPDATE_CONFIG请求失败', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  // 处理关闭窗口请求
  if (request.type === 'CLOSE_WINDOW') {
    if (monitorWindowId !== null) {
      try {
        chrome.windows.remove(monitorWindowId);
        monitorWindowId = null;
        logger.info('窗口已关闭');
      } catch (error) {
        logger.error('关闭窗口失败', error);
      }
    }
    return true;
  }
}); 
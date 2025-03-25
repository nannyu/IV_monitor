import { logger } from './services/logger.js';

// 默认配置
const defaultConfig = {
  symbols: ['IF', 'IC', 'IH'],
  refreshInterval: 60,
  notifications: {
    enabled: true,
    threshold: 5
  }
};

// 初始化页面
async function initPage() {
  try {
    // 获取当前配置
    const result = await chrome.storage.local.get(['symbols', 'refreshInterval', 'notifications']);
    const config = { ...defaultConfig, ...result };
    
    // 更新UI
    updateUI(config);
    
    // 设置事件监听器
    setupEventListeners();
    
    logger.info('配置页面初始化完成');
  } catch (error) {
    logger.error('配置页面初始化失败', error);
    showStatus('初始化失败，请刷新页面重试', 'error');
  }
}

// 更新UI
function updateUI(config) {
  // 更新品种列表
  const symbolsList = document.getElementById('symbols-list');
  symbolsList.innerHTML = '';
  config.symbols.forEach(symbol => {
    const item = createSymbolItem(symbol);
    symbolsList.appendChild(item);
  });
  
  // 更新刷新间隔
  document.getElementById('refresh-interval').value = config.refreshInterval;
  
  // 更新通知设置
  document.getElementById('notifications-enabled').checked = config.notifications.enabled;
  document.getElementById('volatility-threshold').value = config.notifications.threshold;
}

// 创建品种项
function createSymbolItem(symbol) {
  const item = document.createElement('div');
  item.className = 'symbol-item';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = symbol;
  input.readOnly = true;
  
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '删除';
  removeBtn.onclick = () => removeSymbol(symbol);
  
  item.appendChild(input);
  item.appendChild(removeBtn);
  
  return item;
}

// 设置事件监听器
function setupEventListeners() {
  // 添加品种
  document.getElementById('add-symbol').addEventListener('click', addSymbol);
  
  // 保存设置
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // 重置设置
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
}

// 添加品种
function addSymbol() {
  const input = document.getElementById('symbol-input');
  const symbol = input.value.trim().toUpperCase();
  
  if (!symbol) {
    showStatus('请输入品种代码', 'error');
    return;
  }
  
  const symbolsList = document.getElementById('symbols-list');
  const item = createSymbolItem(symbol);
  symbolsList.appendChild(item);
  
  input.value = '';
  showStatus('品种添加成功', 'success');
}

// 删除品种
function removeSymbol(symbol) {
  const symbolsList = document.getElementById('symbols-list');
  const items = symbolsList.getElementsByClassName('symbol-item');
  
  for (let item of items) {
    const input = item.querySelector('input');
    if (input.value === symbol) {
      item.remove();
      showStatus('品种删除成功', 'success');
      break;
    }
  }
}

// 保存设置
async function saveSettings() {
  try {
    // 获取品种列表
    const symbols = Array.from(document.getElementById('symbols-list').getElementsByTagName('input'))
      .map(input => input.value.trim().toUpperCase());
    
    if (symbols.length === 0) {
      showStatus('请至少添加一个品种', 'error');
      return;
    }
    
    // 获取其他设置
    const refreshInterval = parseInt(document.getElementById('refresh-interval').value);
    const notificationsEnabled = document.getElementById('notifications-enabled').checked;
    const volatilityThreshold = parseFloat(document.getElementById('volatility-threshold').value);
    
    // 保存配置
    await chrome.storage.local.set({
      symbols,
      refreshInterval,
      notifications: {
        enabled: notificationsEnabled,
        threshold: volatilityThreshold
      }
    });
    
    // 通知background script更新配置
    await chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      config: {
        symbols,
        refreshInterval,
        notifications: {
          enabled: notificationsEnabled,
          threshold: volatilityThreshold
        }
      }
    });
    
    showStatus('设置保存成功', 'success');
  } catch (error) {
    logger.error('保存设置失败', error);
    showStatus('保存设置失败，请重试', 'error');
  }
}

// 重置设置
async function resetSettings() {
  try {
    await chrome.storage.local.set(defaultConfig);
    updateUI(defaultConfig);
    showStatus('设置已重置为默认值', 'success');
  } catch (error) {
    logger.error('重置设置失败', error);
    showStatus('重置设置失败，请重试', 'error');
  }
}

// 显示状态信息
function showStatus(message, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  // 3秒后自动清除
  setTimeout(() => {
    status.textContent = '';
    status.className = 'status';
  }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage); 
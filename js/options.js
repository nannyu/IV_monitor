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

// 预设股指期货代码
const predefinedSymbols = ['IF', 'IC', 'IH', 'IM'];

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
  // 更新预设品种选择
  updatePredefinedSymbols(config.symbols);
  
  // 更新自定义品种列表
  updateCustomSymbols(config.symbols);
  
  // 更新刷新间隔
  document.getElementById('refresh-interval').value = config.refreshInterval;
  
  // 更新通知设置
  document.getElementById('notifications-enabled').checked = config.notifications.enabled;
  document.getElementById('volatility-threshold').value = config.notifications.threshold;
}

// 更新预设品种选择
function updatePredefinedSymbols(selectedSymbols) {
  predefinedSymbols.forEach(symbol => {
    const checkbox = document.getElementById(`symbol-${symbol}`);
    if (checkbox) {
      checkbox.checked = selectedSymbols.includes(symbol);
    }
  });
}

// 更新自定义品种列表
function updateCustomSymbols(selectedSymbols) {
  const customSymbols = selectedSymbols.filter(symbol => !predefinedSymbols.includes(symbol));
  
  const symbolsList = document.getElementById('symbols-list');
  symbolsList.innerHTML = '';
  
  customSymbols.forEach(symbol => {
    const item = createSymbolItem(symbol);
    symbolsList.appendChild(item);
  });
}

// 创建自定义品种项
function createSymbolItem(symbol) {
  const item = document.createElement('div');
  item.className = 'symbol-item';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = symbol;
  input.readOnly = true;
  
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '删除';
  removeBtn.className = 'secondary';
  removeBtn.onclick = () => removeSymbol(symbol);
  
  item.appendChild(input);
  item.appendChild(removeBtn);
  
  return item;
}

// 设置事件监听器
function setupEventListeners() {
  // 添加自定义品种
  document.getElementById('add-symbol').addEventListener('click', addCustomSymbol);
  
  // 保存设置
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // 重置设置
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
  
  // 为预设品种复选框添加事件监听
  predefinedSymbols.forEach(symbol => {
    const checkbox = document.getElementById(`symbol-${symbol}`);
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        // 如果取消选中，检查是否还有其他选中的品种
        if (!checkbox.checked) {
          const checkedCount = predefinedSymbols.filter(s => {
            const cb = document.getElementById(`symbol-${s}`);
            return cb && cb.checked;
          }).length;
          
          const customCount = document.getElementById('symbols-list').children.length;
          
          if (checkedCount === 0 && customCount === 0) {
            showStatus('至少需要选择一个监控品种', 'error');
            checkbox.checked = true;
          }
        }
      });
    }
  });
}

// 添加自定义品种
function addCustomSymbol() {
  const input = document.getElementById('symbol-input');
  const symbol = input.value.trim().toUpperCase();
  
  if (!symbol) {
    showStatus('请输入品种代码', 'error');
    return;
  }
  
  // 检查是否已经存在于预设品种中
  if (predefinedSymbols.includes(symbol)) {
    const checkbox = document.getElementById(`symbol-${symbol}`);
    if (checkbox && !checkbox.checked) {
      checkbox.checked = true;
      showStatus(`已选中预设品种: ${symbol}`, 'info');
    } else {
      showStatus(`品种 ${symbol} 已存在`, 'error');
    }
    input.value = '';
    return;
  }
  
  // 检查是否已经存在于自定义品种中
  const existingItems = Array.from(document.getElementById('symbols-list').getElementsByTagName('input'));
  const exists = existingItems.some(item => item.value === symbol);
  
  if (exists) {
    showStatus(`品种 ${symbol} 已存在`, 'error');
    input.value = '';
    return;
  }
  
  const symbolsList = document.getElementById('symbols-list');
  const item = createSymbolItem(symbol);
  symbolsList.appendChild(item);
  
  input.value = '';
  showStatus('品种添加成功', 'success');
}

// 删除自定义品种
function removeSymbol(symbol) {
  const symbolsList = document.getElementById('symbols-list');
  const items = symbolsList.getElementsByClassName('symbol-item');
  
  // 删除前检查是否至少还有一个选中的品种
  const checkedCount = predefinedSymbols.filter(s => {
    const cb = document.getElementById(`symbol-${s}`);
    return cb && cb.checked;
  }).length;
  
  const customCount = items.length;
  
  if (checkedCount === 0 && customCount <= 1) {
    showStatus('至少需要选择一个监控品种', 'error');
    return;
  }
  
  for (let i = 0; i < items.length; i++) {
    const input = items[i].querySelector('input');
    if (input.value === symbol) {
      items[i].remove();
      showStatus('品种删除成功', 'success');
      break;
    }
  }
}

// 保存设置
async function saveSettings() {
  try {
    // 获取所有选中的预设品种
    const selectedPredefinedSymbols = predefinedSymbols.filter(symbol => {
      const checkbox = document.getElementById(`symbol-${symbol}`);
      return checkbox && checkbox.checked;
    });
    
    // 获取所有自定义品种
    const customSymbols = Array.from(document.getElementById('symbols-list').getElementsByTagName('input'))
      .map(input => input.value.trim().toUpperCase());
    
    // 合并所有选中的品种
    const symbols = [...selectedPredefinedSymbols, ...customSymbols];
    
    if (symbols.length === 0) {
      showStatus('请至少选择一个品种', 'error');
      return;
    }
    
    // 获取其他设置
    const refreshInterval = parseInt(document.getElementById('refresh-interval').value);
    const notificationsEnabled = document.getElementById('notifications-enabled').checked;
    const volatilityThreshold = parseFloat(document.getElementById('volatility-threshold').value);
    
    // 验证刷新频率
    if (refreshInterval < 5 || refreshInterval > 3600) {
      showStatus('刷新频率必须在5-3600秒之间', 'error');
      return;
    }
    
    // 验证通知阈值
    if (volatilityThreshold <= 0 || volatilityThreshold > 100) {
      showStatus('通知阈值必须在0.1-100%之间', 'error');
      return;
    }
    
    // 保存配置
    const config = {
      symbols,
      refreshInterval,
      notifications: {
        enabled: notificationsEnabled,
        threshold: volatilityThreshold
      }
    };
    
    await chrome.storage.local.set(config);
    
    // 通知background script更新配置
    await chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      config
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
    
    // 通知background script更新配置
    await chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      config: defaultConfig
    });
    
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
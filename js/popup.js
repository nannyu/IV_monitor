document.addEventListener('DOMContentLoaded', async () => {
  // 初始化时从storage获取配置
  const config = await chrome.storage.local.get(['symbols', 'refreshInterval']);
  
  // 如果没有配置，设置默认值
  if (!config.symbols) {
    await chrome.storage.local.set({
      symbols: ['IF', 'IC', 'IH'],
      refreshInterval: 60 // 默认60秒刷新一次
    });
  }

  // 获取iv-monitor组件实例
  const ivMonitor = document.querySelector('iv-monitor');
  
  // 设置定时刷新
  chrome.alarms.create('refreshData', {
    periodInMinutes: config.refreshInterval / 60
  });

  // 监听alarm事件
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshData') {
      ivMonitor.refreshData();
    }
  });
}); 
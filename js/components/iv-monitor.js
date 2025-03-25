import { logger } from '../services/logger.js';

class IVMonitor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.data = [];
    this.config = {
      symbols: ['IF', 'IC', 'IH'],
      refreshInterval: 60
    };
  }

  connectedCallback() {
    this.init();
    this.setupStyles();
    this.setupEventListeners();
    this.startDataRefresh();
  }

  disconnectedCallback() {
    this.stopDataRefresh();
  }

  // 初始化组件
  async init() {
    try {
      // 获取配置
      const result = await chrome.storage.local.get(['symbols', 'refreshInterval']);
      this.config = { ...this.config, ...result };
      
      // 初始加载数据
      await this.loadData();
      
      logger.info('IV监控组件初始化完成');
    } catch (error) {
      logger.error('IV监控组件初始化失败', error);
    }
  }

  // 设置样式
  setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      }

      .container {
        padding: 16px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .refresh-button {
        padding: 6px 12px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .refresh-button:hover {
        background: #1976D2;
      }

      .data-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }

      .data-card {
        background: #f5f5f5;
        border-radius: 6px;
        padding: 12px;
      }

      .symbol {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
      }

      .iv-value {
        font-size: 24px;
        font-weight: 700;
        color: #2196F3;
        margin-bottom: 4px;
      }

      .iv-change {
        font-size: 14px;
        color: #666;
      }

      .iv-change.positive {
        color: #4CAF50;
      }

      .iv-change.negative {
        color: #F44336;
      }

      .timestamp {
        font-size: 12px;
        color: #999;
        margin-top: 8px;
      }

      .loading {
        text-align: center;
        padding: 24px;
        color: #666;
      }

      .error {
        color: #F44336;
        padding: 16px;
        text-align: center;
        background: #FFEBEE;
        border-radius: 4px;
        margin-top: 16px;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  // 设置事件监听器
  setupEventListeners() {
    // 监听数据更新消息
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'DATA_UPDATED') {
        this.updateData(message.data);
      }
    });

    // 刷新按钮点击事件
    const refreshButton = this.shadowRoot.querySelector('.refresh-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.loadData());
    }
  }

  // 开始定时刷新
  startDataRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadData();
    }, this.config.refreshInterval * 1000);
  }

  // 停止定时刷新
  stopDataRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // 加载数据
  async loadData() {
    try {
      this.showLoading();
      
      // 发送消息给background script获取数据
      const response = await chrome.runtime.sendMessage({ type: 'GET_IV_DATA' });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      logger.debug('数据加载成功');
    } catch (error) {
      logger.error('加载数据失败', error);
      this.showError('加载数据失败，请稍后重试');
    }
  }

  // 更新数据
  updateData(data) {
    try {
      this.data = data;
      this.render();
      logger.debug('数据更新完成');
    } catch (error) {
      logger.error('更新数据失败', error);
      this.showError('更新数据失败');
    }
  }

  // 渲染组件
  render() {
    const container = document.createElement('div');
    container.className = 'container';

    // 添加头部
    const header = document.createElement('div');
    header.className = 'header';
    
    const title = document.createElement('h2');
    title.className = 'title';
    title.textContent = '隐含波动率监控';
    
    const refreshButton = document.createElement('button');
    refreshButton.className = 'refresh-button';
    refreshButton.textContent = '刷新';
    
    header.appendChild(title);
    header.appendChild(refreshButton);
    container.appendChild(header);

    // 添加数据网格
    const grid = document.createElement('div');
    grid.className = 'data-grid';

    this.data.forEach(item => {
      const card = this.createDataCard(item);
      grid.appendChild(card);
    });

    container.appendChild(grid);
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(container);
  }

  // 创建数据卡片
  createDataCard(item) {
    const card = document.createElement('div');
    card.className = 'data-card';

    const symbol = document.createElement('div');
    symbol.className = 'symbol';
    symbol.textContent = item.symbol;

    const ivValue = document.createElement('div');
    ivValue.className = 'iv-value';
    ivValue.textContent = `${item.impliedVolatility.toFixed(2)}%`;

    const ivChange = document.createElement('div');
    ivChange.className = 'iv-change';
    const change = ((item.impliedVolatility - (this.previousData?.[item.symbol]?.impliedVolatility || item.impliedVolatility)) / item.impliedVolatility) * 100;
    ivChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    ivChange.classList.add(change >= 0 ? 'positive' : 'negative');

    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = `更新时间: ${item.updateTime}`;

    card.appendChild(symbol);
    card.appendChild(ivValue);
    card.appendChild(ivChange);
    card.appendChild(timestamp);

    return card;
  }

  // 显示加载状态
  showLoading() {
    const container = document.createElement('div');
    container.className = 'container';
    
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = '加载中...';
    
    container.appendChild(loading);
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(container);
  }

  // 显示错误信息
  showError(message) {
    const container = document.createElement('div');
    container.className = 'container';
    
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    
    container.appendChild(error);
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(container);
  }
}

// 注册Web Component
customElements.define('iv-monitor', IVMonitor); 
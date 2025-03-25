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
    this.lastUpdateTime = new Date();
    this.currentPage = 0;
    this.autoPageFlip = true;
    this.pageFlipInterval = null;
  }

  connectedCallback() {
    this.init();
    this.setupStyles();
    this.setupEventListeners();
    this.startDataRefresh();
    this.startPageFlip();
  }

  disconnectedCallback() {
    this.stopDataRefresh();
    this.stopPageFlip();
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
        width: 320px;
        height: 38px;
        overflow: hidden;
        box-sizing: border-box;
      }

      .container {
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.7);
        padding: 0 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
      }
      
      .data-row {
        display: flex;
        align-items: center;
        width: 100%;
        justify-content: space-between;
        animation: slideIn 0.5s ease;
        padding: 0 10px;
        box-sizing: border-box;
      }

      .data-item {
        display: flex;
        align-items: center;
        white-space: nowrap;
        flex: 1;
        justify-content: center;
        box-sizing: border-box;
      }

      .symbol {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-right: 3px;
      }

      .iv-value {
        font-size: 13px;
        font-weight: 600;
        color: #2196F3;
      }

      .iv-change {
        font-size: 12px;
        margin-left: 3px;
        min-width: 45px;
        text-align: right;
      }

      .iv-change.positive {
        color: #4CAF50;
      }

      .iv-change.negative {
        color: #F44336;
      }

      .timestamp {
        font-size: 9px;
        color: #999;
        position: absolute;
        top: 2px;
        right: 6px;
      }

      .page-indicator {
        position: absolute;
        bottom: 2px;
        right: 6px;
        display: flex;
        gap: 2px;
      }

      .page-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background-color: #ccc;
      }

      .page-dot.active {
        background-color: #666;
      }

      .controls {
        position: absolute;
        bottom: 2px;
        left: 6px;
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .container:hover .controls {
        opacity: 1;
      }

      .control-button {
        width: 12px;
        height: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        cursor: pointer;
        color: #666;
        user-select: none;
      }

      .control-button:hover {
        color: #333;
      }

      .loading {
        width: 100%;
        text-align: center;
        color: #666;
        font-size: 11px;
      }

      .error {
        color: #F44336;
        text-align: center;
        font-size: 10px;
        width: 100%;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(5px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
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
        this.lastUpdateTime = new Date();
      }
    });

    // 添加鼠标悬停暂停翻页
    this.addEventListener('mouseenter', () => {
      this.stopPageFlip();
    });

    this.addEventListener('mouseleave', () => {
      if (this.autoPageFlip) {
        this.startPageFlip();
      }
    });
  }

  // 开始自动翻页
  startPageFlip() {
    if (this.data.length <= 3) return; // 数据少于等于3条时不需要翻页
    
    this.stopPageFlip(); // 先清除可能存在的定时器
    this.pageFlipInterval = setInterval(() => {
      this.nextPage();
    }, 3000); // 每3秒翻页一次
  }

  // 停止自动翻页
  stopPageFlip() {
    if (this.pageFlipInterval) {
      clearInterval(this.pageFlipInterval);
      this.pageFlipInterval = null;
    }
  }

  // 切换到下一页
  nextPage() {
    if (this.data.length <= 3) return; // 数据少于等于3条时不需要翻页
    
    const totalPages = Math.ceil(this.data.length / 3);
    this.currentPage = (this.currentPage + 1) % totalPages;
    this.render();
  }

  // 切换到上一页
  prevPage() {
    if (this.data.length <= 3) return; // 数据少于等于3条时不需要翻页
    
    const totalPages = Math.ceil(this.data.length / 3);
    this.currentPage = (this.currentPage - 1 + totalPages) % totalPages;
    this.render();
  }

  // 切换自动翻页状态
  toggleAutoFlip() {
    this.autoPageFlip = !this.autoPageFlip;
    if (this.autoPageFlip) {
      this.startPageFlip();
    } else {
      this.stopPageFlip();
    }
    this.render();
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
      
      this.lastUpdateTime = new Date();
      logger.debug('数据加载成功');
    } catch (error) {
      logger.error('加载数据失败', error);
      this.showError('加载失败');
    }
  }

  // 更新数据
  updateData(data) {
    try {
      this.data = data;
      // 如果当前页超出范围，重置为第一页
      const totalPages = Math.ceil(this.data.length / 3);
      if (this.currentPage >= totalPages) {
        this.currentPage = 0;
      }
      this.render();
      logger.debug('数据更新完成');
    } catch (error) {
      logger.error('更新数据失败', error);
      this.showError('更新失败');
    }
  }

  // 渲染组件
  render() {
    const container = document.createElement('div');
    container.className = 'container';
    
    // 添加时间戳
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = this.formatTimestamp(this.lastUpdateTime);
    container.appendChild(timestamp);

    // 添加数据展示
    const dataRow = document.createElement('div');
    dataRow.className = 'data-row';

    // 计算当前页显示的数据
    const startIndex = this.currentPage * 3;
    const endIndex = Math.min(startIndex + 3, this.data.length);
    const displayData = this.data.slice(startIndex, endIndex);
    
    // 如果数据不足3条，补充空白项
    while (displayData.length < 3) {
      displayData.push(null);
    }
    
    displayData.forEach(item => {
      const dataItem = this.createCompactDataItem(item);
      dataRow.appendChild(dataItem);
    });

    container.appendChild(dataRow);

    // 添加页面指示器
    if (this.data.length > 3) {
      const pageIndicator = document.createElement('div');
      pageIndicator.className = 'page-indicator';
      
      const totalPages = Math.ceil(this.data.length / 3);
      for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('div');
        dot.className = `page-dot ${i === this.currentPage ? 'active' : ''}`;
        pageIndicator.appendChild(dot);
      }
      
      container.appendChild(pageIndicator);

      // 添加控制按钮
      const controls = document.createElement('div');
      controls.className = 'controls';
      
      const prevButton = document.createElement('div');
      prevButton.className = 'control-button';
      prevButton.textContent = '◀';
      prevButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevPage();
      });
      
      const autoFlipButton = document.createElement('div');
      autoFlipButton.className = 'control-button';
      autoFlipButton.textContent = this.autoPageFlip ? '⏸' : '▶';
      autoFlipButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleAutoFlip();
      });
      
      const nextButton = document.createElement('div');
      nextButton.className = 'control-button';
      nextButton.textContent = '▶';
      nextButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextPage();
      });
      
      controls.appendChild(prevButton);
      controls.appendChild(autoFlipButton);
      controls.appendChild(nextButton);
      
      container.appendChild(controls);
    }

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(container);
  }

  // 创建紧凑型数据项
  createCompactDataItem(item) {
    const dataItem = document.createElement('div');
    dataItem.className = 'data-item';

    if (!item) return dataItem; // 返回空白项
    
    const symbol = document.createElement('span');
    symbol.className = 'symbol';
    symbol.textContent = `${item.symbol}：`;

    const ivValue = document.createElement('span');
    ivValue.className = 'iv-value';
    ivValue.textContent = `${item.impliedVolatility.toFixed(2)}%`;

    const ivChange = document.createElement('span');
    const changeValue = parseFloat(item.change || 0);
    ivChange.className = `iv-change ${changeValue >= 0 ? 'positive' : 'negative'}`;
    ivChange.textContent = `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(2)}`;

    dataItem.appendChild(symbol);
    dataItem.appendChild(ivValue);
    dataItem.appendChild(ivChange);

    return dataItem;
  }

  // 格式化时间戳，精确到毫秒
  formatTimestamp(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
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
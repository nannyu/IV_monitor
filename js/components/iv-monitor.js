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
        width: 100%;
        height: 100%;
        overflow: hidden;
        box-sizing: border-box;
      }

      .container {
        width: 100%;
        height: 100%;
        background: white;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
      }
      
      .data-row {
        display: flex;
        align-items: center;
        width: 100%;
        border-bottom: 1px solid #f0f0f0;
        height: 42px;
        padding: 0;
        box-sizing: border-box;
        animation: fadeIn 0.3s ease;
      }

      .data-item {
        display: flex;
        align-items: center;
        padding: 0 8px;
        height: 100%;
        box-sizing: border-box;
      }

      .symbol-container {
        display: flex;
        align-items: center;
        min-width: 100px;
      }

      .circle {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #2457a0;
        color: white;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
      }

      .china-flag {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #de2910;
        color: white;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
        position: relative;
      }
      
      .china-flag::before {
        content: '🇨🇳';
        font-size: 14px;
      }

      .symbol {
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }

      .symbol-badge {
        font-size: 10px;
        color: #666;
        margin-left: 2px;
        font-weight: normal;
        vertical-align: super;
      }

      .price-container {
        min-width: 100px;
        font-size: 16px;
        font-weight: 500;
      }
      
      .price {
        color: #e74c3c;
      }
      
      .iv-container {
        min-width: 50px;
        text-align: right;
        margin-left: auto;
      }

      .iv-value {
        font-size: 16px;
        font-weight: 500;
        color: #27ae60;
      }

      .change-container {
        min-width: 80px;
        text-align: right;
      }

      .iv-change {
        font-size: 16px;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .iv-change.positive {
        color: #27ae60;
      }

      .iv-change.negative {
        color: #e74c3c;
      }

      .controls {
        position: absolute;
        bottom: 2px;
        right: 6px;
        display: flex;
        gap: 4px;
        opacity: 0.5;
        transition: opacity 0.3s ease;
      }

      .container:hover .controls {
        opacity: 1;
      }

      .control-button {
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        cursor: pointer;
        color: #666;
        user-select: none;
        background: rgba(240, 240, 240, 0.7);
        border-radius: 3px;
      }

      .control-button:hover {
        color: #333;
        background: rgba(220, 220, 220, 0.9);
      }

      .loading {
        width: 100%;
        text-align: center;
        color: #666;
        font-size: 14px;
        padding: 10px;
      }

      .error {
        color: #e74c3c;
        text-align: center;
        font-size: 12px;
        width: 100%;
        padding: 10px;
      }

      .delete-button {
        opacity: 0;
        transition: opacity 0.2s;
        cursor: pointer;
        color: #999;
        margin-left: 10px;
      }
      
      .data-row:hover .delete-button {
        opacity: 1;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
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
    // 清空内容
    this.shadowRoot.innerHTML = '';
    this.setupStyles();
    
    // 创建容器
    const container = document.createElement('div');
    container.className = 'container';
    
    if (this.data.length === 0) {
      // 显示加载中状态
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = '加载数据中...';
      container.appendChild(loading);
    } else {
      // 根据当前页码显示数据
      const itemsPerPage = 4; // 每页显示4条数据
      const startIndex = this.currentPage * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, this.data.length);
      const currentPageData = this.data.slice(startIndex, endIndex);
      
      // 渲染当前页的数据
      currentPageData.forEach(item => {
        const row = document.createElement('div');
        row.className = 'data-row';
        
        // 添加代码部分
        const symbolContainer = document.createElement('div');
        symbolContainer.className = 'data-item symbol-container';
        
        // 创建圆形标记
        const circle = document.createElement('div');
        if (item.symbol.includes('K')) {
          circle.className = 'china-flag';
        } else {
          circle.className = 'circle';
          circle.textContent = '300';
        }
        symbolContainer.appendChild(circle);
        
        // 创建代码文本
        const symbolText = document.createElement('div');
        symbolText.className = 'symbol';
        
        // 提取代码并添加上标
        const symbolName = item.symbol;
        symbolText.innerHTML = `${symbolName} <sup class="symbol-badge">D</sup>`;
        
        symbolContainer.appendChild(symbolText);
        row.appendChild(symbolContainer);
        
        // 添加价格部分
        const priceContainer = document.createElement('div');
        priceContainer.className = 'data-item price-container';
        
        const price = document.createElement('span');
        price.className = 'price';
        
        // 生成一个接近3900的随机价格
        const mockPrice = (3900 + (Math.random() * 30 - 15)).toFixed(1);
        price.textContent = mockPrice;
        
        priceContainer.appendChild(price);
        row.appendChild(priceContainer);
        
        // 添加IV值部分
        const ivContainer = document.createElement('div');
        ivContainer.className = 'data-item iv-container';
        
        const ivValue = document.createElement('span');
        ivValue.className = 'iv-value';
        ivValue.textContent = item.impliedVolatility ? item.impliedVolatility.toFixed(1) : '0.0';
        
        ivContainer.appendChild(ivValue);
        row.appendChild(ivContainer);
        
        // 添加变化百分比部分
        const changeContainer = document.createElement('div');
        changeContainer.className = 'data-item change-container';
        
        const ivChange = document.createElement('span');
        const changeValue = item.change || 0;
        const changePercent = ((changeValue / (item.impliedVolatility - changeValue)) * 100) || 0;
        
        ivChange.textContent = `${Math.abs(changePercent).toFixed(2)}%`;
        ivChange.className = 'iv-change ' + (changePercent >= 0 ? 'positive' : 'negative');
        
        changeContainer.appendChild(ivChange);
        
        // 添加删除按钮
        const deleteButton = document.createElement('span');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '&#10005;';
        deleteButton.title = '移除';
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeItem(item.symbol);
        });
        
        changeContainer.appendChild(deleteButton);
        row.appendChild(changeContainer);
        
        container.appendChild(row);
      });
      
      // 添加页面指示器和控制按钮
      if (this.data.length > itemsPerPage) {
        const controls = document.createElement('div');
        controls.className = 'controls';
        
        // 上一页按钮
        const prevButton = document.createElement('div');
        prevButton.className = 'control-button';
        prevButton.textContent = '←';
        prevButton.addEventListener('click', () => this.prevPage());
        controls.appendChild(prevButton);
        
        // 下一页按钮
        const nextButton = document.createElement('div');
        nextButton.className = 'control-button';
        nextButton.textContent = '→';
        nextButton.addEventListener('click', () => this.nextPage());
        controls.appendChild(nextButton);
        
        container.appendChild(controls);
      }
    }
    
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
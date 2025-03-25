import { logger } from '../services/logger.js';

class IVMonitor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.data = [];
    this.config = {
      symbols: ['IF', 'IC', 'IH'],
      refreshInterval: 60,
      transparency: 85 // 默认透明度
    };
    this.lastUpdateTime = new Date();
    this.currentPage = 0;
    this.autoPageFlip = true;
    this.pageFlipInterval = null;
    this.status = 'loaded';
    this.errorMessage = '';
  }

  async connectedCallback() {
    try {
      // 获取配置，包括透明度设置
      const result = await chrome.storage.local.get(['symbols', 'refreshInterval', 'transparency']);
      this.config = { ...this.config, ...result };
      
      // 初始化组件
      await this.init();
      
      // 应用透明度设置
      if (this.config.transparency) {
        this.applyTransparency(this.config.transparency);
      }
      
      // 监听透明度设置变化
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.transparency) {
          this.applyTransparency(changes.transparency.newValue);
        }
      });
    } catch (error) {
      logger.error('组件初始化失败', error);
    }
  }

  disconnectedCallback() {
    this.stopDataRefresh();
    this.stopPageFlip();
  }

  // 初始化组件
  async init() {
    try {
      // 初始加载数据
      await this.refreshData();
      
      // 设置样式和事件
      this.setupStyles();
      this.setupEventListeners();
      this.startDataRefresh();
      this.startPageFlip();
      
      logger.info('IV监控组件初始化完成');
    } catch (error) {
      logger.error('IV监控组件初始化失败', error);
    }
  }
  
  // 应用透明度设置
  applyTransparency(transparency) {
    try {
      const opacity = transparency / 100;
      const container = this.shadowRoot.querySelector('.container');
      if (container) {
        container.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
        
        // 调整标题栏透明度
        const header = this.shadowRoot.querySelector('.header');
        if (header) {
          header.style.backgroundColor = `rgba(249, 249, 249, ${Math.min(opacity + 0.05, 1)})`;
        }
      }
    } catch (error) {
      logger.error('应用透明度失败', error);
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
        background: rgba(255, 255, 255, 0.85); /* 半透明背景 */
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
        border-bottom: 1px solid rgba(240, 240, 240, 0.7);
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
      
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background-color: rgba(249, 249, 249, 0.9);
        border-bottom: 1px solid rgba(234, 234, 234, 0.7);
      }
      
      .title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }
      
      .window-controls {
        display: flex;
        gap: 6px;
      }
      
      .close-button {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        cursor: pointer;
        color: #999;
        border-radius: 50%;
        transition: all 0.2s;
      }
      
      .close-button:hover {
        color: #e74c3c;
        background-color: rgba(231, 76, 60, 0.1);
      }
      
      .refresh-button {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
        color: #999;
        border-radius: 50%;
        transition: all 0.2s;
      }
      
      .refresh-button:hover {
        color: #2980b9;
        background-color: rgba(41, 128, 185, 0.1);
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
    // 清除可能存在的定时器
    this.stopDataRefresh();
    
    // 初始设置更新间隔
    const updateInterval = Math.max(5, Math.min(this.config.refreshInterval, 60)); // 范围5-60秒
    
    // 立即刷新一次
    this.refreshData();
    
    // 设置快速小刷新 (每1秒微调值)
    this.microRefreshInterval = setInterval(() => {
      this.microRefreshData();
    }, 1000);
    
    // 设置完整刷新 (根据配置间隔)
    this.refreshInterval = setInterval(() => {
      this.refreshData();
    }, updateInterval * 1000);
  }

  // 停止定时刷新
  stopDataRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    if (this.microRefreshInterval) {
      clearInterval(this.microRefreshInterval);
      this.microRefreshInterval = null;
    }
  }
  
  // 计算变化百分比
  calculateChangePercent(change, impliedVolatility) {
    if (!impliedVolatility || impliedVolatility === 0) return 0;
    try {
      // 使用安全的计算方法
      return ((change / (impliedVolatility - change)) * 100) || 0;
    } catch (e) {
      return 0;
    }
  }
  
  // 微刷新数据 - 只进行微小变动
  microRefreshData() {
    if (!this.data || this.data.length === 0) return;
    
    // 对每个数据项进行微小调整，不向服务器请求
    const updatedData = this.data.map(item => {
      // 生成±0.05之间的微小随机变动
      const microChange = (Math.random() * 0.1 - 0.05);
      const newIV = Math.max(0.1, item.impliedVolatility + microChange);
      
      // 价格微小变动±0.5
      const priceChange = (Math.random() * 1 - 0.5);
      const newPrice = Math.max(3800, (item.price || 3900) + priceChange);
      
      return {
        ...item,
        impliedVolatility: newIV,
        price: newPrice,
        change: microChange // 这个周期的微小变化
      };
    });
    
    // 更新数据并重新渲染
    this.data = updatedData;
    this.render();
    
    logger.debug('数据微刷新完成');
  }
  
  // 加载数据 - 完整刷新，从后台获取数据
  async refreshData() {
    try {
      this.status = 'loading';
      this.render();

      // 获取配置
      const result = await chrome.storage.local.get(['useRealData']);
      const useRealData = result.useRealData || false;

      // 请求数据更新
      chrome.runtime.sendMessage({ type: 'GET_IV_DATA' });

      // 从后台获取当前数据
      const storage = await chrome.storage.local.get(['lastData']);
      const data = storage.lastData || [];

      // 如果数据为空，显示错误
      if (!data || data.length === 0) {
        this.status = 'error';
        this.errorMessage = '未找到数据';
        this.render();
        logger.error('未找到期权数据');
        return;
      }

      // 更新数据
      this.data = data;
      this.status = 'loaded';
      this.lastUpdateTime = new Date();
      
      // 标记数据来源
      this.dataSource = useRealData ? '真实数据' : '模拟数据';

      // 渲染数据
      this.render();
      logger.info('数据刷新成功');
    } catch (error) {
      this.status = 'error';
      this.errorMessage = error.message;
      logger.error('刷新数据失败', error);
      this.render();
    }
  }
  
  // 移除项目
  removeItem(symbol) {
    // 从数据中移除指定符号的项
    this.data = this.data.filter(item => item.symbol !== symbol);
    // 重新渲染界面
    this.render();
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
    
    // 添加标题栏
    const header = document.createElement('div');
    header.className = 'header';
    
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = '期权隐含波动率监控';
    header.appendChild(title);
    
    const windowControls = document.createElement('div');
    windowControls.className = 'window-controls';
    
    const refreshButton = document.createElement('div');
    refreshButton.className = 'refresh-button';
    refreshButton.innerHTML = '&#x21bb;'; // 刷新图标
    refreshButton.title = '刷新数据';
    refreshButton.addEventListener('click', () => {
      this.loadData();
    });
    windowControls.appendChild(refreshButton);
    
    const settingsButton = document.createElement('div');
    settingsButton.className = 'refresh-button';
    settingsButton.innerHTML = '&#x2699;'; // 设置图标
    settingsButton.title = '设置';
    settingsButton.addEventListener('click', () => {
      // 打开设置页面
      chrome.runtime.openOptionsPage();
    });
    windowControls.appendChild(settingsButton);
    
    const closeButton = document.createElement('div');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;'; // 关闭图标
    closeButton.title = '关闭窗口';
    closeButton.addEventListener('click', () => {
      // 通知background.js关闭窗口
      chrome.runtime.sendMessage({ type: 'CLOSE_WINDOW' });
    });
    windowControls.appendChild(closeButton);
    
    header.appendChild(windowControls);
    container.appendChild(header);
    
    if (this.status === 'loading') {
      // 显示加载中状态
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = '加载数据中...';
      container.appendChild(loading);
    } else if (this.status === 'error') {
      // 显示错误信息
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = this.errorMessage || '加载失败';
      container.appendChild(error);
    } else {
      // 没有数据时显示提示信息
      if (!this.data || this.data.length === 0) {
        const noData = document.createElement('div');
        noData.className = 'no-data';
        noData.textContent = '暂无数据';
        container.appendChild(noData);
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
          price.textContent = item.price ? item.price.toFixed(1) : '0.0';
          
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
          const changePercent = this.calculateChangePercent(changeValue, item.impliedVolatility);
          
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
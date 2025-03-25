// 创建悬浮窗
function createFloatingWindow() {
  const floatingWindow = document.createElement('div');
  floatingWindow.id = 'iv-monitor-floating';
  floatingWindow.style.cssText = `
    position: fixed;
    right: 20px;
    top: 20px;
    width: 300px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
    display: flex;
    flex-direction: column;
  `;
  
  // 添加标题栏
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    padding: 8px 12px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  `;
  
  const title = document.createElement('span');
  title.textContent = '隐含波动率监控';
  title.style.fontWeight = '500';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    color: #666;
  `;
  
  titleBar.appendChild(title);
  titleBar.appendChild(closeBtn);
  
  // 添加内容区域
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 12px;
    overflow-y: auto;
    max-height: 400px;
  `;
  
  // 创建iframe
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup.html');
  iframe.style.cssText = `
    width: 100%;
    height: 400px;
    border: none;
    border-radius: 0 0 8px 8px;
  `;
  
  content.appendChild(iframe);
  floatingWindow.appendChild(titleBar);
  floatingWindow.appendChild(content);
  
  // 添加拖拽功能
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  titleBar.addEventListener('mousedown', dragStart);
  
  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target === titleBar || e.target === title) {
      isDragging = true;
    }
  }
  
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
  
  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      xOffset = currentX;
      yOffset = currentY;
      
      setTranslate(currentX, currentY, floatingWindow);
    }
  }
  
  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
  
  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
  
  // 添加关闭按钮功能
  closeBtn.addEventListener('click', () => {
    floatingWindow.style.display = 'none';
  });
  
  document.body.appendChild(floatingWindow);
  return floatingWindow;
}

// 初始化
function init() {
  const floatingWindow = createFloatingWindow();
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DATA_UPDATED') {
      // 通知iframe中的数据更新
      const iframe = floatingWindow.querySelector('iframe');
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'DATA_UPDATED',
          data: message.data
        }, '*');
      }
    }
  });
}

// 等待DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
} 
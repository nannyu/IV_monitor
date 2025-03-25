/**
 * IV Monitor API代理服务器
 * 用于从公共API获取波动率数据，并缓存以提高性能
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 设置缓存，数据保留10分钟
const cache = new NodeCache({ stdTTL: 600 });

// 使用中间件
app.use(cors());
app.use(express.json());

// 基础URL前缀
const BASE_AK_URL = 'http://api.akshare.akfamily.xyz'; // 这只是示例URL，实际需要替换为真实的AKShare API服务地址

// 记录请求日志的中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 处理AKShare API请求的通用函数
async function getAKShareData(endpoint, params = {}) {
  const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
  
  // 检查缓存中是否有数据
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log(`返回缓存数据: ${cacheKey}`);
    return cachedData;
  }
  
  try {
    // 调用实际的API获取数据
    console.log(`请求API数据: ${endpoint}`);
    const response = await axios.get(`${BASE_AK_URL}${endpoint}`, { params });
    
    if (response.status === 200) {
      // 缓存结果
      cache.set(cacheKey, response.data);
      return response.data;
    } else {
      throw new Error(`API响应状态: ${response.status}`);
    }
  } catch (error) {
    console.error(`API请求失败: ${endpoint}`, error.message);
    throw error;
  }
}

// API路由定义 - 上证50ETF期权波动率
app.get('/api/index_option_50etf_qvix', async (req, res) => {
  try {
    const data = await getAKShareData('/index_option_50etf_qvix');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API路由定义 - 沪深300指数期权波动率
app.get('/api/index_option_300index_qvix', async (req, res) => {
  try {
    const data = await getAKShareData('/index_option_300index_qvix');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API路由定义 - 中证1000指数期权波动率
app.get('/api/index_option_1000index_qvix', async (req, res) => {
  try {
    const data = await getAKShareData('/index_option_1000index_qvix');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API路由定义 - 上证50指数期权波动率
app.get('/api/index_option_50index_qvix', async (req, res) => {
  try {
    const data = await getAKShareData('/index_option_50index_qvix');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API路由定义 - 中证500指数期权波动率(如果AKShare支持)
app.get('/api/index_option_500index_qvix', async (req, res) => {
  try {
    // 实际API可能不支持，这里作为示例
    const data = await getAKShareData('/index_option_500index_qvix');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 兜底路由处理
app.use((req, res) => {
  res.status(404).json({ error: '未找到请求的API端点' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`API代理服务器运行在 http://localhost:${PORT}`);
});

// 处理进程终止信号
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});

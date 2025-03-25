# IV Monitor API代理服务器

这是一个为IV Monitor Chrome扩展提供的API代理服务器，用于获取股指期权的隐含波动率数据。

## 功能特点

- 提供RESTful API接口，返回股指期权隐含波动率数据
- 使用缓存机制减少对原始API的请求次数，提高性能
- 跨域资源共享(CORS)支持，允许Chrome扩展直接调用
- 支持多种期权指标，包括上证50ETF、沪深300指数、中证1000指数等

## 安装与运行

### 前提条件

- 安装Node.js (v14或更高版本)
- 确保能够访问互联网获取数据

### 安装步骤

1. 克隆仓库或复制代码到本地
2. 安装依赖
```bash
cd iv-monitor-api-proxy
npm install
```

3. 启动服务器
```bash
npm start
```

4. 开发模式（自动重启）
```bash
npm run dev
```

默认情况下，服务器将在 http://localhost:3000 上运行。

## API接口

服务器提供以下API端点：

- `GET /api/index_option_50etf_qvix` - 获取上证50ETF期权波动率
- `GET /api/index_option_300index_qvix` - 获取沪深300指数期权波动率
- `GET /api/index_option_1000index_qvix` - 获取中证1000指数期权波动率
- `GET /api/index_option_50index_qvix` - 获取上证50指数期权波动率
- `GET /api/index_option_500index_qvix` - 获取中证500指数期权波动率
- `GET /health` - 健康检查端点

## 配置Chrome扩展

要让IV Monitor扩展使用这个代理服务器，请修改扩展代码中的`apiBaseUrl`配置：

```javascript
// 在data-service.js中
this.apiBaseUrl = 'http://localhost:3000/api'; // 或者您部署的服务器地址
```

## 数据来源

本服务器从AKShare API获取数据。请确保您的使用符合AKShare的使用条款和条件。

## 注意事项

- 服务器启动后会缓存请求结果，默认缓存时间为10分钟
- 在生产环境中，建议配置HTTPS以确保数据安全
- 建议在生产环境中增加身份验证机制，限制API访问 
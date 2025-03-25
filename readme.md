# 股指期权隐含波动率变化监控插件

一个Chrome浏览器扩展，用于实时监控股指期权隐含波动率的变化，帮助交易者更好地把握市场波动性。

## 功能特点

- 实时监控股指期权（IF、IC、IH）的隐含波动率
- 支持自定义监控品种和更新频率
- 波动率变化超过阈值时发送通知提醒
- 美观的悬浮窗展示界面
- 支持手动刷新和自动定时更新
- 数据变化趋势可视化展示

## 安装说明

1. 下载本项目代码
2. 打开Chrome浏览器，进入扩展程序页面（chrome://extensions/）
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目目录

## 使用说明

### 基本使用

1. 点击Chrome工具栏中的插件图标，打开监控窗口
2. 默认显示IF、IC、IH三个品种的隐含波动率数据
3. 每个数据卡片显示：
   - 期权代码
   - 当前隐含波动率
   - 波动率变化百分比
   - 数据更新时间

### 配置说明

1. 点击"设置"按钮进入配置页面
2. 可以设置：
   - 监控的期权品种
   - 数据更新频率
   - 通知阈值
   - 通知开关

### 通知设置

- 开启通知后，当波动率变化超过设定阈值时会收到桌面通知
- 通知内容包括：
  - 期权代码
  - 当前波动率
  - 变化幅度

## 技术架构

- 前端：Web Components + Shadow DOM
- 数据服务：Chrome Extension API
- 存储：Chrome Storage API
- 通信：Chrome Message API

## 项目结构

```
├── manifest.json          # 扩展配置文件
├── popup.html            # 弹出窗口页面
├── options.html          # 配置页面
├── background.js         # 后台服务脚本
├── content.js           # 内容脚本
├── styles/              # 样式文件
│   └── popup.css
├── js/                  # JavaScript文件
│   ├── components/      # Web Components
│   │   └── iv-monitor.js
│   └── services/        # 服务模块
│       ├── data-service.js
│       └── logger.js
└── assets/             # 资源文件
    └── icons/          # 图标文件
```

## 开发说明

### 环境要求

- Chrome浏览器（支持Web Components）
- Node.js（用于开发工具）

### 开发流程

1. 克隆项目代码
2. 安装依赖：
   ```bash
   npm install
   ```
3. 开发模式：
   ```bash
   npm run dev
   ```
4. 构建：
   ```bash
   npm run build
   ```

### 代码规范

- 使用ES6+语法
- 遵循Web Components规范
- 使用Chrome Extension API最佳实践

## 注意事项

1. 数据来源尚未配置完毕，目前为模拟数据，仅供演示
2. 建议根据实际需求调整更新频率
3. 通知功能需要用户授权

## 更新日志

### v1.0.0 (2024-03-xx)

- 初始版本发布
- 实现基本监控功能
- 支持自定义配置
- 添加通知功能

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License
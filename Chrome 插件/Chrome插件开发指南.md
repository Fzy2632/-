# Chrome插件从零开始开发指南

## 📚 目录
1. [Chrome插件基础概念](#1-chrome插件基础概念)
2. [项目结构规划](#2-项目结构规划)
3. [核心文件详解](#3-核心文件详解)
4. [开发步骤](#4-开发步骤)
5. [测试和调试](#5-测试和调试)
6. [发布流程](#6-发布流程)

---

## 1. Chrome插件基础概念

### 什么是Chrome插件？
Chrome插件（Extension）是扩展浏览器功能的程序，可以：
- 修改网页内容
- 添加新功能到浏览器
- 与网页交互
- 访问浏览器API

### Manifest V3 简介
当前Chrome插件使用 **Manifest V3** 版本，主要特点：
- 使用 Service Worker 替代后台页面
- 更严格的权限管理
- 更好的性能和安全性

### 核心组件
1. **Manifest文件** - 插件配置文件
2. **Background Script** - 后台脚本（Service Worker）
3. **Popup** - 点击插件图标显示的弹窗
4. **Options Page** - 设置页面
5. **Content Script** - 注入到网页的脚本（可选）

---

## 2. 项目结构规划

### 基础文件结构
```
your-extension/
├── manifest.json          # 配置文件（必需）
├── icons/                 # 图标文件夹
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup.html             # 弹窗页面
├── popup.js               # 弹窗逻辑
├── popup.css              # 弹窗样式
├── options.html           # 设置页面（可选）
├── options.js             # 设置页面逻辑（可选）
├── options.css            # 设置页面样式（可选）
├── background.js          # 后台脚本（Service Worker）
└── content.js             # 内容脚本（可选）
```

### 文件说明
- **manifest.json** - 定义插件的基本信息、权限、文件路径
- **background.js** - 后台运行，处理插件核心逻辑
- **popup.html/js/css** - 用户点击插件图标时显示的界面
- **options.html/js/css** - 插件的设置页面
- **icons/** - 插件图标（不同尺寸）

---

## 3. 核心文件详解

### 3.1 manifest.json（配置文件）

这是插件的"身份证"，必须包含：

```json
{
  "manifest_version": 3,
  "name": "你的插件名称",
  "version": "1.0.0",
  "description": "插件描述",
  
  // 权限声明
  "permissions": [
    "storage",      // 存储数据
    "tabs",         // 访问标签页
    "activeTab"     // 访问当前活动标签页
  ],
  
  // 后台脚本（Service Worker）
  "background": {
    "service_worker": "background.js"
  },
  
  // 弹窗配置
  "action": {
    "default_popup": "popup.html",
    "default_title": "插件标题",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  // 插件图标
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  // 设置页面（可选）
  "options_page": "options.html"
}
```

**关键字段说明：**
- `manifest_version: 3` - 必须使用V3
- `permissions` - 声明需要的权限
- `background.service_worker` - 后台脚本路径
- `action.default_popup` - 弹窗HTML文件

### 3.2 background.js（后台脚本）

后台脚本在后台运行，处理核心逻辑：

```javascript
// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 处理逻辑
    console.log('页面加载完成:', tab.url);
  }
});

// 监听标签页激活
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    console.log('切换到标签页:', tab.url);
  });
});

// 使用存储API
chrome.storage.local.set({ key: 'value' }, () => {
  console.log('数据已保存');
});

chrome.storage.local.get(['key'], (result) => {
  console.log('获取数据:', result.key);
});
```

**注意事项：**
- Service Worker 会在不活跃时休眠
- 不能使用 `window` 对象
- 使用 `chrome.storage` 而不是 `localStorage`

### 3.3 popup.html（弹窗页面）

用户点击插件图标时显示的界面：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>插件名称</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h1>插件标题</h1>
    <div id="content"></div>
    <button id="action-btn">操作按钮</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**限制：**
- 弹窗宽度建议 300-500px
- 高度建议不超过 600px
- 不能打开新窗口（可用 `chrome.tabs.create`）

### 3.4 popup.js（弹窗逻辑）

```javascript
// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
  // 从存储获取数据
  const data = await chrome.storage.local.get(['key']);
  
  // 更新界面
  document.getElementById('content').textContent = data.key || '暂无数据';
  
  // 绑定事件
  document.getElementById('action-btn').addEventListener('click', () => {
    // 处理点击事件
    handleAction();
  });
});

// 打开设置页面
function openOptions() {
  chrome.runtime.openOptionsPage();
}
```

---

## 4. 开发步骤

### 步骤1：创建项目文件夹
```bash
mkdir my-chrome-extension
cd my-chrome-extension
```

### 步骤2：创建 manifest.json
创建 `manifest.json` 文件，填入基本信息。

### 步骤3：创建基础HTML文件
- 创建 `popup.html`（弹窗页面）
- 创建 `options.html`（设置页面，可选）

### 步骤4：编写JavaScript逻辑
- 创建 `background.js`（后台逻辑）
- 创建 `popup.js`（弹窗逻辑）
- 创建 `options.js`（设置页面逻辑，可选）

### 步骤5：添加样式
- 创建 `popup.css`
- 创建 `options.css`（可选）

### 步骤6：准备图标
- 创建 `icons` 文件夹
- 准备 16x16, 48x48, 128x128 三种尺寸的图标
- 可以使用在线工具生成：https://www.favicon-generator.org/

### 步骤7：测试插件
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

---

## 5. 测试和调试

### 5.1 调试弹窗
1. 右键点击插件图标
2. 选择"检查弹出内容"
3. 打开开发者工具

### 5.2 调试后台脚本
1. 在 `chrome://extensions/` 页面
2. 找到你的插件
3. 点击"service worker"链接
4. 打开开发者工具

### 5.3 调试设置页面
1. 右键点击设置页面
2. 选择"检查"
3. 打开开发者工具

### 5.4 常见问题排查

**问题1：插件无法加载**
- 检查 `manifest.json` 语法是否正确
- 检查文件路径是否正确
- 查看控制台错误信息

**问题2：权限被拒绝**
- 检查 `manifest.json` 中的 `permissions` 是否包含所需权限
- 检查是否需要 `host_permissions`

**问题3：数据无法保存**
- 确保使用 `chrome.storage.local` 而不是 `localStorage`
- 检查存储配额（通常足够使用）

---

## 6. 发布流程

### 6.1 准备发布
1. 完善插件功能
2. 测试所有功能
3. 准备应用商店截图和描述
4. 准备隐私政策（如需要）

### 6.2 打包插件
1. 在 `chrome://extensions/` 页面
2. 点击"打包扩展程序"
3. 选择项目文件夹
4. 生成 `.crx` 文件

### 6.3 发布到Chrome Web Store
1. 访问 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)
2. 创建新项目
3. 上传 `.zip` 文件（不是 `.crx`）
4. 填写应用信息
5. 提交审核

---

## 7. 常用API参考

### Chrome Storage API
```javascript
// 保存数据
chrome.storage.local.set({ key: 'value' }, () => {
  console.log('保存成功');
});

// 获取数据
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key);
});

// 删除数据
chrome.storage.local.remove(['key'], () => {
  console.log('删除成功');
});

// 清空所有数据
chrome.storage.local.clear(() => {
  console.log('清空成功');
});
```

### Chrome Tabs API
```javascript
// 获取当前标签页
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  console.log(tabs[0].url);
});

// 创建新标签页
chrome.tabs.create({ url: 'https://example.com' });

// 更新标签页
chrome.tabs.update(tabId, { url: 'https://example.com' });
```

### Chrome Runtime API
```javascript
// 打开设置页面
chrome.runtime.openOptionsPage();

// 发送消息
chrome.runtime.sendMessage({ action: 'hello' }, (response) => {
  console.log(response);
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'hello') {
    sendResponse({ status: 'ok' });
  }
});
```

---

## 8. 最佳实践

### 8.1 代码组织
- 将功能模块化
- 使用现代JavaScript（ES6+）
- 添加错误处理
- 添加注释说明

### 8.2 用户体验
- 提供清晰的界面
- 添加加载状态
- 处理错误情况
- 提供用户反馈

### 8.3 性能优化
- 避免频繁的存储操作
- 使用事件节流
- 优化DOM操作
- 减少不必要的API调用

### 8.4 安全性
- 最小化权限请求
- 验证用户输入
- 避免注入漏洞
- 保护用户隐私

---

## 9. 学习资源

### 官方文档
- [Chrome Extension 官方文档](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)

### 示例项目
- [Chrome Extension 示例](https://github.com/GoogleChrome/chrome-extensions-samples)

### 工具
- [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)
- [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieaejaeefkfmd) - 开发时自动重载插件

---

## 10. 快速开始模板

### 最小化示例

**manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "我的第一个插件",
  "version": "1.0.0",
  "description": "这是一个简单的Chrome插件示例",
  "action": {
    "default_popup": "popup.html"
  },
  "permissions": ["storage"]
}
```

**popup.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>我的插件</title>
</head>
<body>
  <h1>Hello Chrome Extension!</h1>
  <button id="btn">点击我</button>
  <script src="popup.js"></script>
</body>
</html>
```

**popup.js:**
```javascript
document.getElementById('btn').addEventListener('click', () => {
  alert('插件工作正常！');
});
```

---

## 总结

制作Chrome插件的核心步骤：
1. ✅ 创建 `manifest.json` 配置文件
2. ✅ 编写后台脚本 `background.js`
3. ✅ 创建弹窗界面 `popup.html/js/css`
4. ✅ 测试和调试
5. ✅ 打包和发布

记住：**从简单开始，逐步添加功能**。先让插件能运行起来，再逐步完善功能！

祝你开发顺利！🚀


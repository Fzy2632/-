// 存储当前活动标签页和开始时间
let currentTab = null;
let currentDomain = null;
let startTime = null;
let idleStartTime = null;

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("Website Time Tracker 已安装");
});

// 获取域名
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

// 保存时间数据
function saveTime(domain, duration) {
  console.log("saveTime", domain, duration);
  if (!domain) return;
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const key = `${domain}_${today}`;
  
  // 按域名累计（原有逻辑）
  chrome.storage.local.get([key], (result) => {
    const currentTime = result[key] || 0;
    chrome.storage.local.set({ [key]: currentTime + duration });
  });
  
  // 新增：记录今日总量与2小时桶，用于可视化
  const twoHourBucketStart = Math.floor(now.getHours() / 2) * 2; // 0,2,...,22
  const bucketKey = `bucket2h_${today}_${twoHourBucketStart}`; // 每两小时桶
  const dayTotalKey = `daytotal_${today}`; // 今日总量
  
  chrome.storage.local.get([bucketKey, dayTotalKey], (result) => {
    const bucketTime = result[bucketKey] || 0;
    const dayTotal = result[dayTotalKey] || 0;
    chrome.storage.local.set({
      [bucketKey]: bucketTime + duration,
      [dayTotalKey]: dayTotal + duration
    });
  });
}

// 更新活动标签
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateActiveTab(tab);
  });
});

// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (changeInfo.status === 'complete' && tab.active) {
//     updateActiveTab(tab);
//   }
// });

// 监听标签页更新（合并：URL变化与加载完成）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;

  // URL变化（包含跨域跳转、同域不同路径）
  if (changeInfo.url) {
    updateActiveTab(tab);
    return;
  }

  // 仅在“加载完成”时兜底（例如刷新、首次加载但没有 url 字段的情况）
  if (changeInfo.status === 'complete') {
    updateActiveTab(tab);
  }
});


// 更新活动标签
function updateActiveTab(tab) {
  // 如果是chrome:// 或 edge:// 等特殊协议，忽略
  if (tab.url && !tab.url.startsWith('http')) {
    return;
  }
  
  const domain = getDomain(tab.url);
  if (!domain) return;
  
  // 如果切换了域名，保存之前的记录
  if (currentDomain && currentDomain !== domain) {
    if (startTime) {
      const duration = Math.floor((Date.now() - startTime) / 1000); // 秒
      saveTime(currentDomain, duration);
    }
  }
  
  // 更新当前域名和开始时间
  currentDomain = domain;
  startTime = Date.now();
}

// 页面卸载时保存数据
chrome.tabs.onRemoved.addListener(() => {
  if (currentDomain && startTime) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    saveTime(currentDomain, duration);
    currentDomain = null;
    startTime = null;
  }
});

// 定期保存数据（每30秒）
setInterval(() => {
  if (currentDomain && startTime) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    saveTime(currentDomain, duration);
    startTime = Date.now(); // 重置开始时间
  }
}, 30000);

// 监听标签页更新
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (changeInfo.url && tab.active) {
//     const domain = getDomain(tab.url);
//     if (domain && domain !== currentDomain) {
//       // 域名改变了，保存之前的数据
//       if (currentDomain && startTime) {
//         const duration = Math.floor((Date.now() - startTime) / 1000);
//         saveTime(currentDomain, duration);
//       }
//       currentDomain = domain;
//       startTime = Date.now();
//     }
//   }
// });


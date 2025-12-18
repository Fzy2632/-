// 格式化时间显示
function formatTime(seconds) {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (minutes === 0) {
      return `${hours}小时`;
    }
    return `${hours}小时${minutes}分钟`;
  }
}

// 获取今天的数据
function getTodayData() {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(null, (items) => {
      const todayData = {};
      for (let key in items) {
        if (key.endsWith(`_${today}`)) {
          const domain = key.replace(`_${today}`, '');
          // 过滤掉系统键
          if (domain !== 'daytotal' && !domain.startsWith('bucket2h')) {
            todayData[domain] = items[key];
          }
        }
      }
      resolve(todayData);
    });
  });
}

// 获取所有数据
function getAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const allData = {};
      for (let key in items) {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const domain = parts.slice(0, -1).join('_');
          // 过滤掉系统键
          if (domain !== 'daytotal' && !domain.startsWith('bucket2h')) {
            if (!allData[domain]) {
              allData[domain] = 0;
            }
            allData[domain] += items[key];
          }
        }
      }
      resolve(allData);
    });
  });
}

// 获取今天每2小时桶数据
async function getTodayTwoHourBuckets() {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(null, (items) => {
      const buckets = new Array(12).fill(0); // 0-2,2-4,...,22-24
      for (let i = 0; i < 12; i++) {
        const key = `bucket2h_${today}_${i * 2}`;
        if (items[key]) buckets[i] = items[key];
      }
      const dayTotal = items[`daytotal_${today}`] || buckets.reduce((s, v) => s + v, 0);
      resolve({ buckets, dayTotal });
    });
  });
}

// 获取本周每天的数据
async function getWeekDailyData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const today = new Date();
      const weekData = [];
      let totalSeconds = 0;
      let validDays = 0;
      
      // 计算本周每天的数据
      for (let i = 6; i >= 0; i--) { // 从周日到周六
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayTotalKey = `daytotal_${dateStr}`;
        
        let daySeconds = 0;
        if (items[dayTotalKey]) {
          daySeconds = items[dayTotalKey];
        } else {
          // 如果没有daytotal_键，则尝试从按域名的当日键聚合
          for (let key in items) {
            if (key.endsWith(`_${dateStr}`) && !key.startsWith('bucket2h_')) {
              daySeconds += items[key];
            }
          }
        }
        
        if (daySeconds > 0) {
          totalSeconds += daySeconds;
          validDays++;
        }
        
        weekData.push({
          date: dateStr,
          day: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
          seconds: daySeconds
        });
      }
      
      const averageSeconds = validDays > 0 ? Math.round(totalSeconds / validDays) : 0;
      
      resolve({ weekData, averageSeconds });
    });
  });
}

// 显示今天的数据
async function displayTodayData() {
  const data = await getTodayData();
  const container = document.getElementById('today-stats');
  displayStats(data, container);
  
  // 计算并显示今天的总访问时长和访问网站数
  const totalTime = Object.values(data).reduce((sum, time) => sum + time, 0);
  const websiteCount = Object.keys(data).length;
  
  document.getElementById('today-total').textContent = formatTime(totalTime);
  document.getElementById('today-count').textContent = websiteCount;
  
  // 绘制今天每2小时柱状图
  const { buckets, dayTotal } = await getTodayTwoHourBuckets();
  drawTodayTwoHourChart(buckets, dayTotal);
}

// 显示所有数据
async function displayAllData() {
  const data = await getAllData();
  const container = document.getElementById('all-stats');
  displayStats(data, container);
  
  // 计算并显示所有时间的总访问时长和访问网站数
  const totalTime = Object.values(data).reduce((sum, time) => sum + time, 0);
  const websiteCount = Object.keys(data).length;
  
  document.getElementById('all-total').textContent = formatTime(totalTime);
  document.getElementById('all-count').textContent = websiteCount;
  
  // 绘制本周图表
  drawWeekChart();
}

// 显示统计数据
function displayStats(data, container) {
  container.innerHTML = '';
  
  if (Object.keys(data).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <p>暂无数据</p>
      </div>
    `;
    return;
  }
  
  // 转换为数组并排序
  const items = Object.entries(data)
    .map(([domain, time]) => ({ domain, time }))
    .sort((a, b) => b.time - a.time);
  
  const maxTime = items[0].time;
  
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'site-item';
    itemDiv.innerHTML = `
      <div class="site-info">
        <div>
          <div class="site-domain">${item.domain}</div>
          <div class="site-time">${formatTime(item.time)}</div>
        </div>
      </div>
    `;
    
    const timeBar = document.createElement('div');
    timeBar.className = 'time-bar';
    const fill = document.createElement('div');
    fill.className = 'time-bar-fill';
    fill.style.width = `${(item.time / maxTime) * 100}%`;
    timeBar.appendChild(fill);
    
    itemDiv.appendChild(timeBar);
    container.appendChild(itemDiv);
  });
}

// 绘制图表
function drawChart(data, title) {
  // 今天标签页显示每2小时图表，全部标签页显示周图表
  if (title === '今天') {
    displayTodayData();
  } else if (title === '全部') {
    drawWeekChart();
  }
}

// 绘制本周图表（iPhone风格）
async function drawWeekChart() {
  const { weekData, averageSeconds } = await getWeekDailyData();
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const maxVal = Math.max(1, ...weekData.map(item => item.seconds));
  
  // 布局 - 调整使图表居中
  const padding = { top: 40, right: 20, bottom: 30, left: 20 };
  const barCount = weekData.length;
  const gap = 10; // 柱子间距
  const barWidth = 30; // 固定柱子宽度，使图表更美观
  const totalChartWidth = barCount * barWidth + (barCount - 1) * gap; // 总宽度
  const startX = (canvas.width - totalChartWidth) / 2; // 计算起始X坐标，使图表居中
  
  const chartHeight = canvas.height - padding.top - padding.bottom;
  const chartTop = padding.top;
  
  // 绘制周平均使用时间
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px -apple-system';
  ctx.textAlign = 'center';
  ctx.fillText(`本周平均每天 ${formatTime(averageSeconds)}`, canvas.width / 2, 25);
  
  // 绘制平均水平线（先绘制，确保穿过所有柱子）
  ctx.strokeStyle = '#003399'; // 蓝色虚线
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const avgY = chartTop + (chartHeight - Math.round((averageSeconds / maxVal) * chartHeight));
  ctx.beginPath();
  ctx.moveTo(0, avgY); // 从画布左侧开始
  ctx.lineTo(canvas.width, avgY); // 到画布右侧结束
  ctx.stroke();
  ctx.setLineDash([]);
  
  // 绘制柱子
  weekData.forEach((item, i) => {
    const x = startX + i * (barWidth + gap);
    const h = Math.round((item.seconds / maxVal) * chartHeight);
    const y = chartTop + (chartHeight - h);
    
    // 只有当有数据时才绘制柱子
    if (h > 0) {
      // 2. 蓝底层
      const gradientDark = ctx.createLinearGradient(x, y + h, x, y);
      gradientDark.addColorStop(0, '#002266');
      gradientDark.addColorStop(1, '#003399');
      ctx.fillStyle = gradientDark;
      ctx.fillRect(x, y + Math.max(0, h - h * 0.6), barWidth, Math.max(0, h * 0.6));
      
      // 3. 中蓝中层
      const gradientMedium = ctx.createLinearGradient(x, y + h, x, y);
      gradientMedium.addColorStop(0, '#0044aa');
      gradientMedium.addColorStop(1, '#0055cc');
      ctx.fillStyle = gradientMedium;
      ctx.fillRect(x, y + Math.max(0, h - h * 0.9), barWidth, Math.max(0, h * 0.3));
      
      // 4. 浅蓝顶层
      const gradientLight = ctx.createLinearGradient(x, y + h, x, y);
      gradientLight.addColorStop(0, '#0066dd');
      gradientLight.addColorStop(1, '#0088ff');
      ctx.fillStyle = gradientLight;
      ctx.fillRect(x, y, barWidth, Math.max(0, h * 0.1));
      
      // 5. 高光（顶部边缘）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(x, y, barWidth, 2);
    }
  });
  
  // 绘制X轴刻度（星期几）
  ctx.fillStyle = '#666';
  ctx.font = '11px -apple-system';
  ctx.textAlign = 'center';
  
  weekData.forEach((item, i) => {
    const x = startX + i * (barWidth + gap) + barWidth / 2;
    ctx.fillText(item.day, x, chartTop + chartHeight + 20);
  });
}

// 绘制今天每2小时竖直柱状图（iPhone风格）
function drawTodayTwoHourChart(buckets, dayTotal) {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const maxVal = Math.max(1, ...buckets);
  
  // 布局 - iPhone风格调整
  const padding = { top: 40, right: 20, bottom: 30, left: 20 };
  const availableWidth = canvas.width - padding.left - padding.right;
  const barCount = buckets.length;
  const gap = 3; // 减少间距，让柱子更粗
  const barWidth = Math.floor((availableWidth - gap * (barCount - 1)) / barCount);
  
  // 计算图表的总宽度（柱子+间距）
  const totalBarWidth = barCount * barWidth + (barCount - 1) * gap;
  
  // 计算图表的起始X坐标，使其居中
  const startX = padding.left + (availableWidth - totalBarWidth) / 2;
  
  const chartHeight = canvas.height - padding.top - padding.bottom;
  
  // 绘制总使用时间（类似iPhone顶部显示）
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px -apple-system';
  ctx.textAlign = 'center';
  ctx.fillText(`今天共上网${formatTime(dayTotal)}时间`, canvas.width / 2, 25);
  
  // 绘制6小时分割线
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  const hoursPerDay = 24;
  const segmentsPerDay = hoursPerDay / 2; // 每2小时一个分段
  const segmentsPer6Hours = 3; // 每6小时3个分段
  
  for (let i = 1; i < hoursPerDay / 6; i++) {
    const segmentIndex = i * segmentsPer6Hours;
    const x = startX + segmentIndex * (barWidth + gap) - gap / 2;
    
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + chartHeight);
    ctx.stroke();
  }
  
  // 绘制柱子（iPhone风格：粗柱子，渐变颜色）
  buckets.forEach((val, i) => {
    const x = startX + i * (barWidth + gap);
    const h = Math.round((val / maxVal) * chartHeight);
    const y = padding.top + (chartHeight - h);
    
    // 使用多层渐变效果，更接近iPhone风格
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    if (val > maxVal * 0.7) {
      // 高使用时间：深蓝色
      gradient.addColorStop(0, '#4A80F0');
      gradient.addColorStop(1, '#2C55C6');
    } else if (val > maxVal * 0.4) {
      // 中使用时间：中等蓝色
      gradient.addColorStop(0, '#5B93F1');
      gradient.addColorStop(1, '#3A6FC7');
    } else {
      // 低使用时间：浅蓝色
      gradient.addColorStop(0, '#7DA5F3');
      gradient.addColorStop(1, '#4B7DD8');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, h);
    
    // 柱子顶部的亮色高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x, y, barWidth, 2);
  });
  
  // X轴刻度（iPhone风格：只显示主要时间点）
  ctx.fillStyle = '#666';
  ctx.font = '12px -apple-system';
  ctx.textAlign = 'center';
  
  // 只显示0时、6时、12时、18时
  const majorTimes = [0, 3, 6, 9]; // 对应索引0, 3, 6, 9，分别代表0时、6时、12时、18时
  const timeLabels = ['0时', '6时', '12时', '18时'];
  
  majorTimes.forEach((index, i) => {
    const x = startX + index * (barWidth + gap) + Math.floor(barWidth / 2);
    ctx.fillText(timeLabels[i], x, canvas.height - 8);
  });
}

// 标签页切换
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', async () => {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (button.dataset.tab === 'today') {
      document.getElementById('today-tab').classList.add('active');
      displayTodayData();
    } else {
      document.getElementById('all-tab').classList.add('active');
      displayAllData();
    }
  });
});

// 清除今天数据
document.getElementById('clear-today-btn').addEventListener('click', async () => {
  if (confirm('确定要清除今天的数据吗？')) {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = [];
      for (let key in items) {
        if (key.endsWith(`_${today}`)) {
          keysToRemove.push(key);
        }
      }
      chrome.storage.local.remove(keysToRemove, () => {
        displayTodayData();
        alert('今天的数据已清除');
      });
    });
  }
});

// 清除所有数据
document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    chrome.storage.local.clear(() => {
      document.getElementById('today-stats').innerHTML = `
        <div class="empty-state">
          <p>数据已清除</p>
        </div>
      `;
      document.getElementById('all-stats').innerHTML = `
        <div class="empty-state">
          <p>数据已清除</p>
        </div>
      `;
      const canvas = document.getElementById('chart');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      alert('所有数据已清除');
    });
  }
});

// 打开详细页面
document.getElementById('open-details-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  displayTodayData();
});


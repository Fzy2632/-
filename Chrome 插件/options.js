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

// 获取所有存储的数据
function getAllStoredData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      resolve(items);
    });
  });
}

// 获取今天的数据
async function getTodayData() {
  const data = await getAllStoredData();
  const today = new Date().toISOString().split('T')[0];
  const todayData = {};
  
  for (let key in data) {
    // 过滤掉系统键
    if (key.startsWith('daytotal_') || key.startsWith('bucket2h_')) {
      continue;
    }
    
    if (key.endsWith(`_${today}`)) {
      const domain = key.replace(`_${today}`, '');
      todayData[domain] = data[key];
    }
  }
  
  return todayData;
}

// 获取今天每2小时的数据桶
async function getTodayTwoHourBuckets() {
  const data = await getAllStoredData();
  const today = new Date().toISOString().split('T')[0];
  const buckets = [];
  let dayTotal = 0;
  
  // 获取今日总量
  if (data[`daytotal_${today}`]) {
    dayTotal = data[`daytotal_${today}`];
  }
  
  // 获取每2小时的数据
  for (let i = 0; i < 12; i++) {
    const bucketKey = `bucket2h_${today}_${i * 2}`;
    buckets.push(data[bucketKey] || 0);
  }
  
  return { buckets, dayTotal };
}

// 获取本周的数据（按天聚合，用于柱状图）
async function getWeekData() {
  const all = await getAllStoredData();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // 周日为0
  weekStart.setHours(0, 0, 0, 0);

  // 聚合为按天总量
  const dayTotals = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toISOString().split('T')[0];
    dayTotals.set(key, 0);
  }

  // 优先使用 daytotal_YYYY-MM-DD
  for (const [key, val] of Object.entries(all)) {
    if (key.startsWith('daytotal_')) {
      const dateStr = key.replace('daytotal_', '');
      if (dayTotals.has(dateStr)) {
        dayTotals.set(dateStr, (dayTotals.get(dateStr) || 0) + val);
      }
    }
  }

  // 如果某天仍为0，尝试从按域名的当日键聚合（但过滤掉系统键）
  for (const [key, val] of Object.entries(all)) {
    // 过滤掉系统键
    if (key.startsWith('daytotal_') || key.startsWith('bucket2h_')) {
      continue;
    }
    
    const parts = key.split('_');
    if (parts.length >= 2) {
      const dateStr = parts[parts.length - 1];
      
      // 检查日期格式（使用正则表达式验证YYYY-MM-DD格式）
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        continue;
      }
      
      if (dayTotals.has(dateStr)) {
        dayTotals.set(dateStr, (dayTotals.get(dateStr) || 0) + val);
      }
    }
  }

  return Object.fromEntries(dayTotals.entries());
}

// 获取本周的数据（按域名聚合，用于网站详情列表）
async function getWeekDataByDomain() {
  const data = await getAllStoredData();
  const weekData = {};
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // 周日为0
  weekStart.setHours(0, 0, 0, 0);
  
  // 获取本周开始日期的字符串（YYYY-MM-DD格式）
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  for (let key in data) {
    // 过滤掉系统键：daytotal_ 和 bucket2h_ 开头的键
    if (key.startsWith('daytotal_') || key.startsWith('bucket2h_')) {
      continue;
    }
    
    const parts = key.split('_');
    if (parts.length >= 2) {
      const dateStr = parts[parts.length - 1];
      
      // 检查日期字符串格式是否正确（YYYY-MM-DD）
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        continue;
      }
      
      // 使用日期字符串直接比较（避免时区问题）
      if (dateStr >= weekStartStr) {
        const domain = parts.slice(0, -1).join('_');
        if (!weekData[domain]) {
          weekData[domain] = 0;
        }
        weekData[domain] += data[key];
      }
    }
  }
  
  return weekData;
}

// 获取本月的数据
async function getMonthData() {
  const data = await getAllStoredData();
  const monthData = {};
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  
  // 获取本月开始日期的字符串（YYYY-MM-DD格式）
  const monthStartStr = monthStart.toISOString().split('T')[0];
  
  for (let key in data) {
    // 过滤掉系统键：daytotal_ 和 bucket2h_ 开头的键
    if (key.startsWith('daytotal_') || key.startsWith('bucket2h_')) {
      continue;
    }
    
    const parts = key.split('_');
    if (parts.length >= 2) {
      const dateStr = parts[parts.length - 1];
      
      // 检查日期字符串格式是否正确（YYYY-MM-DD）
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        continue;
      }
      
      // 使用日期字符串直接比较（避免时区问题）
      if (dateStr >= monthStartStr) {
        const domain = parts.slice(0, -1).join('_');
        if (!monthData[domain]) {
          monthData[domain] = 0;
        }
        monthData[domain] += data[key];
      }
    }
  }
  
  return monthData;
}

// 获取所有数据
async function getAllData() {
  const data = await getAllStoredData();
  const allData = {};
  
  for (let key in data) {
    // 过滤掉系统键：daytotal_ 和 bucket2h_ 开头的键
    if (key.startsWith('daytotal_') || key.startsWith('bucket2h_')) {
      continue;
    }
    
    const parts = key.split('_');
    if (parts.length >= 2) {
      const dateStr = parts[parts.length - 1];
      
      // 检查日期字符串格式是否正确（YYYY-MM-DD），使用正则表达式更高效
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        continue;
      }
      
      const domain = parts.slice(0, -1).join('_');
      if (!allData[domain]) {
        allData[domain] = 0;
      }
      allData[domain] += data[key];
    }
  }
  
  return allData;
}

// 显示统计数据
function displayStats(data, container, maxTime) {
  container.innerHTML = '';
  
  if (Object.keys(data).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
  
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'site-item';
    itemDiv.innerHTML = `
      <div class="site-info">
        <div class="site-domain">${item.domain}</div>
        <div class="site-time">${formatTime(item.time)}</div>
      </div>
    `;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${(item.time / maxTime) * 100}%`;
    progressBar.appendChild(fill);
    
    itemDiv.appendChild(progressBar);
    container.appendChild(itemDiv);
  });
}

// 绘制iPhone风格的周图表
function drawStyledWeekChart(canvasId, weekData, averageSeconds, title) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const maxVal = Math.max(1, ...weekData.map(item => item.seconds));
  
  // 布局 - 调整使图表居中
  const padding = { top: 40, right: 20, bottom: 30, left: 20 };
  const barCount = weekData.length;
  const gap = 10; // 柱子间距
  const barWidth = 40; // 固定柱子宽度，使图表更美观
  const totalChartWidth = barCount * barWidth + (barCount - 1) * gap; // 总宽度
  const startX = (canvas.width - totalChartWidth) / 2; // 计算起始X坐标，使图表居中
  
  const chartHeight = canvas.height - padding.top - padding.bottom;
  const chartTop = padding.top;
  
  // 绘制周平均使用时间
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px -apple-system';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 25);
  
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
  
  // 绘制X轴刻度（星期几或月份）
  ctx.fillStyle = '#666';
  ctx.font = '11px -apple-system';
  ctx.textAlign = 'center';
  
  weekData.forEach((item, i) => {
    const x = startX + i * (barWidth + gap) + barWidth / 2;
    ctx.fillText(item.label, x, chartTop + chartHeight + 20);
  });
}

// 绘制图表
function drawChart(data, canvasId, title) {
  // 今天的图表使用iPhone风格
  if (canvasId === 'today-chart') {
    drawTodayTwoHourChart();
    return;
  }
  
  // 本周、本月、全部的图表使用iPhone风格
  if (canvasId === 'week-chart') {
    drawWeekDailyChartWithStyled();
    return;
  } else if (canvasId === 'month-chart') {
    drawMonthChartWithStyled();
    return;
  } else if (canvasId === 'all-chart') {
    drawAllChartWithStyled();
    return;
  }
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  // 对于其他图表（如果有），暂时保持原有样式
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  if (Object.keys(data).length === 0) return;
  
  // 这里可以扩展其他图表类型的iPhone风格实现
  // 目前暂时只处理今天和本周的图表
  
}

// 绘制今天每2小时竖直柱状图（iPhone风格）
async function drawTodayTwoHourChart() {
  const { buckets, dayTotal } = await getTodayTwoHourBuckets();
  const canvas = document.getElementById('today-chart');
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
  ctx.fillText(formatTime(dayTotal), canvas.width / 2, 25);
  
  // 绘制6小时分割线
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  const hoursPerDay = 24;
  const segmentsPerDay = hoursPerDay / 2; // 每2小时一个分段
  const segmentsPer6Hours = 3; // 每6小时3个分段
  
  for (let i = 1; i < hoursPerDay / 6; i++) {
    const x = startX + i * segmentsPer6Hours * (barWidth + gap) - gap / 2;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + chartHeight);
    ctx.stroke();
  }
  
  // 绘制柱子
  buckets.forEach((val, i) => {
    const x = startX + i * (barWidth + gap);
    const h = Math.round((val / maxVal) * chartHeight);
    const y = padding.top + (chartHeight - h);
    
    // 使用多层渐变，类似iPhone风格
    // 1. 蓝底层
    const gradientDark = ctx.createLinearGradient(x, y + h, x, y);
    gradientDark.addColorStop(0, '#002266');
    gradientDark.addColorStop(1, '#003399');
    ctx.fillStyle = gradientDark;
    ctx.fillRect(x, y + Math.max(0, h - h * 0.6), barWidth, Math.max(0, h * 0.6));
    
    // 2. 中蓝中层
    const gradientMedium = ctx.createLinearGradient(x, y + h, x, y);
    gradientMedium.addColorStop(0, '#0044aa');
    gradientMedium.addColorStop(1, '#0055cc');
    ctx.fillStyle = gradientMedium;
    ctx.fillRect(x, y + Math.max(0, h - h * 0.9), barWidth, Math.max(0, h * 0.3));
    
    // 3. 浅蓝顶层
    const gradientLight = ctx.createLinearGradient(x, y + h, x, y);
    gradientLight.addColorStop(0, '#0066dd');
    gradientLight.addColorStop(1, '#0088ff');
    ctx.fillStyle = gradientLight;
    ctx.fillRect(x, y, barWidth, Math.max(0, h * 0.1));
    
    // 4. 高光（顶部边缘）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(x, y, barWidth, 2);
  });
  
  // 绘制X轴刻度（只显示主要时间点：0时、6时、12时、18时）
  ctx.fillStyle = '#666';
  ctx.font = '11px -apple-system';
  ctx.textAlign = 'center';
  
  const majorHours = [0, 6, 12, 18];
  majorHours.forEach(hour => {
    const index = hour / 2; // 每2小时一个分段，所以索引是小时数/2
    const x = startX + index * (barWidth + gap) + barWidth / 2;
    ctx.fillText(`${hour}时`, x, padding.top + chartHeight + 20);
  });
}

// 绘制本周每日竖直柱状图，带平均线
// 绘制带iPhone风格的本周每日图表
async function drawWeekDailyChartWithStyled() {
  const allData = await getAllStoredData();
  const canvas = document.getElementById('week-chart');
  if (!canvas) return;
  
  const today = new Date();
  const weekChartData = [];
  let totalSeconds = 0;
  let validDays = 0;
  
  // 获取从今天开始往前7天的数据（与弹窗界面一致）
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    let daySeconds = 0;
    
    // 优先使用daytotal_YYYY-MM-DD
    if (allData[`daytotal_${dateStr}`]) {
      daySeconds += allData[`daytotal_${dateStr}`];
    } else {
      // 否则从按域名的当日键聚合
      for (const [key, val] of Object.entries(allData)) {
        if (key.endsWith(`_${dateStr}`) && !key.startsWith('bucket2h_') && !key.startsWith('daytotal_')) {
          daySeconds += val;
        }
      }
    }
    
    if (daySeconds > 0) {
      totalSeconds += daySeconds;
      validDays++;
    }
    
    weekChartData.push({
      date: dateStr,
      label: ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()],
      seconds: daySeconds
    });
  }
  
  const averageSeconds = validDays > 0 ? Math.round(totalSeconds / validDays) : 0;
  
  // 绘制iPhone风格图表
  drawStyledWeekChart('week-chart', weekChartData, averageSeconds, '本周上网时长');
}

// 绘制带iPhone风格的月份图表
async function drawMonthChartWithStyled() {
  // 获取本月数据
  const data = await getAllStoredData();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  // 按日期分组数据
  const monthTotals = {};
  let totalSeconds = 0;
  let validDays = 0;
  
  for (let day = 1; day <= 31; day++) {
    const date = new Date(currentYear, currentMonth, day);
    if (date.getMonth() !== currentMonth) break; // 防止超出月份天数
    
    const dateStr = date.toISOString().split('T')[0];
    let daySeconds = 0;
    
    // 检查是否有daytotal_键
    const dayTotalKey = `daytotal_${dateStr}`;
    if (data[dayTotalKey]) {
      daySeconds = data[dayTotalKey];
    } else {
      // 否则从按域名的当日键聚合
      for (let key in data) {
        if (key.endsWith(`_${dateStr}`) && !key.startsWith('bucket2h_')) {
          daySeconds += data[key];
        }
      }
    }
    
    if (daySeconds > 0) {
      totalSeconds += daySeconds;
      validDays++;
    }
    
    monthTotals[dateStr] = daySeconds;
  }
  
  // 准备图表数据（按周分组显示）
  const weekGroups = [];
  let weekSeconds = 0;
  let weekCount = 0;
  
  // 将本月数据按周分组
  for (let day = 1; day <= 31; day++) {
    const date = new Date(currentYear, currentMonth, day);
    if (date.getMonth() !== currentMonth) break;
    
    const dateStr = date.toISOString().split('T')[0];
    weekSeconds += monthTotals[dateStr] || 0;
    weekCount++;
    
    // 每周日或月最后一天分组
    if (date.getDay() === 0 || day === 31 || (new Date(currentYear, currentMonth, day + 1).getMonth() !== currentMonth)) {
      weekGroups.push({
        label: `第${Math.ceil(date.getDate() / 7)}周`,
        seconds: weekSeconds
      });
      weekSeconds = 0;
      weekCount = 0;
    }
  }
  
  const averageSeconds = validDays > 0 ? Math.round(totalSeconds / validDays) : 0;
  
  // 使用新的iPhone风格绘制函数
  drawStyledWeekChart('month-chart', weekGroups, averageSeconds, '本月上网时长');
}

// 绘制带iPhone风格的全部数据图表
async function drawAllChartWithStyled() {
  // 获取所有数据
  const data = await getAllStoredData();
  
  // 按月份分组数据
  const monthTotals = {};
  let totalSeconds = 0;
  let validMonths = 0;
  
  // 遍历所有数据，按月份分组
  for (let key in data) {
    if (key.startsWith('daytotal_') || (key.endsWith('_') && !key.startsWith('bucket2h_'))) {
      // 解析日期
      const dateStr = key.startsWith('daytotal_') ? 
        key.replace('daytotal_', '') : 
        key.split('_').slice(-1)[0];
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // 计算该日的总时间
      let daySeconds = 0;
      if (key.startsWith('daytotal_')) {
        daySeconds = data[key];
      } else {
        // 聚合该日所有域名的时间
        const todayKey = dateStr;
        for (let k in data) {
          if (k.endsWith(`_${todayKey}`) && !k.startsWith('bucket2h_')) {
            daySeconds += data[k];
          }
        }
      }
      
      if (daySeconds > 0) {
        if (!monthTotals[monthKey]) {
          monthTotals[monthKey] = 0;
        }
        monthTotals[monthKey] += daySeconds;
      }
    }
  }
  
  // 计算总时间和平均每月时间
  for (let monthKey in monthTotals) {
    totalSeconds += monthTotals[monthKey];
    validMonths++;
  }
  
  const averageSeconds = validMonths > 0 ? Math.round(totalSeconds / validMonths) : 0;
  
  // 准备图表数据
  const monthGroups = [];
  for (let monthKey in monthTotals) {
    const [year, month] = monthKey.split('-');
    monthGroups.push({
      label: `${parseInt(month)}月`,
      seconds: monthTotals[monthKey]
    });
  }
  
  // 按月份排序
  monthGroups.sort((a, b) => {
    const aMonth = parseInt(a.label.replace('月', ''));
    const bMonth = parseInt(b.label.replace('月', ''));
    return aMonth - bMonth;
  });
  
  // 使用新的iPhone风格绘制函数
  drawStyledWeekChart('all-chart', monthGroups, averageSeconds, '全部上网时长');
}

// 原始的周图表函数，保留作为参考
function drawWeekDailyChart(dayTotals) {
  const canvas = document.getElementById('week-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const labels = ['周日','周一','周二','周三','周四','周五','周六'];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0,0,0,0);

  const values = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toISOString().split('T')[0];
    values.push(dayTotals[key] || 0);
  }

  const maxVal = Math.max(1, ...values);
  const padding = { top: 20, right: 20, bottom: 35, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const gap = 14;
  const barWidth = Math.floor((chartWidth - gap * (values.length - 1)) / values.length);

  // 标题
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px -apple-system';
  ctx.fillText('本周每日上网时长', padding.left, 16);

  // 柱子
  values.forEach((val, i) => {
    const x = padding.left + i * (barWidth + gap);
    const h = Math.round((val / maxVal) * chartHeight);
    const y = padding.top + (chartHeight - h);
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, h);
  });

  // 平均线（按已过去的天数计算）
  const todayIndex = today.getDay();
  const elapsedDays = Math.max(1, todayIndex + 1);
  const sum = values.slice(0, elapsedDays).reduce((s, v) => s + v, 0);
  const avg = sum / elapsedDays;
  const avgY = padding.top + (chartHeight - Math.round((avg / maxVal) * chartHeight));
  ctx.strokeStyle = '#ff8800';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, avgY);
  ctx.lineTo(padding.left + chartWidth, avgY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ff8800';
  ctx.font = '11px -apple-system';
  ctx.fillText(`平均: ${formatTime(Math.round(avg))}`, padding.left + 5, avgY - 6);

  // X轴标签
  ctx.fillStyle = '#666';
  ctx.font = '11px -apple-system';
  labels.forEach((label, i) => {
    const x = padding.left + i * (barWidth + gap) + Math.floor(barWidth/2) - 12;
    ctx.fillText(label, x, height - 10);
  });
}

// 更新统计卡片
function updateStatCards(prefix, data) {
  const totalElement = document.getElementById(`${prefix}-total`);
  const countElement = document.getElementById(`${prefix}-count`);
  
  if (totalElement) {
    const total = Object.values(data).reduce((sum, time) => sum + time, 0);
    totalElement.textContent = formatTime(total);
  }
  
  if (countElement) {
    countElement.textContent = Object.keys(data).length;
  }
}

// 标签页切换
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', async () => {
      // 更新按钮状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // 更新内容区域
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 加载对应数据
      const tab = button.dataset.tab;
      const contentId = `${tab}-content`;
      document.getElementById(contentId).classList.add('active');
      
      let data, maxTime;
      
      if (tab === 'today') {
        data = await getTodayData();
        // 绘制今天的图表（iPhone风格）
        await drawTodayTwoHourChart();
      } else if (tab === 'week') {
        // 绘制iPhone风格的周图表
        await drawWeekDailyChartWithStyled();
        
        // 获取本周数据（按域名聚合用于网站详情列表）
        data = await getWeekDataByDomain();
        maxTime = Object.values(data).length > 0 ? Math.max(...Object.values(data)) : 1;
        
        // 更新统计卡片（使用按域名聚合的数据，这样访问网站数才是正确的）
        updateStatCards(tab, data);
        
        // 显示网站详情列表
        displayStats(data, document.getElementById(`${tab}-stats`), maxTime);
        return;
      } else if (tab === 'month') {
        data = await getMonthData();
      } else {
        data = await getAllData();
      }
      
      if (tab !== 'week') {
        maxTime = Object.values(data).length > 0 ? Math.max(...Object.values(data)) : 1;
        
        // 更新统计卡片
        updateStatCards(tab, data);
        
        // 显示列表
        displayStats(data, document.getElementById(`${tab}-stats`), maxTime);
        
        // 绘制图表（根据tab调用对应的iPhone风格图表）
        drawChart(data, `${tab}-chart`, button.textContent);
      }
    });
  });
}

// 导出数据
document.getElementById('export-btn').addEventListener('click', async () => {
  const data = await getAllStoredData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `website-tracker-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// 导入数据
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      await chrome.storage.local.set(data);
      alert('数据导入成功！');
      location.reload();
    } catch (error) {
      alert('导入失败：文件格式错误');
    }
  };
  reader.readAsText(file);
});

// 清除今天数据
document.getElementById('clear-today-btn').addEventListener('click', async () => {
  if (confirm('确定要清除今天的数据吗？')) {
    const today = new Date().toISOString().split('T')[0];
    const data = await getAllStoredData();
    const keysToRemove = [];
    
    for (let key in data) {
      if (key.endsWith(`_${today}`)) {
        keysToRemove.push(key);
      }
    }
    
    await chrome.storage.local.remove(keysToRemove);
    alert('今天的数据已清除');
    location.reload();
  }
});

// 清除所有数据
document.getElementById('clear-all-btn').addEventListener('click', async () => {
  if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    await chrome.storage.local.clear();
    alert('所有数据已清除');
    location.reload();
  }
});

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  
  // 默认加载今天的数据
  const todayData = await getTodayData();
  const maxTime = Object.values(todayData).length > 0 ? Math.max(...Object.values(todayData)) : 1;
  updateStatCards('today', todayData);
  displayStats(todayData, document.getElementById('today-stats'), maxTime);
  
  // 绘制今天的图表（iPhone风格）
  await drawTodayTwoHourChart();
  
  // 默认预渲染一周柱状图（iPhone风格）
  await drawWeekDailyChartWithStyled();
  
  // 更新本周统计卡片（使用按域名聚合的数据）
  const weekData = await getWeekDataByDomain();
  updateStatCards('week', weekData);
});


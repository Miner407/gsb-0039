const API_BASE = '/api';

let currentUser = null;
let currentPage = 'login';
let projects = [];
let timesheets = [];
let users = [];
let batchEntries = [];

const app = document.getElementById('app');

async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin'
  };
  
  const response = await fetch(API_BASE + url, {
    ...defaultOptions,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.headers.get('content-type')?.includes('text/csv')) {
    return response;
  }

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  
  return data;
}

async function checkAuth() {
  try {
    const data = await apiRequest('/auth/me');
    currentUser = data.user;
    return true;
  } catch (err) {
    return false;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  return date;
}

function formatMoney(amount) {
  return '¥' + Number(amount).toFixed(2);
}

function getStatusText(status) {
  const map = {
    'pending': '待审核',
    'approved': '已审核',
    'rejected': '已驳回'
  };
  return map[status] || status;
}

function getStatusClass(status) {
  return 'status-' + status;
}

function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 250px;';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <h2>工时填报系统</h2>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" id="username" required>
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" id="password" required>
          </div>
          <button type="submit" class="btn btn-primary">登录</button>
        </form>
        <div class="login-tip">
          <p>管理员账号: admin / admin123</p>
          <p>成员账号: zhangsan / 123456</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      currentUser = data.user;
      navigateTo(currentUser.role === 'admin' ? 'admin-dashboard' : 'timesheet');
    } catch (err) {
      document.getElementById('login-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

function renderLayout(content, activePage) {
  const isAdmin = currentUser.role === 'admin';
  
  let navItems = '';
  
  if (isAdmin) {
    navItems = `
      <a data-page="admin-dashboard" class="${activePage === 'admin-dashboard' ? 'active' : ''}">数据概览</a>
      <a data-page="timesheet-review" class="${activePage === 'timesheet-review' ? 'active' : ''}">工时审核</a>
      <a data-page="stats-project" class="${activePage === 'stats-project' ? 'active' : ''}">项目成本统计</a>
      <a data-page="stats-member" class="${activePage === 'stats-member' ? 'active' : ''}">成员工时统计</a>
      <a data-page="stats-task" class="${activePage === 'stats-task' ? 'active' : ''}">任务类型统计</a>
      <a data-page="stats-utilization" class="${activePage === 'stats-utilization' ? 'active' : ''}">成员利用率</a>
      <a data-page="stats-pending" class="${activePage === 'stats-pending' ? 'active' : ''}">未审核列表</a>
      <a data-page="project-manage" class="${activePage === 'project-manage' ? 'active' : ''}">项目管理</a>
      <a data-page="user-manage" class="${activePage === 'user-manage' ? 'active' : ''}">用户管理</a>
    `;
  } else {
    navItems = `
      <a data-page="timesheet" class="${activePage === 'timesheet' ? 'active' : ''}">工时填报</a>
      <a data-page="my-stats" class="${activePage === 'my-stats' ? 'active' : ''}">我的统计</a>
    `;
  }
  
  app.innerHTML = `
    <div class="layout">
      <div class="sidebar">
        <div class="sidebar-header">
          <h1>工时系统</h1>
        </div>
        <div class="sidebar-nav" id="sidebar-nav">
          ${navItems}
        </div>
      </div>
      <div class="main-content">
        <div class="topbar">
          <h2>${getPageTitle(activePage)}</h2>
          <div class="user-info">
            <span>欢迎，${escapeHtml(currentUser.name)} (${currentUser.role === 'admin' ? '管理员' : '成员'})</span>
            <button class="btn btn-secondary btn-sm" id="logout-btn">退出</button>
          </div>
        </div>
        <div id="page-content">${content}</div>
      </div>
    </div>
  `;

  document.querySelectorAll('#sidebar-nav a').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
    });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    currentUser = null;
    navigateTo('login');
  });
}

function getPageTitle(page) {
  const titles = {
    'timesheet': '工时填报',
    'my-stats': '我的统计',
    'admin-dashboard': '数据概览',
    'timesheet-review': '工时审核',
    'stats-project': '项目成本统计',
    'stats-member': '成员工时统计',
    'stats-task': '任务类型统计',
    'stats-utilization': '成员利用率',
    'stats-pending': '未审核工时列表',
    'project-manage': '项目管理',
    'user-manage': '用户管理'
  };
  return titles[page] || '';
}

function navigateTo(page) {
  currentPage = page;
  
  switch (page) {
    case 'login':
      renderLogin();
      break;
    case 'timesheet':
      renderTimesheet();
      break;
    case 'my-stats':
      renderMyStats();
      break;
    case 'admin-dashboard':
      renderAdminDashboard();
      break;
    case 'timesheet-review':
      renderTimesheetReview();
      break;
    case 'stats-project':
      renderStatsProject();
      break;
    case 'stats-member':
      renderStatsMember();
      break;
    case 'stats-task':
      renderStatsTask();
      break;
    case 'stats-utilization':
      renderStatsUtilization();
      break;
    case 'stats-pending':
      renderStatsPending();
      break;
    case 'project-manage':
      renderProjectManage();
      break;
    case 'user-manage':
      renderUserManage();
      break;
    default:
      renderTimesheet();
  }
}

async function loadProjects() {
  const data = await apiRequest('/projects');
  projects = data.projects;
}

async function renderTimesheet() {
  renderLayout('<div class="empty-state">加载中...</div>', 'timesheet');
  
  try {
    await loadProjects();
    
    const today = new Date().toISOString().split('T')[0];
    const entriesData = await apiRequest(`/timesheets?date=${today}`);
    const dailySummary = await apiRequest(`/timesheets/daily-summary?date=${today}`);
    
    const totalHours = dailySummary.total_hours;
    const maxHours = 12;
    const progressPercent = Math.min((totalHours / maxHours) * 100, 100);
    let progressClass = '';
    if (progressPercent > 90) progressClass = 'danger';
    else if (progressPercent > 70) progressClass = 'warning';
    
    const content = `
      <div class="card">
        <div class="section-title">
          <h3>今日工时 (${today})</h3>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary btn-sm" id="add-entry-btn">+ 添加工时</button>
            <button class="btn btn-secondary btn-sm" id="batch-entry-btn">+ 批量填报</button>
            <button class="btn btn-secondary btn-sm" id="copy-entry-btn">复制某日工时</button>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>已填报: <strong>${totalHours.toFixed(1)}</strong> / ${maxHours} 小时</span>
            <span>剩余: <strong>${(maxHours - totalHours).toFixed(1)}</strong> 小时</span>
          </div>
          <div class="hours-progress">
            <div class="hours-progress-bar ${progressClass}" style="width: ${progressPercent}%"></div>
          </div>
          ${totalHours >= maxHours ? '<div class="alert alert-warning" style="margin-top: 10px;">今日工时已达上限，无法继续填报</div>' : ''}
        </div>
        
        <div class="filter-bar">
          <div class="form-group">
            <label>选择日期</label>
            <input type="date" id="filter-date" value="${today}">
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>项目</th>
              <th>任务</th>
              <th>小时数</th>
              <th>备注</th>
              <th>状态</th>
              <th>审核意见</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="entries-tbody">
            ${entriesData.entries.length === 0 ? '<tr><td colspan="7" class="empty-state">暂无工时记录</td></tr>' : 
              entriesData.entries.map(entry => `
                <tr>
                  <td>${escapeHtml(entry.project_name)}</td>
                  <td>${escapeHtml(entry.task)}</td>
                  <td>${entry.hours}h</td>
                  <td>${escapeHtml(entry.remark || '-')}</td>
                  <td><span class="status-badge ${getStatusClass(entry.status)}">${getStatusText(entry.status)}</span></td>
                  <td>${entry.review_comment ? escapeHtml(entry.review_comment) : '-'}</td>
                  <td>
                    <div class="action-buttons">
                      ${entry.status === 'approved' ? 
                        '<span style="color: #999; font-size: 12px;">已锁定</span>' :
                        entry.status === 'rejected' ? `
                          <button class="btn btn-warning btn-sm resubmit-btn" data-id="${entry.id}">重新提交</button>
                          <button class="btn btn-secondary btn-sm edit-btn" data-id="${entry.id}">编辑</button>
                        ` : `
                          <button class="btn btn-secondary btn-sm edit-btn" data-id="${entry.id}">编辑</button>
                          <button class="btn btn-danger btn-sm delete-btn" data-id="${entry.id}">删除</button>
                        `
                      }
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      
      <div id="entry-modal"></div>
      <div id="batch-modal"></div>
      <div id="copy-modal"></div>
    `;
    
    renderLayout(content, 'timesheet');
    
    document.getElementById('add-entry-btn').addEventListener('click', () => {
      showEntryModal();
    });
    
    document.getElementById('batch-entry-btn').addEventListener('click', () => {
      showBatchModal();
    });
    
    document.getElementById('copy-entry-btn').addEventListener('click', () => {
      showCopyModal();
    });
    
    document.getElementById('filter-date').addEventListener('change', async (e) => {
      const date = e.target.value;
      const entriesData = await apiRequest(`/timesheets?date=${date}`);
      const dailySummary = await apiRequest(`/timesheets/daily-summary?date=${date}`);
      
      const totalHours = dailySummary.total_hours;
      const progressPercent = Math.min((totalHours / maxHours) * 100, 100);
      let progressClass = '';
      if (progressPercent > 90) progressClass = 'danger';
      else if (progressPercent > 70) progressClass = 'warning';
      
      const tbody = document.getElementById('entries-tbody');
      tbody.innerHTML = entriesData.entries.length === 0 ? 
        '<tr><td colspan="7" class="empty-state">暂无工时记录</td></tr>' : 
        entriesData.entries.map(entry => `
          <tr>
            <td>${escapeHtml(entry.project_name)}</td>
            <td>${escapeHtml(entry.task)}</td>
            <td>${entry.hours}h</td>
            <td>${escapeHtml(entry.remark || '-')}</td>
            <td><span class="status-badge ${getStatusClass(entry.status)}">${getStatusText(entry.status)}</span></td>
            <td>${entry.review_comment ? escapeHtml(entry.review_comment) : '-'}</td>
            <td>
              <div class="action-buttons">
                ${entry.status === 'approved' ? 
                  '<span style="color: #999; font-size: 12px;">已锁定</span>' :
                  entry.status === 'rejected' ? `
                    <button class="btn btn-warning btn-sm resubmit-btn" data-id="${entry.id}">重新提交</button>
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${entry.id}">编辑</button>
                  ` : `
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${entry.id}">编辑</button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${entry.id}">删除</button>
                  `
                }
              </div>
            </td>
          </tr>
        `).join('');
      
      bindEntryActions();
    });
    
    bindEntryActions();
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindEntryActions() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const entry = timesheets.find(e => e.id == id) || 
        (await apiRequest(`/timesheets?id=${id}`)).entries[0];
      showEntryModal(entry);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要删除这条工时记录吗？')) {
        try {
          const id = btn.dataset.id;
          await apiRequest(`/timesheets/${id}`, { method: 'DELETE' });
          showToast('删除成功', 'success');
          renderTimesheet();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  document.querySelectorAll('.resubmit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要重新提交这条工时记录吗？')) {
        try {
          const id = btn.dataset.id;
          await apiRequest(`/timesheets/${id}/resubmit`, { method: 'POST' });
          showToast('重新提交成功', 'success');
          renderTimesheet();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function showEntryModal(entry = null) {
  const isEdit = !!entry;
  const today = document.getElementById('filter-date')?.value || new Date().toISOString().split('T')[0];
  
  const modal = document.getElementById('entry-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <h3>${isEdit ? '编辑工时' : '添加工时'}</h3>
        <div id="modal-error"></div>
        <form id="entry-form">
          <div class="form-group">
            <label>项目 *</label>
            <select id="entry-project" required>
              <option value="">请选择项目</option>
              ${projects.map(p => `<option value="${p.id}" ${entry && entry.project_id == p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>任务 *</label>
            <input type="text" id="entry-task" value="${entry ? escapeHtml(entry.task) : ''}" required>
          </div>
          <div class="form-group">
            <label>小时数 *</label>
            <input type="number" id="entry-hours" step="0.5" min="0.5" max="12" value="${entry ? entry.hours : ''}" required>
          </div>
          <div class="form-group">
            <label>日期 *</label>
            <input type="date" id="entry-date" value="${entry ? entry.date : today}" required>
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea id="entry-remark" rows="3">${entry ? escapeHtml(entry.remark || '') : ''}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="modal-cancel">取消</button>
            <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '提交'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('modal-cancel').addEventListener('click', () => {
    modal.innerHTML = '';
  });
  
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      modal.innerHTML = '';
    }
  });
  
  document.getElementById('entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const project_id = document.getElementById('entry-project').value;
    const task = document.getElementById('entry-task').value;
    const hours = parseFloat(document.getElementById('entry-hours').value);
    const date = document.getElementById('entry-date').value;
    const remark = document.getElementById('entry-remark').value;
    
    try {
      if (isEdit) {
        await apiRequest(`/timesheets/${entry.id}`, {
          method: 'PUT',
          body: { project_id, task, hours, date, remark }
        });
        showToast('修改成功', 'success');
      } else {
        await apiRequest('/timesheets', {
          method: 'POST',
          body: { project_id, task, hours, date, remark }
        });
        showToast('提交成功', 'success');
      }
      
      modal.innerHTML = '';
      renderTimesheet();
    } catch (err) {
      document.getElementById('modal-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

function showBatchModal() {
  const today = document.getElementById('filter-date')?.value || new Date().toISOString().split('T')[0];
  batchEntries = [];
  
  const modal = document.getElementById('batch-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="batch-modal-overlay">
      <div class="modal" style="width: 700px;">
        <h3>批量填报工时</h3>
        <div id="batch-modal-error"></div>
        <div class="form-group">
          <label>日期 *</label>
          <input type="date" id="batch-date" value="${today}" required>
        </div>
        <div style="margin-bottom: 15px;">
          <button type="button" class="btn btn-secondary btn-sm" id="add-batch-line">+ 添加一行</button>
          <span style="margin-left: 10px; color: #666; font-size: 12px;">当前共 <span id="batch-count">0</span> 条，合计 <span id="batch-total">0</span> 小时</span>
        </div>
        <table style="margin-bottom: 20px;">
          <thead>
            <tr>
              <th>项目 *</th>
              <th>任务 *</th>
              <th>小时数 *</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="batch-tbody">
          </tbody>
        </table>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="batch-cancel">取消</button>
          <button type="button" class="btn btn-primary" id="batch-submit">提交全部</button>
        </div>
      </div>
    </div>
  `;
  
  function addBatchLine() {
    const tbody = document.getElementById('batch-tbody');
    const idx = tbody.children.length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select class="batch-project" required>
          <option value="">请选择</option>
          ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" class="batch-task" placeholder="任务名称" required></td>
      <td><input type="number" class="batch-hours" step="0.5" min="0.5" max="12" placeholder="小时数" style="width: 100px;" required></td>
      <td><input type="text" class="batch-remark" placeholder="备注（选填）"></td>
      <td><button type="button" class="btn btn-danger btn-sm batch-remove">删除</button></td>
    `;
    tbody.appendChild(tr);
    
    tr.querySelector('.batch-remove').addEventListener('click', () => {
      tr.remove();
      updateBatchSummary();
    });
    
    tr.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', updateBatchSummary);
      el.addEventListener('input', updateBatchSummary);
    });
    
    updateBatchSummary();
  }
  
  function updateBatchSummary() {
    const trs = document.querySelectorAll('#batch-tbody tr');
    let total = 0;
    trs.forEach(tr => {
      const h = parseFloat(tr.querySelector('.batch-hours').value) || 0;
      total += h;
    });
    document.getElementById('batch-count').textContent = trs.length;
    document.getElementById('batch-total').textContent = total.toFixed(1);
  }
  
  document.getElementById('add-batch-line').addEventListener('click', addBatchLine);
  
  document.getElementById('batch-cancel').addEventListener('click', () => {
    modal.innerHTML = '';
  });
  
  document.getElementById('batch-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'batch-modal-overlay') {
      modal.innerHTML = '';
    }
  });
  
  document.getElementById('batch-submit').addEventListener('click', async () => {
    try {
      const date = document.getElementById('batch-date').value;
      const trs = document.querySelectorAll('#batch-tbody tr');
      const entries = [];
      
      trs.forEach((tr, idx) => {
        const project_id = tr.querySelector('.batch-project').value;
        const task = tr.querySelector('.batch-task').value;
        const hours = tr.querySelector('.batch-hours').value;
        const remark = tr.querySelector('.batch-remark').value;
        
        if (!project_id || !task || !hours) {
          throw new Error(`第 ${idx + 1} 行缺少必填字段`);
        }
        
        entries.push({ project_id, task, hours, remark });
      });
      
      if (entries.length === 0) {
        throw new Error('请至少添加一条工时记录');
      }
      
      const result = await apiRequest('/timesheets/batch', {
        method: 'POST',
        body: { entries, date }
      });
      
      showToast(`批量提交成功，共 ${result.count} 条`, 'success');
      modal.innerHTML = '';
      renderTimesheet();
    } catch (err) {
      document.getElementById('batch-modal-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
  
  addBatchLine();
}

function showCopyModal() {
  const today = document.getElementById('filter-date')?.value || new Date().toISOString().split('T')[0];
  
  const modal = document.getElementById('copy-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="copy-modal-overlay">
      <div class="modal">
        <h3>复制工时</h3>
        <div id="copy-modal-error"></div>
        <div class="form-group">
          <label>源日期 *</label>
          <input type="date" id="copy-from" required>
        </div>
        <div class="form-group">
          <label>目标日期 *</label>
          <input type="date" id="copy-to" value="${today}" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="copy-cancel">取消</button>
          <button type="button" class="btn btn-primary" id="copy-submit">复制</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('copy-cancel').addEventListener('click', () => {
    modal.innerHTML = '';
  });
  
  document.getElementById('copy-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'copy-modal-overlay') {
      modal.innerHTML = '';
    }
  });
  
  document.getElementById('copy-submit').addEventListener('click', async () => {
    try {
      const fromDate = document.getElementById('copy-from').value;
      const toDate = document.getElementById('copy-to').value;
      
      if (!fromDate || !toDate) {
        throw new Error('请选择源日期和目标日期');
      }
      
      const result = await apiRequest('/timesheets/copy', {
        method: 'POST',
        body: { fromDate, toDate }
      });
      
      showToast(`复制成功，共 ${result.count} 条`, 'success');
      modal.innerHTML = '';
      renderTimesheet();
    } catch (err) {
      document.getElementById('copy-modal-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

async function renderMyStats() {
  renderLayout('<div class="empty-state">加载中...</div>', 'my-stats');
  
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const entriesData = await apiRequest(`/timesheets?startDate=${firstDay}&endDate=${lastDay}&status=approved`);
    
    const byProject = {};
    let totalHours = 0;
    let totalCost = 0;
    
    entriesData.entries.forEach(entry => {
      if (!byProject[entry.project_id]) {
        byProject[entry.project_id] = {
          project_name: entry.project_name,
          hours: 0,
          cost: 0
        };
      }
      byProject[entry.project_id].hours += entry.hours;
      byProject[entry.project_id].cost += entry.hours * currentUser.hourly_rate;
      totalHours += entry.hours;
      totalCost += entry.hours * currentUser.hourly_rate;
    });
    
    const content = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalHours.toFixed(1)}h</div>
          <div class="stat-label">本月已审核工时</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-success">${formatMoney(totalCost)}</div>
          <div class="stat-label">本月人力成本</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-primary">${formatMoney(currentUser.hourly_rate)}/h</div>
          <div class="stat-label">我的时薪</div>
        </div>
      </div>
      
      <div class="card">
        <h3>按项目统计 (本月)</h3>
        <table>
          <thead>
            <tr>
              <th>项目名称</th>
              <th>工时</th>
              <th>成本</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(byProject).length === 0 ? 
              '<tr><td colspan="3" class="empty-state">暂无数据</td></tr>' :
              Object.values(byProject).map(item => `
                <tr>
                  <td>${escapeHtml(item.project_name)}</td>
                  <td>${item.hours.toFixed(1)}h</td>
                  <td>${formatMoney(item.cost)}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
    
    renderLayout(content, 'my-stats');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderAdminDashboard() {
  renderLayout('<div class="empty-state">加载中...</div>', 'admin-dashboard');
  
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const statsData = await apiRequest(`/stats/summary?startDate=${firstDay}&endDate=${lastDay}`);
    const summary = statsData.summary;
    
    const projectStats = await apiRequest(`/stats/by-project?startDate=${firstDay}&endDate=${lastDay}`);
    const memberStats = await apiRequest(`/stats/by-member?startDate=${firstDay}&endDate=${lastDay}`);
    
    const content = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${summary.total_approved_hours.toFixed(1)}h</div>
          <div class="stat-label">本月已审核工时</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-success">${formatMoney(summary.total_cost)}</div>
          <div class="stat-label">本月总成本</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-primary">${summary.pending_count}</div>
          <div class="stat-label">待审核记录</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.project_count}</div>
          <div class="stat-label">进行中项目</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.member_count}</div>
          <div class="stat-label">团队成员</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="card">
          <h3>项目成本排行 (本月)</h3>
          <table>
            <thead>
              <tr>
                <th>项目</th>
                <th>工时</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              ${projectStats.stats.slice(0, 5).map(s => `
                <tr>
                  <td>${escapeHtml(s.project_name)}</td>
                  <td>${s.total_hours.toFixed(1)}h</td>
                  <td class="text-danger">${formatMoney(s.total_cost)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="card">
          <h3>成员工时排行 (本月)</h3>
          <table>
            <thead>
              <tr>
                <th>成员</th>
                <th>工时</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              ${memberStats.stats.slice(0, 5).map(s => `
                <tr>
                  <td>${escapeHtml(s.user_name)}</td>
                  <td>${s.total_hours.toFixed(1)}h</td>
                  <td class="text-danger">${formatMoney(s.total_cost)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    renderLayout(content, 'admin-dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderTimesheetReview() {
  renderLayout('<div class="empty-state">加载中...</div>', 'timesheet-review');
  
  try {
    await loadProjects();
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const entriesData = await apiRequest(`/timesheets?startDate=${firstDay}&endDate=${lastDay}&status=pending`);
    timesheets = entriesData.entries;
    
    const content = `
      <div class="card">
        <div class="filter-bar">
          <div class="form-group">
            <label>项目</label>
            <select id="filter-project">
              <option value="">全部项目</option>
              ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select id="filter-status">
              <option value="pending" selected>待审核</option>
              <option value="approved">已审核</option>
              <option value="rejected">已驳回</option>
              <option value="">全部</option>
            </select>
          </div>
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" id="filter-start" value="${firstDay}">
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" id="filter-end" value="${lastDay}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" id="filter-btn">查询</button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>成员</th>
              <th>项目</th>
              <th>任务</th>
              <th>小时数</th>
              <th>备注</th>
              <th>状态</th>
              <th>审核意见</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="review-tbody">
            ${timesheets.length === 0 ? 
              '<tr><td colspan="9" class="empty-state">暂无记录</td></tr>' :
              timesheets.map(entry => `
                <tr>
                  <td>${entry.date}</td>
                  <td>${escapeHtml(entry.user_name)}</td>
                  <td>${escapeHtml(entry.project_name)}</td>
                  <td>${escapeHtml(entry.task)}</td>
                  <td>${entry.hours}h</td>
                  <td>${escapeHtml(entry.remark || '-')}</td>
                  <td><span class="status-badge ${getStatusClass(entry.status)}">${getStatusText(entry.status)}</span></td>
                  <td>${entry.review_comment ? escapeHtml(entry.review_comment) : '-'}</td>
                  <td>
                    <div class="action-buttons">
                      ${entry.status === 'pending' ? `
                        <button class="btn btn-success btn-sm approve-btn" data-id="${entry.id}">通过</button>
                        <button class="btn btn-danger btn-sm reject-btn" data-id="${entry.id}">驳回</button>
                      ` : entry.status === 'approved' ? 
                        '<span style="color: #999; font-size: 12px;">已锁定</span>' :
                        '<span style="color: #999; font-size: 12px;">已驳回</span>'
                      }
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      <div id="review-modal"></div>
    `;
    
    renderLayout(content, 'timesheet-review');
    
    document.getElementById('filter-btn').addEventListener('click', loadReviewEntries);
    bindReviewActions();
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadReviewEntries() {
  const project_id = document.getElementById('filter-project').value;
  const status = document.getElementById('filter-status').value;
  const startDate = document.getElementById('filter-start').value;
  const endDate = document.getElementById('filter-end').value;
  
  let params = [];
  if (project_id) params.push(`project_id=${project_id}`);
  if (status) params.push(`status=${status}`);
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  const url = '/timesheets' + (params.length ? '?' + params.join('&') : '');
  
  try {
    const data = await apiRequest(url);
    timesheets = data.entries;
    
    const tbody = document.getElementById('review-tbody');
    tbody.innerHTML = timesheets.length === 0 ? 
      '<tr><td colspan="9" class="empty-state">暂无记录</td></tr>' :
      timesheets.map(entry => `
        <tr>
          <td>${entry.date}</td>
          <td>${escapeHtml(entry.user_name)}</td>
          <td>${escapeHtml(entry.project_name)}</td>
          <td>${escapeHtml(entry.task)}</td>
          <td>${entry.hours}h</td>
          <td>${escapeHtml(entry.remark || '-')}</td>
          <td><span class="status-badge ${getStatusClass(entry.status)}">${getStatusText(entry.status)}</span></td>
          <td>${entry.review_comment ? escapeHtml(entry.review_comment) : '-'}</td>
          <td>
            <div class="action-buttons">
              ${entry.status === 'pending' ? `
                <button class="btn btn-success btn-sm approve-btn" data-id="${entry.id}">通过</button>
                <button class="btn btn-danger btn-sm reject-btn" data-id="${entry.id}">驳回</button>
              ` : entry.status === 'approved' ? 
                '<span style="color: #999; font-size: 12px;">已锁定</span>' :
                '<span style="color: #999; font-size: 12px;">已驳回</span>'
              }
            </div>
          </td>
        </tr>
      `).join('');
    
    bindReviewActions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showReviewModal(entryId, action) {
  const isApprove = action === 'approve';
  const modal = document.getElementById('review-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="review-modal-overlay">
      <div class="modal">
        <h3>${isApprove ? '审核通过' : '审核驳回'}</h3>
        <div id="review-modal-error"></div>
        <div class="form-group">
          <label>审核意见</label>
          <textarea id="review-comment" rows="4" placeholder="请输入审核意见..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="review-cancel">取消</button>
          <button type="button" class="btn ${isApprove ? 'btn-success' : 'btn-danger'}" id="review-confirm">${isApprove ? '通过' : '驳回'}</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('review-cancel').addEventListener('click', () => {
    modal.innerHTML = '';
  });
  
  document.getElementById('review-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'review-modal-overlay') {
      modal.innerHTML = '';
    }
  });
  
  document.getElementById('review-confirm').addEventListener('click', async () => {
    try {
      const comment = document.getElementById('review-comment').value;
      await apiRequest(`/timesheets/${entryId}/${action}`, {
        method: 'POST',
        body: { comment }
      });
      showToast(isApprove ? '审核通过' : '已驳回', 'success');
      modal.innerHTML = '';
      loadReviewEntries();
    } catch (err) {
      document.getElementById('review-modal-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

function bindReviewActions() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showReviewModal(btn.dataset.id, 'approve');
    });
  });
  
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showReviewModal(btn.dataset.id, 'reject');
    });
  });
}

async function renderStatsProject() {
  renderLayout('<div class="empty-state">加载中...</div>', 'stats-project');
  
  try {
    await loadProjects();
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const data = await apiRequest(`/stats/by-project?startDate=${firstDay}&endDate=${lastDay}`);
    
    const content = `
      <div class="card">
        <div class="section-title">
          <h3>项目成本统计</h3>
          <button class="btn btn-secondary btn-sm" id="export-csv-btn">导出 CSV</button>
        </div>
        <div class="filter-bar">
          <div class="form-group">
            <label>项目</label>
            <select id="filter-project">
              <option value="">全部项目</option>
              ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" id="filter-start" value="${firstDay}">
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" id="filter-end" value="${lastDay}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" id="filter-btn">统计</button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>项目名称</th>
              <th>参与人数</th>
              <th>记录数</th>
              <th>总工时</th>
              <th>总成本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="stats-tbody">
            ${data.stats.length === 0 ? 
              '<tr><td colspan="6" class="empty-state">暂无数据</td></tr>' :
              data.stats.map(stat => `
                <tr>
                  <td>${escapeHtml(stat.project_name)}</td>
                  <td>${stat.member_count}</td>
                  <td>${stat.entry_count}</td>
                  <td>${stat.total_hours.toFixed(1)}h</td>
                  <td class="text-danger"><strong>${formatMoney(stat.total_cost)}</strong></td>
                  <td><button class="btn btn-secondary btn-sm detail-btn" data-id="${stat.project_id}">详情</button></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      
      <div id="detail-modal"></div>
    `;
    
    renderLayout(content, 'stats-project');
    
    document.getElementById('filter-btn').addEventListener('click', loadProjectStats);
    document.getElementById('export-csv-btn').addEventListener('click', exportProjectCsv);
    bindDetailActions();
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function getFilterParams() {
  const project_id = document.getElementById('filter-project')?.value;
  const startDate = document.getElementById('filter-start')?.value;
  const endDate = document.getElementById('filter-end')?.value;
  
  let params = [];
  if (project_id) params.push(`project_id=${project_id}`);
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  return params;
}

async function loadProjectStats() {
  const params = getFilterParams();
  const url = '/stats/by-project' + (params.length ? '?' + params.join('&') : '');
  
  try {
    const data = await apiRequest(url);
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = data.stats.length === 0 ? 
      '<tr><td colspan="6" class="empty-state">暂无数据</td></tr>' :
      data.stats.map(stat => `
        <tr>
          <td>${escapeHtml(stat.project_name)}</td>
          <td>${stat.member_count}</td>
          <td>${stat.entry_count}</td>
          <td>${stat.total_hours.toFixed(1)}h</td>
          <td class="text-danger"><strong>${formatMoney(stat.total_cost)}</strong></td>
          <td><button class="btn btn-secondary btn-sm detail-btn" data-id="${stat.project_id}">详情</button></td>
        </tr>
      `).join('');
    
    bindDetailActions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function exportProjectCsv() {
  try {
    const params = getFilterParams();
    const url = API_BASE + '/stats/export/by-project.csv' + (params.length ? '?' + params.join('&') : '');
    window.location.href = url;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindDetailActions() {
  document.querySelectorAll('.detail-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const projectId = btn.dataset.id;
      const startDate = document.getElementById('filter-start').value;
      const endDate = document.getElementById('filter-end').value;
      
      try {
        const data = await apiRequest(`/stats/project-detail/${projectId}?startDate=${startDate}&endDate=${endDate}`);
        
        const modal = document.getElementById('detail-modal');
        modal.innerHTML = `
          <div class="modal-overlay" id="modal-overlay">
            <div class="modal" style="width: 600px;">
              <h3>${escapeHtml(data.project.name)} - 成员明细</h3>
              <table>
                <thead>
                  <tr>
                    <th>成员</th>
                    <th>时薪</th>
                    <th>工时</th>
                    <th>成本</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.details.length === 0 ? 
                    '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>' :
                    data.details.map(d => `
                      <tr>
                        <td>${escapeHtml(d.user_name)}</td>
                        <td>${formatMoney(d.hourly_rate)}/h</td>
                        <td>${d.total_hours.toFixed(1)}h</td>
                        <td class="text-danger">${formatMoney(d.total_cost)}</td>
                      </tr>
                    `).join('')
                  }
                </tbody>
              </table>
              <div class="modal-actions">
                <button class="btn btn-secondary" id="modal-close">关闭</button>
              </div>
            </div>
          </div>
        `;
        
        document.getElementById('modal-close').addEventListener('click', () => {
          modal.innerHTML = '';
        });
        
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
          if (e.target.id === 'modal-overlay') {
            modal.innerHTML = '';
          }
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function renderStatsMember() {
  renderLayout('<div class="empty-state">加载中...</div>', 'stats-member');
  
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const data = await apiRequest(`/stats/by-member?startDate=${firstDay}&endDate=${lastDay}`);
    
    const content = `
      <div class="card">
        <div class="section-title">
          <h3>成员工时统计</h3>
          <button class="btn btn-secondary btn-sm" id="export-csv-btn">导出 CSV</button>
        </div>
        <div class="filter-bar">
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" id="filter-start" value="${firstDay}">
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" id="filter-end" value="${lastDay}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" id="filter-btn">统计</button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>成员名称</th>
              <th>时薪</th>
              <th>记录数</th>
              <th>总工时</th>
              <th>总成本</th>
            </tr>
          </thead>
          <tbody id="stats-tbody">
            ${data.stats.length === 0 ? 
              '<tr><td colspan="5" class="empty-state">暂无数据</td></tr>' :
              data.stats.map(stat => `
                <tr>
                  <td>${escapeHtml(stat.user_name)}</td>
                  <td>${formatMoney(stat.hourly_rate)}/h</td>
                  <td>${stat.entry_count}</td>
                  <td>${stat.total_hours.toFixed(1)}h</td>
                  <td class="text-danger"><strong>${formatMoney(stat.total_cost)}</strong></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
    
    renderLayout(content, 'stats-member');
    
    document.getElementById('filter-btn').addEventListener('click', loadMemberStats);
    document.getElementById('export-csv-btn').addEventListener('click', exportMemberCsv);
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMemberStats() {
  const startDate = document.getElementById('filter-start').value;
  const endDate = document.getElementById('filter-end').value;
  
  let params = [];
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  const url = '/stats/by-member' + (params.length ? '?' + params.join('&') : '');
  
  try {
    const data = await apiRequest(url);
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = data.stats.length === 0 ? 
      '<tr><td colspan="5" class="empty-state">暂无数据</td></tr>' :
      data.stats.map(stat => `
        <tr>
          <td>${escapeHtml(stat.user_name)}</td>
          <td>${formatMoney(stat.hourly_rate)}/h</td>
          <td>${stat.entry_count}</td>
          <td>${stat.total_hours.toFixed(1)}h</td>
          <td class="text-danger"><strong>${formatMoney(stat.total_cost)}</strong></td>
        </tr>
      `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function exportMemberCsv() {
  try {
    const startDate = document.getElementById('filter-start').value;
    const endDate = document.getElementById('filter-end').value;
    
    let params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    
    const url = API_BASE + '/stats/export/by-member.csv' + (params.length ? '?' + params.join('&') : '');
    window.location.href = url;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderStatsTask() {
  renderLayout('<div class="empty-state">加载中...</div>', 'stats-task');
  
  try {
    await loadProjects();
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const data = await apiRequest(`/stats/by-task?startDate=${firstDay}&endDate=${lastDay}`);
    
    const content = `
      <div class="card">
        <h3>任务类型统计</h3>
        <div class="filter-bar">
          <div class="form-group">
            <label>项目</label>
            <select id="filter-project">
              <option value="">全部项目</option>
              ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" id="filter-start" value="${firstDay}">
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" id="filter-end" value="${lastDay}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" id="filter-btn">统计</button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>任务类型</th>
              <th>记录数</th>
              <th>总工时</th>
              <th>总成本</th>
            </tr>
          </thead>
          <tbody id="stats-tbody">
            ${data.stats.length === 0 ? 
              '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>' :
              data.stats.map(stat => `
                <tr>
                  <td>${escapeHtml(stat.task_name)}</td>
                  <td>${stat.entry_count}</td>
                  <td>${stat.total_hours.toFixed(1)}h</td>
                  <td class="text-danger"><strong>${formatMoney(stat.total_cost)}</strong></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
    
    renderLayout(content, 'stats-task');
    
    document.getElementById('filter-btn').addEventListener('click', loadTaskStats);
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadTaskStats() {
  const project_id = document.getElementById('filter-project').value;
  const startDate = document.getElementById('filter-start').value;
  const endDate = document.getElementById('filter-end').value;
  
  let params = [];
  if (project_id) params.push(`project_id=${project_id}`);
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  const url = '/stats/by-task' + (params.length ? '?' + params.join('&') : '');
  
  try {
    const data = await apiRequest(url);
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = data.stats.length === 0 ? 
      '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>' :
      data.stats.map(stat => `
        <tr>
          <td>${escapeHtml(stat.task_name)}</td>
          <td>${stat.entry_count}</td>
          <td>${stat.total_hours.toFixed(1)}h</td>
          <td class="text-danger"><strong>${formatMoney(stat.total_cost)}</strong></td>
        </tr>
      `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderStatsUtilization() {
  renderLayout('<div class="empty-state">加载中...</div>', 'stats-utilization');
  
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const data = await apiRequest(`/stats/utilization?startDate=${firstDay}&endDate=${lastDay}`);
    
    const content = `
      <div class="card">
        <h3>成员利用率统计</h3>
        <div style="margin-bottom: 15px; color: #666;">
          统计周期内工作日: <strong>${data.weekdays}</strong> 天，标准工时: <strong>${data.standard_total_hours}</strong> 小时 (每天 8 小时)
        </div>
        <div class="filter-bar">
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" id="filter-start" value="${firstDay}">
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" id="filter-end" value="${lastDay}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" id="filter-btn">统计</button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>成员名称</th>
              <th>已审核工时</th>
              <th>标准工时</th>
              <th>利用率</th>
            </tr>
          </thead>
          <tbody id="stats-tbody">
            ${data.stats.length === 0 ? 
              '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>' :
              data.stats.map(stat => `
                <tr>
                  <td>${escapeHtml(stat.user_name)}</td>
                  <td>${stat.approved_hours.toFixed(1)}h</td>
                  <td>${stat.standard_hours}h</td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${Math.min(stat.utilization_rate, 100)}%; background: ${stat.utilization_rate > 100 ? '#e74c3c' : stat.utilization_rate > 80 ? '#27ae60' : '#f39c12'};"></div>
                      </div>
                      <span style="min-width: 60px; text-align: right;">${stat.utilization_rate.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
    
    renderLayout(content, 'stats-utilization');
    
    document.getElementById('filter-btn').addEventListener('click', loadUtilizationStats);
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadUtilizationStats() {
  const startDate = document.getElementById('filter-start').value;
  const endDate = document.getElementById('filter-end').value;
  
  let params = [];
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  const url = '/stats/utilization' + (params.length ? '?' + params.join('&') : '');
  
  try {
    const data = await apiRequest(url);
    const tbody = document.getElementById('stats-tbody');
    
    tbody.innerHTML = data.stats.length === 0 ? 
      '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>' :
      data.stats.map(stat => `
        <tr>
          <td>${escapeHtml(stat.user_name)}</td>
          <td>${stat.approved_hours.toFixed(1)}h</td>
          <td>${stat.standard_hours}h</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(stat.utilization_rate, 100)}%; background: ${stat.utilization_rate > 100 ? '#e74c3c' : stat.utilization_rate > 80 ? '#27ae60' : '#f39c12'};"></div>
              </div>
              <span style="min-width: 60px; text-align: right;">${stat.utilization_rate.toFixed(1)}%</span>
            </div>
          </td>
        </tr>
      `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderStatsPending() {
  renderLayout('<div class="empty-state">加载中...</div>', 'stats-pending');
  
  try {
    await loadProjects();
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const data = await apiRequest(`/stats/pending?startDate=${firstDay}&endDate=${lastDay}`);
    
    const content = `
      <div class="card">
        <div class="section-title">
          <h3>未审核工时列表</h3>
          <span style="color: #666;">共 ${data.count} 条，合计 ${data.total_hours.toFixed(1)} 小时</span>
        </div>
        <div class="filter-bar">
          <div class="form-group">
            <label>项目</label>
            <select id="filter-project">
              <option value="">全部项目</option>
              ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" id="filter-start" value="${firstDay}">
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" id="filter-end" value="${lastDay}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" id="filter-btn">查询</button>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>成员</th>
              <th>项目</th>
              <th>任务</th>
              <th>小时数</th>
              <th>备注</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody id="pending-tbody">
            ${data.entries.length === 0 ? 
              '<tr><td colspan="7" class="empty-state">暂无待审核记录</td></tr>' :
              data.entries.map(entry => `
                <tr>
                  <td>${entry.date}</td>
                  <td>${escapeHtml(entry.user_name)}</td>
                  <td>${escapeHtml(entry.project_name)}</td>
                  <td>${escapeHtml(entry.task)}</td>
                  <td>${entry.hours}h</td>
                  <td>${escapeHtml(entry.remark || '-')}</td>
                  <td><span class="status-badge status-pending">待审核</span></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
    
    renderLayout(content, 'stats-pending');
    
    document.getElementById('filter-btn').addEventListener('click', loadPendingList);
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadPendingList() {
  const project_id = document.getElementById('filter-project').value;
  const startDate = document.getElementById('filter-start').value;
  const endDate = document.getElementById('filter-end').value;
  
  let params = [];
  if (project_id) params.push(`project_id=${project_id}`);
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  const url = '/stats/pending' + (params.length ? '?' + params.join('&') : '');
  
  try {
    const data = await apiRequest(url);
    const tbody = document.getElementById('pending-tbody');
    tbody.innerHTML = data.entries.length === 0 ? 
      '<tr><td colspan="7" class="empty-state">暂无待审核记录</td></tr>' :
      data.entries.map(entry => `
        <tr>
          <td>${entry.date}</td>
          <td>${escapeHtml(entry.user_name)}</td>
          <td>${escapeHtml(entry.project_name)}</td>
          <td>${escapeHtml(entry.task)}</td>
          <td>${entry.hours}h</td>
          <td>${escapeHtml(entry.remark || '-')}</td>
          <td><span class="status-badge status-pending">待审核</span></td>
        </tr>
      `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderProjectManage() {
  renderLayout('<div class="empty-state">加载中...</div>', 'project-manage');
  
  try {
    await loadProjects();
    
    const content = `
      <div class="card">
        <div class="section-title">
          <h3>项目列表</h3>
          <button class="btn btn-primary" id="add-project-btn">+ 新建项目</button>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>项目名称</th>
              <th>描述</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="project-tbody">
            ${projects.length === 0 ? 
              '<tr><td colspan="6" class="empty-state">暂无项目</td></tr>' :
              projects.map(p => `
                <tr>
                  <td>${p.id}</td>
                  <td>${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(p.description || '-')}</td>
                  <td>${p.status === 'active' ? '<span class="text-success">进行中</span>' : '<span class="text-danger">已完成</span>'}</td>
                  <td>${p.created_at}</td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-secondary btn-sm edit-project-btn" data-id="${p.id}">编辑</button>
                      <button class="btn btn-danger btn-sm delete-project-btn" data-id="${p.id}">删除</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      
      <div id="project-modal"></div>
    `;
    
    renderLayout(content, 'project-manage');
    
    document.getElementById('add-project-btn').addEventListener('click', () => {
      showProjectModal();
    });
    
    bindProjectActions();
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindProjectActions() {
  document.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const project = projects.find(p => p.id == id);
      showProjectModal(project);
    });
  });
  
  document.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要删除这个项目吗？')) {
        try {
          const id = btn.dataset.id;
          await apiRequest(`/projects/${id}`, { method: 'DELETE' });
          showToast('删除成功', 'success');
          renderProjectManage();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function showProjectModal(project = null) {
  const isEdit = !!project;
  
  const modal = document.getElementById('project-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <h3>${isEdit ? '编辑项目' : '新建项目'}</h3>
        <div id="modal-error"></div>
        <form id="project-form">
          <div class="form-group">
            <label>项目名称 *</label>
            <input type="text" id="project-name" value="${project ? escapeHtml(project.name) : ''}" required>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea id="project-desc" rows="3">${project ? escapeHtml(project.description || '') : ''}</textarea>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select id="project-status">
              <option value="active" ${project && project.status === 'active' ? 'selected' : ''}>进行中</option>
              <option value="completed" ${project && project.status === 'completed' ? 'selected' : ''}>已完成</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="modal-cancel">取消</button>
            <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('modal-cancel').addEventListener('click', () => {
    modal.innerHTML = '';
  });
  
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      modal.innerHTML = '';
    }
  });
  
  document.getElementById('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('project-name').value;
    const description = document.getElementById('project-desc').value;
    const status = document.getElementById('project-status').value;
    
    try {
      if (isEdit) {
        await apiRequest(`/projects/${project.id}`, {
          method: 'PUT',
          body: { name, description, status }
        });
        showToast('修改成功', 'success');
      } else {
        await apiRequest('/projects', {
          method: 'POST',
          body: { name, description, status }
        });
        showToast('创建成功', 'success');
      }
      
      modal.innerHTML = '';
      renderProjectManage();
    } catch (err) {
      document.getElementById('modal-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

async function renderUserManage() {
  renderLayout('<div class="empty-state">加载中...</div>', 'user-manage');
  
  try {
    const data = await apiRequest('/users');
    users = data.users;
    
    const content = `
      <div class="card">
        <div class="section-title">
          <h3>用户列表</h3>
          <button class="btn btn-primary" id="add-user-btn">+ 新建用户</button>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>姓名</th>
              <th>角色</th>
              <th>时薪</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="user-tbody">
            ${users.length === 0 ? 
              '<tr><td colspan="7" class="empty-state">暂无用户</td></tr>' :
              users.map(u => `
                <tr>
                  <td>${u.id}</td>
                  <td>${escapeHtml(u.username)}</td>
                  <td>${escapeHtml(u.name)}</td>
                  <td>${u.role === 'admin' ? '<span class="text-primary">管理员</span>' : '成员'}</td>
                  <td>${formatMoney(u.hourly_rate)}/h</td>
                  <td>${u.created_at}</td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-secondary btn-sm edit-user-btn" data-id="${u.id}">编辑</button>
                      <button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}">删除</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      
      <div id="user-modal"></div>
    `;
    
    renderLayout(content, 'user-manage');
    
    document.getElementById('add-user-btn').addEventListener('click', () => {
      showUserModal();
    });
    
    bindUserActions();
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindUserActions() {
  document.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const user = users.find(u => u.id == id);
      showUserModal(user);
    });
  });
  
  document.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要删除这个用户吗？')) {
        try {
          const id = btn.dataset.id;
          await apiRequest(`/users/${id}`, { method: 'DELETE' });
          showToast('删除成功', 'success');
          renderUserManage();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function showUserModal(user = null) {
  const isEdit = !!user;
  
  const modal = document.getElementById('user-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <h3>${isEdit ? '编辑用户' : '新建用户'}</h3>
        <div id="modal-error"></div>
        <form id="user-form">
          <div class="form-group">
            <label>用户名 *</label>
            <input type="text" id="user-username" value="${user ? escapeHtml(user.username) : ''}" ${isEdit ? 'disabled' : ''} required>
          </div>
          ${!isEdit ? `
          <div class="form-group">
            <label>密码 *</label>
            <input type="password" id="user-password" required>
          </div>
          ` : `
          <div class="form-group">
            <label>新密码 (留空则不修改)</label>
            <input type="password" id="user-password">
          </div>
          `}
          <div class="form-group">
            <label>姓名 *</label>
            <input type="text" id="user-name" value="${user ? escapeHtml(user.name) : ''}" required>
          </div>
          <div class="form-group">
            <label>角色</label>
            <select id="user-role">
              <option value="member" ${user && user.role === 'member' ? 'selected' : ''}>成员</option>
              <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>管理员</option>
            </select>
          </div>
          <div class="form-group">
            <label>时薪 (元/小时)</label>
            <input type="number" id="user-rate" step="1" min="0" value="${user ? user.hourly_rate : 0}">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="modal-cancel">取消</button>
            <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('modal-cancel').addEventListener('click', () => {
    modal.innerHTML = '';
  });
  
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      modal.innerHTML = '';
    }
  });
  
  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;
    const name = document.getElementById('user-name').value;
    const role = document.getElementById('user-role').value;
    const hourly_rate = parseFloat(document.getElementById('user-rate').value) || 0;
    
    try {
      if (isEdit) {
        const body = { name, role, hourly_rate };
        if (password) body.password = password;
        
        await apiRequest(`/users/${user.id}`, {
          method: 'PUT',
          body
        });
        showToast('修改成功', 'success');
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: { username, password, name, role, hourly_rate }
        });
        showToast('创建成功', 'success');
      }
      
      modal.innerHTML = '';
      renderUserManage();
    } catch (err) {
      document.getElementById('modal-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}

async function init() {
  const isLoggedIn = await checkAuth();
  
  if (isLoggedIn) {
    navigateTo(currentUser.role === 'admin' ? 'admin-dashboard' : 'timesheet');
  } else {
    navigateTo('login');
  }
}

init();
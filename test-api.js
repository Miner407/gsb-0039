const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 3099;
const DATA_DIR = path.join(__dirname, 'data');
const TEST_DB = path.join(DATA_DIR, 'timesheet_test.db');
const TEST_SESSIONS_DB = path.join(DATA_DIR, 'sessions_test.db');

let passed = 0;
let failed = 0;
let serverProcess = null;
let cookie = '';
let testResults = [];

function logTest(name, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL';
  const icon = ok ? '+' : '-';
  console.log(`  [${icon}] ${status} - ${name}${detail ? ' (' + detail + ')' : ''}`);
  testResults.push({ name, passed: ok, detail });
  if (ok) passed++;
  else failed++;
}

function assert(condition, testName, detail = '') {
  logTest(testName, condition, detail);
  return condition;
}

function request(method, urlPath, data = null, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      timeout: timeout
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.headers['set-cookie']) {
          cookie = res.headers['set-cookie'][0].split(';')[0];
        }
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, data: parsed, body: body });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanTestDB() {
  const files = [
    TEST_DB,
    TEST_SESSIONS_DB,
    TEST_DB + '-journal',
    TEST_SESSIONS_DB + '-journal'
  ];
  files.forEach(f => {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PORT: String(TEST_PORT),
      DB_NAME: 'timesheet_test.db',
      SESSION_DB_NAME: 'sessions_test.db',
      NODE_ENV: 'test'
    };

    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverReady = false;
    let output = '';

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('服务器运行在') && !serverReady) {
        serverReady = true;
        setTimeout(resolve, 300);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    serverProcess.on('error', reject);

    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('server start timeout: ' + output.slice(0, 500)));
      }
    }, 15000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess && serverProcess.pid) {
      serverProcess.kill('SIGTERM');
      serverProcess.on('close', () => {
        serverProcess = null;
        resolve();
      });
      setTimeout(() => {
        if (serverProcess) {
          try { serverProcess.kill('SIGKILL'); } catch {}
          serverProcess = null;
          resolve();
        }
      }, 3000);
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  工时系统 API 自动化测试');
  console.log('========================================\n');

  console.log('[准备阶段]');
  console.log('  清理测试数据库...');
  cleanTestDB();

  try {
    console.log('  启动测试服务器...');
    await startServer();
    console.log('  测试服务器已启动\n');

    await testAuth();
    await testTimesheetCRUD();
    await testBatchSubmit();
    await testCopyTimesheet();
    await testApproveReject();
    await testStats();
    await testCsvExport();
    await testGitignore();
    await testReadme();

  } catch (err) {
    console.error('\n测试执行出错:', err.message);
  } finally {
    console.log('\n[清理阶段]');
    console.log('  停止测试服务器...');
    await stopServer();

    console.log('  清理测试数据库...');
    cleanTestDB();

    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    console.log(`  通过: ${passed} 项`);
    console.log(`  失败: ${failed} 项`);
    console.log(`  总计: ${passed + failed} 项`);
    const rate = passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : '0.0';
    console.log(`  通过率: ${rate}%`);
    console.log('========================================');

    if (failed > 0) {
      console.log('\n失败的测试:');
      testResults.filter(r => !r.passed).forEach(r => {
        console.log(`  [FAIL] ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
      });
      process.exit(1);
    } else {
      console.log('\n所有测试通过!');
      process.exit(0);
    }
  }
}

async function testAuth() {
  console.log('[1] 认证模块测试');
  
  try {
    let res = await request('POST', '/api/auth/login', { username: 'zhangsan', password: '123456' });
    assert(res.status === 200 && res.data.success, '成员登录成功', 'status=' + res.status);
    
    res = await request('GET', '/api/auth/me');
    assert(res.status === 200 && res.data.user && res.data.user.role === 'member', '获取当前用户信息');
    
    res = await request('POST', '/api/auth/logout');
    assert(res.status === 200 && res.data.success, '成员登出成功');
    cookie = '';
    
    res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    assert(res.status === 200 && res.data.user && res.data.user.role === 'admin', '管理员登录成功');
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
    res = await request('POST', '/api/auth/login', { username: 'wrong', password: 'wrong' });
    assert(res.status === 401, '错误密码登录失败', 'status=' + res.status);
    
    res = await request('GET', '/api/projects');
    assert(res.status === 401, '未登录访问受保护接口被拒绝', 'status=' + res.status);
    
  } catch (err) {
    logTest('认证模块', false, err.message);
  }
  
  console.log('');
}

async function testTimesheetCRUD() {
  console.log('[2] 工时填报 CRUD 测试');
  
  try {
    cookie = '';
    let res = await request('POST', '/api/auth/login', { username: 'zhangsan', password: '123456' });
    
    res = await request('GET', '/api/projects');
    assert(res.status === 200 && res.data.projects && res.data.projects.length > 0, '获取项目列表');
    const projectId = res.data.projects[0].id;
    
    const today = new Date().toISOString().split('T')[0];
    
    res = await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '需求分析',
      hours: 4,
      date: today,
      remark: '测试工时1'
    });
    const entryId = res.data.entry?.id;
    assert(res.status === 200 && res.data.success, '提交工时成功', 'id=' + entryId);
    
    res = await request('GET', '/api/timesheets/daily-summary?date=' + today);
    assert(res.status === 200 && res.data.total_hours === 4, '每日工时汇总正确', 'hours=' + res.data.total_hours);
    
    res = await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '代码开发',
      hours: 9,
      date: today,
      remark: '超限测试'
    });
    assert(res.status === 400 && res.data.error && res.data.error.indexOf('12') >= 0, 
      '超过12小时限制被拒绝', 'status=' + res.status);
    
    res = await request('PUT', '/api/timesheets/' + entryId, {
      hours: 5,
      task: '需求分析-更新'
    });
    assert(res.status === 200 && res.data.entry.hours === 5, '编辑工时成功', 'hours=' + res.data.entry.hours);
    
    res = await request('GET', '/api/timesheets?date=' + today);
    assert(res.status === 200 && res.data.entries && res.data.entries.length >= 1, '获取工时列表');
    
    res = await request('DELETE', '/api/timesheets/' + entryId);
    assert(res.status === 200 && res.data.success, '删除工时成功');
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
  } catch (err) {
    logTest('工时CRUD', false, err.message);
  }
  
  console.log('');
}

async function testBatchSubmit() {
  console.log('[3] 批量提交与事务回滚测试');
  
  try {
    cookie = '';
    let res = await request('POST', '/api/auth/login', { username: 'lisi', password: '123456' });
    
    res = await request('GET', '/api/projects');
    const projectId = res.data.projects[0].id;
    
    const testDate = '2025-01-15';
    
    res = await request('POST', '/api/timesheets/batch', {
      date: testDate,
      entries: [
        { project_id: projectId, task: '任务A', hours: 3, remark: '批量1' },
        { project_id: projectId, task: '任务B', hours: 4, remark: '批量2' },
        { project_id: projectId, task: '任务C', hours: 2, remark: '批量3' }
      ]
    });
    assert(res.status === 200 && res.data.count === 3, '批量提交3条成功', 'count=' + res.data.count);
    
    res = await request('GET', '/api/timesheets/daily-summary?date=' + testDate);
    assert(res.status === 200 && res.data.total_hours === 9, '批量提交后总工时正确', 'hours=' + res.data.total_hours);
    
    res = await request('POST', '/api/timesheets/batch', {
      date: testDate,
      entries: [
        { project_id: projectId, task: '任务D', hours: 2, remark: '批量4' },
        { project_id: projectId, task: '', hours: 2, remark: '空任务' }
      ]
    });
    assert(res.status === 400, '批量提交有无效数据时全部失败', 'status=' + res.status);
    
    res = await request('GET', '/api/timesheets/daily-summary?date=' + testDate);
    assert(res.status === 200 && res.data.total_hours === 9, '事务回滚后总工时不变', 'hours=' + res.data.total_hours);
    
    res = await request('POST', '/api/timesheets/batch', {
      date: testDate,
      entries: [
        { project_id: projectId, task: '超限任务', hours: 5, remark: '超限测试' }
      ]
    });
    assert(res.status === 400 && res.data.error && res.data.error.indexOf('12') >= 0, 
      '批量提交超12小时限制被拒绝', 'status=' + res.status);
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
  } catch (err) {
    logTest('批量提交', false, err.message);
  }
  
  console.log('');
}

async function testCopyTimesheet() {
  console.log('[4] 工时复制测试');
  
  try {
    cookie = '';
    let res = await request('POST', '/api/auth/login', { username: 'zhangsan', password: '123456' });
    
    res = await request('GET', '/api/projects');
    const projectId = res.data.projects[0].id;
    
    const fromDate = '2025-01-20';
    const toDate = '2025-01-21';
    
    await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '源任务1',
      hours: 3,
      date: fromDate
    });
    await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '源任务2',
      hours: 4,
      date: fromDate
    });
    
    res = await request('POST', '/api/timesheets/copy', {
      fromDate: fromDate,
      toDate: toDate
    });
    assert(res.status === 200 && res.data.count === 2, '复制2条工时成功', 'count=' + res.data.count);
    
    res = await request('GET', '/api/timesheets/daily-summary?date=' + toDate);
    assert(res.status === 200 && res.data.total_hours === 7, '复制后目标日期工时正确', 'hours=' + res.data.total_hours);
    
    res = await request('POST', '/api/timesheets/copy', {
      fromDate: fromDate,
      toDate: fromDate
    });
    assert(res.status === 400, '源日期和目标日期相同被拒绝', 'status=' + res.status);
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
  } catch (err) {
    logTest('工时复制', false, err.message);
  }
  
  console.log('');
}

async function testApproveReject() {
  console.log('[5] 审核流程测试');
  
  try {
    cookie = '';
    let res = await request('POST', '/api/auth/login', { username: 'zhangsan', password: '123456' });
    
    res = await request('GET', '/api/projects');
    const projectId = res.data.projects[0].id;
    
    const testDate = '2025-02-01';
    
    res = await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '审核测试任务',
      hours: 5,
      date: testDate
    });
    const entryId = res.data.entry.id;
    assert(res.status === 200 && res.data.entry.status === 'pending', 
      '提交后状态为待审核', 'status=' + res.data.entry.status);
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
    res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    
    res = await request('POST', '/api/timesheets/' + entryId + '/reject', {
      comment: '任务描述不详细，请补充说明'
    });
    assert(res.status === 200 && res.data.entry.status === 'rejected', 
      '驳回工时成功', 'status=' + res.data.entry.status);
    assert(res.data.entry.review_comment === '任务描述不详细，请补充说明', 
      '驳回意见已记录', 'comment=' + res.data.entry.review_comment);
    assert(res.data.entry.reviewed_at, '驳回时间已记录');
    assert(res.data.entry.reviewed_by, '审核人已记录');
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
    res = await request('POST', '/api/auth/login', { username: 'zhangsan', password: '123456' });
    
    res = await request('GET', '/api/timesheets?date=' + testDate);
    const rejectedEntry = res.data.entries.find(e => e.id === entryId);
    assert(rejectedEntry && rejectedEntry.status === 'rejected', 
      '成员可看到驳回状态和意见', 'comment=' + (rejectedEntry?.review_comment || ''));
    
    res = await request('POST', '/api/timesheets/' + entryId + '/resubmit');
    assert(res.status === 200 && res.data.entry.status === 'pending', 
      '重新提交后状态变为待审核', 'status=' + res.data.entry.status);
    assert(!res.data.entry.review_comment, '重新提交后审核意见清空');
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
    res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    
    res = await request('POST', '/api/timesheets/' + entryId + '/approve', {
      comment: '审核通过，工时合理'
    });
    assert(res.status === 200 && res.data.entry.status === 'approved', 
      '审核通过成功', 'status=' + res.data.entry.status);
    assert(res.data.entry.review_comment === '审核通过，工时合理', 
      '审核通过意见已记录');
    
    res = await request('PUT', '/api/timesheets/' + entryId, {
      task: '修改测试'
    });
    assert(res.status === 400 && res.data.error && res.data.error.indexOf('已审核') >= 0, 
      '审核通过后锁定，不能编辑', 'status=' + res.status);
    
    res = await request('DELETE', '/api/timesheets/' + entryId);
    assert(res.status === 400 && res.data.error && res.data.error.indexOf('已审核') >= 0, 
      '审核通过后锁定，不能删除', 'status=' + res.status);
    
    res = await request('POST', '/api/timesheets/' + entryId + '/approve', { comment: '重复审核' });
    assert(res.status === 400 && res.data.error && res.data.error.indexOf('已审核') >= 0, 
      '已审核记录不能重复审核', 'status=' + res.status);
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
  } catch (err) {
    logTest('审核流程', false, err.message);
  }
  
  console.log('');
}

async function testStats() {
  console.log('[6] 统计报表测试');
  
  try {
    cookie = '';
    let res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    
    res = await request('GET', '/api/stats/by-project?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200 && Array.isArray(res.data.stats), 
      '项目成本统计接口正常', 'count=' + res.data.stats.length);
    
    res = await request('GET', '/api/stats/by-member?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200 && Array.isArray(res.data.stats), 
      '成员工时统计接口正常', 'count=' + res.data.stats.length);
    
    res = await request('GET', '/api/stats/by-task?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200 && Array.isArray(res.data.stats), 
      '任务类型统计接口正常', 'count=' + res.data.stats.length);
    
    res = await request('GET', '/api/stats/project-member-cross?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200 && Array.isArray(res.data.stats), 
      '项目成员交叉统计接口正常', 'count=' + res.data.stats.length);
    
    res = await request('GET', '/api/stats/pending?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200 && Array.isArray(res.data.entries), 
      '未审核工时列表接口正常', 'count=' + res.data.count);
    
    res = await request('GET', '/api/stats/utilization?startDate=2025-01-01&endDate=2025-01-31');
    assert(res.status === 200 && Array.isArray(res.data.stats), 
      '成员利用率统计接口正常');
    assert(typeof res.data.weekdays === 'number', 
      '利用率统计包含工作日数', 'weekdays=' + res.data.weekdays);
    assert(res.data.standard_hours_per_day === 8, 
      '标准工时为每天8小时', 'std=' + res.data.standard_hours_per_day);
    
    res = await request('GET', '/api/stats/summary?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200 && res.data.summary, '数据概览统计接口正常');
    assert(typeof res.data.summary.total_approved_hours === 'number', '概览包含已审核工时');
    assert(typeof res.data.summary.total_cost === 'number', '概览包含总成本');
    assert(typeof res.data.summary.pending_count === 'number', '概览包含待审核数量');
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
  } catch (err) {
    logTest('统计报表', false, err.message);
  }
  
  console.log('');
}

async function testCsvExport() {
  console.log('[7] CSV 导出测试');
  
  try {
    cookie = '';
    let res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    
    res = await request('GET', '/api/stats/export/by-project.csv?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200, '项目成本CSV导出成功', 'status=' + res.status);
    assert(res.body && res.body.length > 0, '项目CSV有内容', 'len=' + res.body.length);
    assert(res.body.indexOf('项目名称') >= 0 && res.body.indexOf('总工时') >= 0 && res.body.indexOf('总成本') >= 0, 
      '项目CSV包含必要字段');
    
    res = await request('GET', '/api/stats/export/by-member.csv?startDate=2025-01-01&endDate=2025-12-31');
    assert(res.status === 200, '成员工时CSV导出成功', 'status=' + res.status);
    assert(res.body && res.body.length > 0, '成员CSV有内容', 'len=' + res.body.length);
    assert(res.body.indexOf('成员名称') >= 0 && res.body.indexOf('总工时') >= 0 && res.body.indexOf('总成本') >= 0, 
      '成员CSV包含必要字段');
    
    res = await request('POST', '/api/auth/logout');
    cookie = '';
    
  } catch (err) {
    logTest('CSV导出', false, err.message);
  }
  
  console.log('');
}

async function testGitignore() {
  console.log('[8] .gitignore 检查');
  
  try {
    const gitignorePath = path.join(__dirname, '.gitignore');
    assert(fs.existsSync(gitignorePath), '.gitignore 文件存在');
    
    const content = fs.readFileSync(gitignorePath, 'utf8');
    assert(content.indexOf('node_modules') >= 0, '忽略 node_modules');
    assert(content.indexOf('data') >= 0 || content.indexOf('*.db') >= 0, '忽略数据库文件');
    assert(content.indexOf('*.log') >= 0, '忽略日志文件');
    
  } catch (err) {
    logTest('.gitignore检查', false, err.message);
  }
  
  console.log('');
}

async function testReadme() {
  console.log('[9] README 文档检查');
  
  try {
    const readmePath = path.join(__dirname, 'README.md');
    assert(fs.existsSync(readmePath), 'README.md 文件存在');
    
    const content = fs.readFileSync(readmePath, 'utf8');
    assert(content && content.length > 500, 'README 有实质性内容', 'len=' + content.length);
    
  } catch (err) {
    logTest('README检查', false, err.message);
  }
  
  console.log('');
}

runTests();

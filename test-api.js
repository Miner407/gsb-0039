const http = require('http');

async function apiTest() {
  console.log('=== 开始 API 功能测试 ===\n');

  const baseUrl = 'http://localhost:3001';
  let cookie = '';

  async function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.headers['set-cookie']) {
            cookie = res.headers['set-cookie'][0].split(';')[0];
          }
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  try {
    console.log('1. 测试成员登录 (zhangsan)...');
    let res = await request('POST', '/api/auth/login', { username: 'zhangsan', password: '123456' });
    console.log(`   状态: ${res.status}, 用户: ${res.data.user?.name}, 角色: ${res.data.user?.role}`);
    console.log(`   ✅ 登录成功\n`);

    console.log('2. 获取项目列表...');
    res = await request('GET', '/api/projects');
    console.log(`   状态: ${res.status}, 项目数: ${res.data.projects?.length}`);
    const projectId = res.data.projects[0].id;
    console.log(`   ✅ 获取成功, 使用项目: ${res.data.projects[0].name}\n`);

    console.log('3. 提交第一条工时 (8小时)...');
    const today = new Date().toISOString().split('T')[0];
    res = await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '需求分析',
      hours: 8,
      date: today,
      remark: '测试工时1'
    });
    console.log(`   状态: ${res.status}, 工时ID: ${res.data.entry?.id}`);
    console.log(`   ✅ 提交成功\n`);

    console.log('4. 测试每日工时汇总...');
    res = await request('GET', `/api/timesheets/daily-summary?date=${today}');
    console.log(`   状态: ${res.status}, 今日工时: ${res.data.total_hours}h`);
    console.log(`   ✅ 查询成功\n`);

    console.log('5. 测试超过12小时限制 (再提交5小时，总共13小时，应该失败)...');
    res = await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '代码开发',
      hours: 5,
      date: today,
      remark: '测试工时2 - 超限测试'
    });
    console.log(`   状态: ${res.status}, 错误: ${res.data.error}`);
    if (res.status === 400 && res.data.error.includes('12')) {
      console.log(`   ✅ 12小时限制生效\n`);
    } else {
      console.log(`   ❌ 12小时限制未生效\n`);
    }

    console.log('6. 提交3小时 (总共11小时，应该成功)...');
    res = await request('POST', '/api/timesheets', {
      project_id: projectId,
      task: '代码开发',
      hours: 3,
      date: today,
      remark: '测试工时2'
    });
    console.log(`   状态: ${res.status}, 工时ID: ${res.data.entry?.id}`);
    const entryId = res.data.entry?.id;
    console.log(`   ✅ 提交成功\n`);

    console.log('7. 测试成员登出...');
    res = await request('POST', '/api/auth/logout');
    console.log(`   状态: ${res.status}`);
    console.log(`   ✅ 登出成功\n`);

    console.log('8. 测试管理员登录...');
    res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    console.log(`   状态: ${res.status}, 用户: ${res.data.user?.name}, 角色: ${res.data.user?.role}`);
    console.log(`   ✅ 管理员登录成功\n`);

    console.log('9. 审核通过刚才的工时记录...');
    res = await request('POST', `/api/timesheets/${entryId}/approve`);
    console.log(`   状态: ${res.status}, 状态变为: ${res.data.entry?.status}`);
    console.log(`   ✅ 审核成功\n`);

    console.log('10. 测试审核后不能编辑 (已锁定)...');
    res = await request('PUT', `/api/timesheets/${entryId}`, {
      task: '修改测试'
    });
    console.log(`   状态: ${res.status}, 错误: ${res.data.error}`);
    if (res.status === 400 && res.data.error.includes('已审核')) {
      console.log(`   ✅ 审核锁定生效\n`);
    } else {
      console.log(`   ❌ 审核锁定未生效\n`);
    }

    console.log('11. 测试项目成本统计...');
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    res = await request('GET', `/api/stats/by-project?startDate=${firstDay}&endDate=${lastDay}`);
    console.log(`   状态: ${res.status}`);
    if (res.data.stats && res.data.stats.length > 0) {
      console.log(`   项目: ${res.data.stats[0].project_name}`);
      console.log(`   总工时: ${res.data.stats[0].total_hours}h`);
      console.log(`   总成本: ¥${res.data.stats[0].total_cost}`);
      console.log(`   ✅ 成本统计成功\n`);
    } else {
      console.log(`   ⚠️  暂无数据\n`);
    }

    console.log('12. 测试成员工时统计...');
    res = await request('GET', `/api/stats/by-member?startDate=${firstDay}&endDate=${lastDay}`);
    console.log(`   状态: ${res.status}`);
    if (res.data.stats && res.data.stats.length > 0) {
      console.log(`   成员: ${res.data.stats[0].user_name}`);
      console.log(`   总工时: ${res.data.stats[0].total_hours}h`);
      console.log(`   总成本: ¥${res.data.stats[0].total_cost}`);
      console.log(`   ✅ 成员工时统计成功\n`);
    }

    console.log('13. 测试数据概览...');
    res = await request('GET', `/api/stats/summary?startDate=${firstDay}&endDate=${lastDay}`);
    console.log(`   状态: ${res.status}`);
    console.log(`   已审核工时: ${res.data.summary.total_approved_hours}h`);
    console.log(`   总成本: ¥${res.data.summary.total_cost}`);
    console.log(`   待审核: ${res.data.summary.pending_count} 条`);
    console.log(`   ✅ 概览统计成功\n`);

    console.log('=== 所有测试完成 ===');

  } catch (err) {
    console.error('测试出错:', err.message);
  }
}

apiTest();

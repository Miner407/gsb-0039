const express = require('express');
const router = express.Router();
const { all, get } = require('../db/database');
const { authRequired, adminRequired } = require('./auth');

function getWeekdays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day >= 1 && day <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function buildDateCondition(startDate, endDate, params, tableAlias = 'te') {
  let condition = '';
  if (startDate) {
    condition += ` AND ${tableAlias}.date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    condition += ` AND ${tableAlias}.date <= ?`;
    params.push(endDate);
  }
  return condition;
}

router.get('/by-project', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate, project_id } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        p.id as project_id,
        p.name as project_name,
        COUNT(DISTINCT te.user_id) as member_count,
        COUNT(te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN users u ON te.user_id = u.id
      WHERE te.status = 'approved'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }
    if (project_id) {
      sql += ' AND te.project_id = ?';
      params.push(project_id);
    }

    sql += ' GROUP BY p.id, p.name ORDER BY total_cost DESC';

    const stats = await all(sql, params);
    res.json({ stats });
  } catch (err) {
    console.error('项目统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/by-member', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.hourly_rate,
        COUNT(te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.status = 'approved'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY u.id, u.name, u.hourly_rate ORDER BY total_cost DESC';

    const stats = await all(sql, params);
    res.json({ stats });
  } catch (err) {
    console.error('成员统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/by-task', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate, project_id } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        te.task as task_name,
        COUNT(te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.status = 'approved'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }
    if (project_id) {
      sql += ' AND te.project_id = ?';
      params.push(project_id);
    }

    sql += ' GROUP BY te.task ORDER BY total_hours DESC';

    const stats = await all(sql, params);
    res.json({ stats });
  } catch (err) {
    console.error('任务类型统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/project-member-cross', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        p.id as project_id,
        p.name as project_name,
        u.id as user_id,
        u.name as user_name,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost,
        COUNT(te.id) as entry_count
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN users u ON te.user_id = u.id
      WHERE te.status = 'approved'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY p.id, p.name, u.id, u.name ORDER BY p.name, u.name';

    const stats = await all(sql, params);
    res.json({ stats });
  } catch (err) {
    console.error('项目成员交叉统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/pending', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate, project_id } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        te.*,
        u.name as user_name,
        p.name as project_name
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE te.status = 'pending'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }
    if (project_id) {
      sql += ' AND te.project_id = ?';
      params.push(project_id);
    }

    sql += ' ORDER BY te.date DESC, te.id DESC';

    const entries = await all(sql, params);
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    
    res.json({ entries, total_hours: totalHours, count: entries.length });
  } catch (err) {
    console.error('未审核工时列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/utilization', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const params = [startDate, endDate];
    
    const sql = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.hourly_rate,
        COALESCE(SUM(te.hours), 0) as approved_hours
      FROM users u
      LEFT JOIN time_entries te ON u.id = te.user_id AND te.status = 'approved' AND te.date >= ? AND te.date <= ?
      WHERE u.role = 'member'
      GROUP BY u.id, u.name, u.hourly_rate
      ORDER BY approved_hours DESC
    `;

    const members = await all(sql, params);
    
    const weekdays = startDate && endDate ? getWeekdays(startDate, endDate) : 22;
    const standardHoursPerDay = 8;
    const standardTotalHours = weekdays * standardHoursPerDay;

    const stats = members.map(m => ({
      user_id: m.user_id,
      user_name: m.user_name,
      hourly_rate: m.hourly_rate,
      approved_hours: m.approved_hours,
      standard_hours: standardTotalHours,
      utilization_rate: standardTotalHours > 0 ? (m.approved_hours / standardTotalHours) * 100 : 0
    }));

    res.json({ stats, weekdays, standard_hours_per_day: standardHoursPerDay, standard_total_hours: standardTotalHours });
  } catch (err) {
    console.error('利用率统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/project-detail/:projectId', adminRequired, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    
    let sql = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.hourly_rate,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.project_id = ? AND te.status = 'approved'
    `;
    let params = [projectId];

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY u.id, u.name, u.hourly_rate ORDER BY total_cost DESC';

    const details = await all(sql, params);

    const project = await get('SELECT * FROM projects WHERE id = ?', [projectId]);

    res.json({ project, details });
  } catch (err) {
    console.error('项目详情统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/summary', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const totalApprovedHours = await get(
      `SELECT COALESCE(SUM(hours), 0) as total 
       FROM time_entries 
       WHERE status = 'approved'
       ${startDate && endDate ? ' AND date >= ? AND date <= ?' : ''}`,
      startDate && endDate ? [startDate, endDate] : []
    );

    const totalCost = await get(
      `SELECT COALESCE(SUM(te.hours * u.hourly_rate), 0) as total
       FROM time_entries te
       JOIN users u ON te.user_id = u.id
       WHERE te.status = 'approved'
       ${startDate && endDate ? ' AND te.date >= ? AND te.date <= ?' : ''}`,
      startDate && endDate ? [startDate, endDate] : []
    );

    const pendingCount = await get(
      `SELECT COUNT(*) as count 
       FROM time_entries 
       WHERE status = 'pending'
       ${startDate && endDate ? ' AND date >= ? AND date <= ?' : ''}`,
      startDate && endDate ? [startDate, endDate] : []
    );

    const projectCount = await get('SELECT COUNT(*) as count FROM projects WHERE status = "active"', []);
    const memberCount = await get('SELECT COUNT(*) as count FROM users WHERE role = "member"', []);

    res.json({
      summary: {
        total_approved_hours: totalApprovedHours.total,
        total_cost: totalCost.total,
        pending_count: pendingCount.count,
        project_count: projectCount.count,
        member_count: memberCount.count
      }
    });
  } catch (err) {
    console.error('汇总统计错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(headers, rows) {
  const headerLine = headers.map(h => escapeCsvField(h.label)).join(',');
  const dataLines = rows.map(row => 
    headers.map(h => escapeCsvField(row[h.key])).join(',')
  ).join('\n');
  return headerLine + '\n' + dataLines + '\n';
}

router.get('/export/by-project.csv', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate, project_id } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        p.name as project_name,
        COUNT(DISTINCT te.user_id) as member_count,
        COUNT(te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN users u ON te.user_id = u.id
      WHERE te.status = 'approved'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }
    if (project_id) {
      sql += ' AND te.project_id = ?';
      params.push(project_id);
    }

    sql += ' GROUP BY p.id, p.name ORDER BY total_cost DESC';

    const stats = await all(sql, params);

    const dateRange = (startDate || '开始') + ' 至 ' + (endDate || '结束');
    const rows = stats.map(s => ({
      project: s.project_name,
      member_count: s.member_count,
      entry_count: s.entry_count,
      total_hours: s.total_hours ? s.total_hours.toFixed(1) : '0',
      total_cost: s.total_cost ? s.total_cost.toFixed(2) : '0',
      date_range: dateRange
    }));

    const csv = toCsv([
      { label: '项目名称', key: 'project' },
      { label: '参与人数', key: 'member_count' },
      { label: '记录数', key: 'entry_count' },
      { label: '总工时(小时)', key: 'total_hours' },
      { label: '总成本(元)', key: 'total_cost' },
      { label: '日期范围', key: 'date_range' }
    ], rows);

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="project_cost.csv"');
    res.send(bom + csv);
  } catch (err) {
    console.error('导出项目成本CSV错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/export/by-member.csv', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const params = [];
    
    let sql = `
      SELECT 
        u.name as user_name,
        u.hourly_rate,
        COUNT(te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(te.hours * u.hourly_rate) as total_cost
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.status = 'approved'
    `;

    if (startDate) {
      sql += ' AND te.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND te.date <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY u.id, u.name, u.hourly_rate ORDER BY total_cost DESC';

    const stats = await all(sql, params);

    const dateRange = (startDate || '开始') + ' 至 ' + (endDate || '结束');
    const rows = stats.map(s => ({
      member: s.user_name,
      hourly_rate: s.hourly_rate ? s.hourly_rate.toFixed(2) : '0',
      entry_count: s.entry_count,
      total_hours: s.total_hours ? s.total_hours.toFixed(1) : '0',
      total_cost: s.total_cost ? s.total_cost.toFixed(2) : '0',
      date_range: dateRange
    }));

    const csv = toCsv([
      { label: '成员名称', key: 'member' },
      { label: '时薪(元/小时)', key: 'hourly_rate' },
      { label: '记录数', key: 'entry_count' },
      { label: '总工时(小时)', key: 'total_hours' },
      { label: '总成本(元)', key: 'total_cost' },
      { label: '日期范围', key: 'date_range' }
    ], rows);

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="member_hours.csv"');
    res.send(bom + csv);
  } catch (err) {
    console.error('导出成员工时CSV错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

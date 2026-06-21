const express = require('express');
const router = express.Router();
const { all, get } = require('../db/database');
const { authRequired, adminRequired } = require('./auth');

router.get('/by-project', adminRequired, async (req, res) => {
  try {
    const { startDate, endDate, project_id } = req.query;
    
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
    let params = [];

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
    let params = [];

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
    
    let params = [];
    let dateCondition = '';
    
    if (startDate && endDate) {
      dateCondition = 'WHERE date >= ? AND date <= ?';
      params.push(startDate, endDate);
    }

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

module.exports = router;

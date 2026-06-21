const express = require('express');
const router = express.Router();
const { all, get, run, db } = require('../db/database');
const { authRequired, adminRequired } = require('./auth');

const MAX_HOURS_PER_DAY = 12;

function runTransaction(operations) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const results = [];
      let hasError = false;
      let errorMsg = '';
      
      const executeNext = (index) => {
        if (index >= operations.length) {
          if (hasError) {
            db.run('ROLLBACK');
            reject(new Error(errorMsg || '事务执行失败'));
          } else {
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
              } else {
                resolve(results);
              }
            });
          }
          return;
        }
        
        const op = operations[index];
        db.run(op.sql, op.params, function (err) {
          if (err) {
            hasError = true;
            errorMsg = err.message;
            db.run('ROLLBACK');
            reject(err);
          } else {
            results.push({ lastID: this.lastID, changes: this.changes });
            executeNext(index + 1);
          }
        });
      };
      
      executeNext(0);
    });
  });
}

router.get('/', authRequired, async (req, res) => {
  try {
    const { date, startDate, endDate, project_id, status } = req.query;
    const user = req.session.user;
    
    let sql = `
      SELECT te.*, u.name as user_name, p.name as project_name 
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE 1=1
    `;
    let params = [];

    if (user.role !== 'admin') {
      sql += ' AND te.user_id = ?';
      params.push(user.id);
    }

    if (date) {
      sql += ' AND te.date = ?';
      params.push(date);
    }

    if (startDate && endDate) {
      sql += ' AND te.date >= ? AND te.date <= ?';
      params.push(startDate, endDate);
    }

    if (project_id) {
      sql += ' AND te.project_id = ?';
      params.push(project_id);
    }

    if (status) {
      sql += ' AND te.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY te.date DESC, te.id DESC';

    const entries = await all(sql, params);
    res.json({ entries });
  } catch (err) {
    console.error('获取工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/daily-summary', authRequired, async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.session.user.id;

    const result = await get(
      'SELECT COALESCE(SUM(hours), 0) as total_hours FROM time_entries WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    res.json({ total_hours: result.total_hours });
  } catch (err) {
    console.error('获取每日汇总错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    const { project_id, task, hours, date, remark } = req.body;
    const userId = req.session.user.id;

    if (!project_id || !task || !hours || !date) {
      return res.status(400).json({ error: '项目、任务、小时数和日期不能为空' });
    }

    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > MAX_HOURS_PER_DAY) {
      return res.status(400).json({ error: `小时数必须在 0 到 ${MAX_HOURS_PER_DAY} 之间` });
    }

    const dailyResult = await get(
      'SELECT COALESCE(SUM(hours), 0) as total_hours FROM time_entries WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    if (dailyResult.total_hours + hoursNum > MAX_HOURS_PER_DAY) {
      return res.status(400).json({ 
        error: `每日工时不能超过 ${MAX_HOURS_PER_DAY} 小时，当前已有 ${dailyResult.total_hours} 小时` 
      });
    }

    const result = await run(
      `INSERT INTO time_entries (user_id, project_id, task, hours, date, remark, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, project_id, task, hoursNum, date, remark || '']
    );

    const entry = await get(`
      SELECT te.*, u.name as user_name, p.name as project_name 
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE te.id = ?
    `, [result.lastID]);

    res.json({ success: true, entry });
  } catch (err) {
    console.error('创建工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id, task, hours, date, remark } = req.body;
    const user = req.session.user;

    const entry = await get('SELECT * FROM time_entries WHERE id = ?', [id]);
    
    if (!entry) {
      return res.status(404).json({ error: '工时记录不存在' });
    }

    if (user.role !== 'admin' && entry.user_id !== user.id) {
      return res.status(403).json({ error: '无权修改他人的工时记录' });
    }

    if (entry.status === 'approved') {
      return res.status(400).json({ error: '已审核的工时记录不能编辑' });
    }

    const hoursNum = hours !== undefined ? parseFloat(hours) : entry.hours;
    const newDate = date || entry.date;

    if (hours !== undefined) {
      if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > MAX_HOURS_PER_DAY) {
        return res.status(400).json({ error: `小时数必须在 0 到 ${MAX_HOURS_PER_DAY} 之间` });
      }
    }

    if (hours !== undefined || date !== undefined) {
      const dailyResult = await get(
        `SELECT COALESCE(SUM(hours), 0) as total_hours 
         FROM time_entries 
         WHERE user_id = ? AND date = ? AND id != ?`,
        [entry.user_id, newDate, id]
      );

      if (dailyResult.total_hours + hoursNum > MAX_HOURS_PER_DAY) {
        return res.status(400).json({ 
          error: `每日工时不能超过 ${MAX_HOURS_PER_DAY} 小时，修改后将达到 ${dailyResult.total_hours + hoursNum} 小时` 
        });
      }
    }

    await run(
      `UPDATE time_entries 
       SET project_id = ?, task = ?, hours = ?, date = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        project_id || entry.project_id,
        task || entry.task,
        hoursNum,
        newDate,
        remark !== undefined ? remark : entry.remark,
        id
      ]
    );

    const updated = await get(`
      SELECT te.*, u.name as user_name, p.name as project_name 
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE te.id = ?
    `, [id]);

    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error('更新工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const entry = await get('SELECT * FROM time_entries WHERE id = ?', [id]);
    
    if (!entry) {
      return res.status(404).json({ error: '工时记录不存在' });
    }

    if (user.role !== 'admin' && entry.user_id !== user.id) {
      return res.status(403).json({ error: '无权删除他人的工时记录' });
    }

    if (entry.status === 'approved') {
      return res.status(400).json({ error: '已审核的工时记录不能删除' });
    }

    await run('DELETE FROM time_entries WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('删除工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/approve', adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const adminId = req.session.user.id;
    const adminName = req.session.user.name;

    const entry = await get('SELECT * FROM time_entries WHERE id = ?', [id]);
    
    if (!entry) {
      return res.status(404).json({ error: '工时记录不存在' });
    }

    if (entry.status === 'approved') {
      return res.status(400).json({ error: '该工时记录已审核' });
    }

    await run(
      `UPDATE time_entries 
       SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [adminId, comment || '', id]
    );

    const updated = await get(`
      SELECT te.*, u.name as user_name, p.name as project_name, ru.name as reviewer_name
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      LEFT JOIN users ru ON te.reviewed_by = ru.id
      WHERE te.id = ?
    `, [id]);

    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error('审核工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/reject', adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const adminId = req.session.user.id;

    const entry = await get('SELECT * FROM time_entries WHERE id = ?', [id]);
    
    if (!entry) {
      return res.status(404).json({ error: '工时记录不存在' });
    }

    await run(
      `UPDATE time_entries 
       SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [adminId, comment || '', id]
    );

    const updated = await get(`
      SELECT te.*, u.name as user_name, p.name as project_name, ru.name as reviewer_name
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      LEFT JOIN users ru ON te.reviewed_by = ru.id
      WHERE te.id = ?
    `, [id]);

    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error('驳回工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/:id/resubmit', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const entry = await get('SELECT * FROM time_entries WHERE id = ?', [id]);
    
    if (!entry) {
      return res.status(404).json({ error: '工时记录不存在' });
    }

    if (user.role !== 'admin' && entry.user_id !== user.id) {
      return res.status(403).json({ error: '无权操作他人的工时记录' });
    }

    if (entry.status !== 'rejected') {
      return res.status(400).json({ error: '只有被驳回的工时记录才能重新提交' });
    }

    await run(
      `UPDATE time_entries 
       SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_comment = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    const updated = await get(`
      SELECT te.*, u.name as user_name, p.name as project_name 
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE te.id = ?
    `, [id]);

    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error('重新提交工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/batch', authRequired, async (req, res) => {
  try {
    const { entries, date } = req.body;
    const userId = req.session.user.id;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: '批量提交数据不能为空' });
    }

    if (!date) {
      return res.status(400).json({ error: '日期不能为空' });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.project_id || !entry.task || !entry.hours) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录缺少必填字段` });
      }
      const hoursNum = parseFloat(entry.hours);
      if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > MAX_HOURS_PER_DAY) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录小时数必须在 0 到 ${MAX_HOURS_PER_DAY} 之间` });
      }
    }

    const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
    const existingResult = await get(
      'SELECT COALESCE(SUM(hours), 0) as total_hours FROM time_entries WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    if (existingResult.total_hours + totalHours > MAX_HOURS_PER_DAY) {
      return res.status(400).json({ 
        error: `每日工时不能超过 ${MAX_HOURS_PER_DAY} 小时，当前已有 ${existingResult.total_hours} 小时，批量提交 ${totalHours} 小时后将超限` 
      });
    }

    const operations = entries.map(entry => ({
      sql: `INSERT INTO time_entries (user_id, project_id, task, hours, date, remark, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      params: [userId, entry.project_id, entry.task, parseFloat(entry.hours), date, entry.remark || '']
    }));

    const results = await runTransaction(operations);

    const placeholders = results.map(r => '?').join(',');
    const ids = results.map(r => r.lastID);
    const newEntries = await all(`
      SELECT te.*, u.name as user_name, p.name as project_name 
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE te.id IN (${placeholders})
      ORDER BY te.id DESC
    `, ids);

    res.json({ success: true, entries: newEntries, count: results.length });
  } catch (err) {
    console.error('批量提交工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/copy', authRequired, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const userId = req.session.user.id;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: '源日期和目标日期不能为空' });
    }

    if (fromDate === toDate) {
      return res.status(400).json({ error: '源日期和目标日期不能相同' });
    }

    const sourceEntries = await all(
      'SELECT * FROM time_entries WHERE user_id = ? AND date = ?',
      [userId, fromDate]
    );

    if (sourceEntries.length === 0) {
      return res.status(400).json({ error: '源日期没有工时记录可复制' });
    }

    const sourceTotal = sourceEntries.reduce((sum, e) => sum + e.hours, 0);
    const targetExisting = await get(
      'SELECT COALESCE(SUM(hours), 0) as total_hours FROM time_entries WHERE user_id = ? AND date = ?',
      [userId, toDate]
    );

    if (targetExisting.total_hours + sourceTotal > MAX_HOURS_PER_DAY) {
      return res.status(400).json({ 
        error: `目标日期工时将超过 ${MAX_HOURS_PER_DAY} 小时，无法复制` 
      });
    }

    const operations = sourceEntries.map(entry => ({
      sql: `INSERT INTO time_entries (user_id, project_id, task, hours, date, remark, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      params: [userId, entry.project_id, entry.task, entry.hours, toDate, entry.remark || '']
    }));

    const results = await runTransaction(operations);

    const placeholders = results.map(r => '?').join(',');
    const ids = results.map(r => r.lastID);
    const newEntries = await all(`
      SELECT te.*, u.name as user_name, p.name as project_name 
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      WHERE te.id IN (${placeholders})
      ORDER BY te.id DESC
    `, ids);

    res.json({ success: true, entries: newEntries, count: results.length });
  } catch (err) {
    console.error('复制工时记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

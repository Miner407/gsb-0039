const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db/database');
const { authRequired, adminRequired } = require('./auth');

router.get('/', authRequired, async (req, res) => {
  try {
    const projects = await all('SELECT * FROM projects ORDER BY id');
    res.json({ projects });
  } catch (err) {
    console.error('获取项目列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', adminRequired, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }

    const result = await run(
      'INSERT INTO projects (name, description) VALUES (?, ?)',
      [name, description || '']
    );

    const project = await get('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.json({ success: true, project });
  } catch (err) {
    console.error('创建项目错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    await run(
      'UPDATE projects SET name = ?, description = ?, status = ? WHERE id = ?',
      [name || project.name, description !== undefined ? description : project.description, status || project.status, id]
    );

    const updated = await get('SELECT * FROM projects WHERE id = ?', [id]);
    res.json({ success: true, project: updated });
  } catch (err) {
    console.error('更新项目错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/:id', adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('删除项目错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

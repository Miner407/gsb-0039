const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db/database');
const { authRequired, adminRequired } = require('./auth');

router.get('/', adminRequired, async (req, res) => {
  try {
    const users = await all('SELECT id, username, name, role, hourly_rate, created_at FROM users ORDER BY id');
    res.json({ users });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', adminRequired, async (req, res) => {
  try {
    const { username, password, name, role, hourly_rate } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ error: '用户名、密码和姓名不能为空' });
    }

    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await run(
      'INSERT INTO users (username, password, name, role, hourly_rate) VALUES (?, ?, ?, ?, ?)',
      [username, hash, name, role || 'member', hourly_rate || 0]
    );

    const user = await get('SELECT id, username, name, role, hourly_rate, created_at FROM users WHERE id = ?', [result.lastID]);
    res.json({ success: true, user });
  } catch (err) {
    console.error('创建用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/:id', adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, hourly_rate, password } = req.body;

    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    let newPassword = user.password;
    if (password) {
      newPassword = bcrypt.hashSync(password, 10);
    }

    await run(
      'UPDATE users SET name = ?, role = ?, hourly_rate = ?, password = ? WHERE id = ?',
      [name || user.name, role || user.role, hourly_rate !== undefined ? hourly_rate : user.hourly_rate, newPassword, id]
    );

    const updated = await get('SELECT id, username, name, role, hourly_rate, created_at FROM users WHERE id = ?', [id]);
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('更新用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/:id', adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    
    const currentUser = req.session.user;
    if (parseInt(id) === currentUser.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    await run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('删除用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get } = require('../db/database');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      hourly_rate: user.hourly_rate
    };

    res.json({
      success: true,
      user: req.session.user
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: '未登录' });
  }
});

function authRequired(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: '请先登录' });
  }
}

function adminRequired(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: '需要管理员权限' });
  }
}

module.exports = { router, authRequired, adminRequired };

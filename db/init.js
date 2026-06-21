const { run, get } = require('./database');
const bcrypt = require('bcryptjs');

async function initDB() {
  console.log('开始初始化数据库...');

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      hourly_rate REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      task TEXT NOT NULL,
      hours REAL NOT NULL,
      date TEXT NOT NULL,
      remark TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
  `);

  const adminExists = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    await run(
      'INSERT INTO users (username, password, name, role, hourly_rate) VALUES (?, ?, ?, ?, ?)',
      ['admin', adminHash, '系统管理员', 'admin', 200]
    );
    console.log('创建管理员账号: admin / admin123');
  }

  const member1Exists = await get('SELECT id FROM users WHERE username = ?', ['zhangsan']);
  if (!member1Exists) {
    const hash = bcrypt.hashSync('123456', 10);
    await run(
      'INSERT INTO users (username, password, name, role, hourly_rate) VALUES (?, ?, ?, ?, ?)',
      ['zhangsan', hash, '张三', 'member', 100]
    );
    console.log('创建测试成员: zhangsan / 123456');
  }

  const member2Exists = await get('SELECT id FROM users WHERE username = ?', ['lisi']);
  if (!member2Exists) {
    const hash = bcrypt.hashSync('123456', 10);
    await run(
      'INSERT INTO users (username, password, name, role, hourly_rate) VALUES (?, ?, ?, ?, ?)',
      ['lisi', hash, '李四', 'member', 120]
    );
    console.log('创建测试成员: lisi / 123456');
  }

  const projectCount = await get('SELECT COUNT(*) as count FROM projects');
  if (projectCount.count === 0) {
    await run('INSERT INTO projects (name, description) VALUES (?, ?)', 
      ['项目A - 官网重构', '公司官网重构项目']);
    await run('INSERT INTO projects (name, description) VALUES (?, ?)', 
      ['项目B - 移动端APP', '移动端应用开发']);
    await run('INSERT INTO projects (name, description) VALUES (?, ?)', 
      ['项目C - 内部系统', '内部管理系统开发']);
    console.log('创建示例项目');
  }

  console.log('数据库初始化完成!');
}

initDB().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});


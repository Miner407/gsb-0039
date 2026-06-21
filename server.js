const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const { router: authRouter } = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const timesheetsRouter = require('./routes/timesheets');
const statsRouter = require('./routes/stats');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, 'data')
  }),
  secret: 'timesheet-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/timesheets', timesheetsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/users', usersRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

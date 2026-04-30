const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '5mb' })); // 支持大JSON

// 数据库连接
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123456', // 你的密码
  database: 'front_dev_db'
});

// 测试连接
db.connect((err) => {
  if (err) {
    console.log('数据库连接失败', err);
    return;
  }
  console.log('✅ MySQL 连接成功');
});

// ==============================================
// 1. 题目列表（支持分类 + 分页）
// ==============================================
app.get('/api/questions', (req, res) => {
  const { category, pageNum = 1, pageSize = 10 } = req.query;
  const offset = (pageNum - 1) * pageSize;

  let sql = 'SELECT * FROM questions WHERE 1=1';
  let params = [];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY id LIMIT ? OFFSET ?';
  params.push(Number(pageSize), Number(offset));

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // 查询总数
    let countSql = 'SELECT COUNT(*) as total FROM questions WHERE 1=1';
    let countParams = [];
    if (category && category !== 'all') {
      countSql += ' AND category = ?';
      countParams.push(category);
    }

    db.query(countSql, countParams, (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: results,
        total: countResult[0].total,
        pageNum: Number(pageNum),
        pageSize: Number(pageSize)
      });
    });
  });
});

// ==============================================
// 2. 批量新增/修改题目（有则改，无则增）
// ==============================================
app.post('/api/questions/batch-save', async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ msg: '必须传数组' });
  }

  const sql = `
    INSERT INTO questions (id, category, question)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
    category = VALUES(category),
    question = VALUES(question)
  `;

  let success = 0;
  for (let item of list) {
    const { id, category, question } = item;
    await new Promise((resolve) => {
      db.query(sql, [id, category, question], () => {
        success++;
        resolve();
      });
    });
  }

  res.json({ msg: `批量保存成功，共处理 ${success} 条` });
});

// ==============================================
// 3. 保存完整题目详情（题目+标准答案+回答+点评 一体化）
// 存在则更新，不存在则新增
// ==============================================
app.post('/api/questions/save-detail', async (req, res) => {
  const {
    id,
    category,
    question,
    standard_answers = [],
    responders = []
  } = req.body;

  try {
    // --------------------- 1. 保存题目 ---------------------
    const questionSql = `
      INSERT INTO questions (id, category, question)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
      category = VALUES(category),
      question = VALUES(question)
    `;
    await query(questionSql, [id, category, question]);

    // --------------------- 2. 先删除旧的标准答案 ---------------------
    await query('DELETE FROM standard_answers WHERE question_id = ?', [id]);

    // --------------------- 3. 插入新的标准答案 ---------------------
    for (let sa of standard_answers) {
      const sql = `
        INSERT INTO standard_answers (question_id, title, answers)
        VALUES (?, ?, ?)
      `;
      await query(sql, [id, sa.title, JSON.stringify(sa.answers)]);
    }

    // --------------------- 4. 先删除旧的面试者回答 ---------------------
    await query('DELETE FROM responses WHERE question_id = ?', [id]);

    // --------------------- 5. 插入面试者回答 + 点评 ---------------------
    for (let resp of responders) {
      const { responder, responses = [], score, evaluation } = resp;
      for (let r of responses) {
        const sql = `
          INSERT INTO responses
          (question_id, responder, title, answers, score, advantage, weakness)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await query(sql, [
          id,
          responder,
          r.title,
          JSON.stringify(r.answers),
          score,
          JSON.stringify(evaluation?.advantage || []),
          JSON.stringify(evaluation?.weakness || [])
        ]);
      }
    }

    res.json({ msg: '题目详情保存成功（题目+答案+回答+点评全覆盖）' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 封装 Promise 查询（方便异步流程）
function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ==============================================
// 下面是原有接口（保留不动）
// ==============================================
// 获取单个题目
app.get('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM questions WHERE id = ?';
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: results[0] });
  });
});

// 新增题目
app.post('/api/questions', (req, res) => {
  const { id, category, question } = req.body;
  const sql = 'INSERT INTO questions (id, category, question) VALUES (?, ?, ?)';
  db.query(sql, [id, category, question], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ msg: '添加成功', data: result });
  });
});

// 修改题目
app.put('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const { category, question } = req.body;
  const sql = 'UPDATE questions SET category=?, question=? WHERE id=?';
  db.query(sql, [category, question, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ msg: '修改成功' });
  });
});

// 删除题目
app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM questions WHERE id=?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ msg: '删除成功' });
  });
});

// 根据题目ID获取标准答案
app.get('/api/standard-answers/:question_id', (req, res) => {
  const { question_id } = req.params;
  const sql = 'SELECT * FROM standard_answers WHERE question_id = ?';
  db.query(sql, [question_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: results });
  });
});

// 新增标准答案
app.post('/api/standard-answers', (req, res) => {
  const { question_id, title, answers } = req.body;
  const sql = 'INSERT INTO standard_answers (question_id, title, answers) VALUES (?, ?, ?)';
  db.query(sql, [question_id, title, JSON.stringify(answers)], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ msg: '添加成功' });
  });
});

// 根据题目ID + 面试者姓名获取回答与点评
app.get('/api/responses/:question_id/:responder', (req, res) => {
  const { question_id, responder } = req.params;
  const sql = 'SELECT * FROM responses WHERE question_id = ? AND responder = ?';
  db.query(sql, [question_id, responder], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: results });
  });
});

// 新增面试者回答
app.post('/api/responses', (req, res) => {
  const { question_id, responder, title, answers, score, advantage, weakness } = req.body;
  const sql = `
    INSERT INTO responses
    (question_id, responder, title, answers, score, advantage, weakness)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [
    question_id, responder, title, JSON.stringify(answers),
    score, JSON.stringify(advantage), JSON.stringify(weakness)
  ], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ msg: '回答提交成功' });
  });
});

// 启动服务
app.listen(3000, () => {
  console.log('🚀 服务运行在 http://localhost:3000');
});
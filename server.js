// 文件路径：server.js
// 服务器端接口代码
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const readlineSync = require('readline-sync');
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 输入密码连接数据库
const DB_PASSWORD = readlineSync.question('请输入 MySQL root 密码：', {
  hideEchoBack: true
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: DB_PASSWORD,
  database: 'front_dev_db'
});

db.connect((err) => {
  if (err) {
    console.log('\n❌ 数据库连接失败');
    process.exit();
  }
  console.log('\n✅ MySQL 连接成功');
});

// Promise 查询封装
function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// 统一返回格式
function success(data = null, msg = 'success') {
  return { code: 200, msg, data };
}
function error(code = 500, msg = '服务器错误') {
  return { code, msg, data: null };
}

// 安全解析 JSON
function safeParse(jsonStr, defaultValue = []) {
  if (!jsonStr) return defaultValue;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return jsonStr;
  }
}

// 1. 题目列表（分类 + 分页）
app.get('/api/questions', async (req, res) => {
  try {
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

    const list = await query(sql, params);

    const countSql = 'SELECT COUNT(*) AS total FROM questions WHERE 1=1' +
      (category && category !== 'all' ? ' AND category = ?' : '');
    const countParams = category && category !== 'all' ? [category] : [];
    const totalResult = await query(countSql, countParams);
    const total = totalResult[0].total;

    res.json(success({
      list,
      total: Number(total),
      pageNum: Number(pageNum),
      pageSize: Number(pageSize)
    }));
  } catch (e) {
    res.json(error(500, e.message));
  }
});

// 2. 批量保存题目
app.post('/api/questions/batch-save', async (req, res) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) {
      return res.json(error(400, '参数必须是数组'));
    }

    const sql = `
      INSERT INTO questions (id, category, question)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
      category = VALUES(category),
      question = VALUES(question)
    `;

    for (let item of list) {
      await query(sql, [item.id, item.category, item.question]);
    }

    res.json(success(null, `批量保存成功，共${list.length}条`));
  } catch (e) {
    res.json(error(500, e.message));
  }
});

// 3. 保存完整题目详情（适配新表）
app.post('/api/questions/save-detail', async (req, res) => {
  try {
    const { id, category, question, standard_answers, responders } = req.body;

    // 保存题目
    await query(`
      INSERT INTO questions (id, category, question)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE category = VALUES(category), question = VALUES(question)
    `, [id, category, question]);

    // 清空旧数据
    await query('DELETE FROM standard_answers WHERE question_id = ?', [id]);
    await query('DELETE FROM interviewee_responses WHERE question_id = ?', [id]);
    // 明细表会通过外键自动级联删除

    // 保存标准答案
    for (let sa of standard_answers) {
      await query(`
        INSERT INTO standard_answers (question_id, title, answers)
        VALUES (?, ?, ?)
      `, [id, sa.title, JSON.stringify(sa.answers)]);
    }

    // 保存面试者回答（新表逻辑）
    for (let resp of responders) {
      const { responder, responses, score, evaluation } = resp;

      // 先插入主表
      await query(`
        INSERT INTO interviewee_responses (question_id, responder, score, advantage, weakness)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        score = VALUES(score),
        advantage = VALUES(advantage),
        weakness = VALUES(weakness)
      `, [
        id,
        responder,
        score,
        JSON.stringify(evaluation.advantage),
        JSON.stringify(evaluation.weakness)
      ]);

      // 获取主表ID
      const [row] = await query(`
        SELECT id FROM interviewee_responses WHERE question_id = ? AND responder = ?
      `, [id, responder]);
      const responseId = row.id;

      // 再插入明细表
      for (let r of responses) {
        await query(`
          INSERT INTO interviewee_response_details (response_id, title, answers)
          VALUES (?, ?, ?)
        `, [
          responseId,
          r.title,
          JSON.stringify(r.answers)
        ]);
      }
    }

    res.json(success(null, '题目详情保存成功'));
  } catch (e) {
    res.json(error(500, e.message));
  }
});

// 4. 获取题目详情（适配新表）
app.get('/api/questions/detail', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json(error(400, '缺少参数 id'));

    // 题目
    const question = await query('SELECT * FROM questions WHERE id = ?', [id]);
    if (!question.length) return res.json(error(404, '题目不存在'));
    const q = question[0];

    // 标准答案
    const standardList = await query('SELECT * FROM standard_answers WHERE question_id = ?', [id]);
    const standard_answers = standardList.map(s => ({
      title: s.title,
      answers: safeParse(s.answers)
    }));

    // 面试者回答（新表逻辑）
    const mainList = await query('SELECT * FROM interviewee_responses WHERE question_id = ?', [id]);
    const responders = [];

    for (const main of mainList) {
      const details = await query('SELECT * FROM interviewee_response_details WHERE response_id = ?', [main.id]);
      const responses = details.map(d => ({
        title: d.title,
        answers: safeParse(d.answers)
      }));

      responders.push({
        responder: main.responder,
        responses,
        score: main.score,
        evaluation: {
          advantage: safeParse(main.advantage),
          weakness: safeParse(main.weakness)
        }
      });
    }

    const data = {
      id: q.id,
      category: q.category,
      question: q.question,
      responders,
      standard_answers
    };

    res.json(success(data));
  } catch (e) {
    res.json(error(500, e.message));
  }
});

// 其他接口（略，如需可继续适配）

// 启动服务
app.listen(3000, () => {
  console.log('🚀 服务运行在 http://localhost:3000');
});
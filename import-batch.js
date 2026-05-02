// 文件路径：import-batch.js 
// 导入批量题目 JSON 文件
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

// 读取批量题目 JSON
async function run() {
  try {
    const filePath = path.join(__dirname, './mock/questions.json');
    const jsonStr = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(jsonStr);

    console.log('✅ 读取成功，共', data.length, '条题目');

    // 调用批量保存接口
    const res = await fetch('http://localhost:3000/api/questions/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr
    });

    const result = await res.json();
    console.log('✅ 接口调用成功：', result.msg);
  } catch (err) {
    console.error('❌ 失败：', err.message);
  }
}

run();
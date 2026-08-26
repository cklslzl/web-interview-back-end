// 文件路径：scripts/import-questions.js
const fs = require('fs').promises;
const path = require('path');

// 读取批量题目 JSON
async function run() {
  try {
    const filePath = path.join(__dirname, './import/questions.json');
    const jsonStr = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(jsonStr);

    console.log('✅ 读取成功，共', data.length, '条题目');

    // 调用批量保存接口
    const res = await fetch('http://localhost:3001/api/questions/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr
    });

    const result = await res.json();
    console.log('✅ 导入题目结果：', result.msg);
  } catch (err) {
    console.error('❌ 导入题目失败：', err.message);
  }
}

run();
// 文件路径：import-detail.js 
// 导入完整题目详情 JSON 文件
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

// 读取完整题目详情 JSON
async function run() {
  try {
    const filePath = path.join(__dirname, './mock/question.json');
    const jsonStr = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(jsonStr);

    console.log('✅ 读取题目详情：', data.id, data.category);

    // 调用保存详情接口
    const res = await fetch('http://localhost:3000/api/questions/save-detail', {
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
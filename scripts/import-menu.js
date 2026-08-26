// 文件路径：/scripts/import-menu.js
const fs = require('fs').promises;
const path = require('path');

async function run() {
  try {
    const filePath = path.join(__dirname, './import/menu.json');
    const jsonStr = await fs.readFile(filePath, 'utf8');

    console.log('✅ 读取菜单 JSON 成功');

    // 调用批量保存接口
    const res = await fetch('http://localhost:3001/api/menus/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr
    });

    const result = await res.json();
    console.log('✅ 导入结果：', result.msg);
  } catch (err) {
    console.error('❌ 失败：', err.message);
  }
}

run();
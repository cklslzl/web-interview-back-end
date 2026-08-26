const fs = require('fs').promises;
const path = require('path');

/**
 * 【通用】批量刷新缓存脚本
 * 从 refresh-cache.json 读取需要刷新的缓存KEY，自动遍历刷新
 * 支持：菜单缓存、基础数据缓存、全局配置缓存等
 */
async function refreshCache() {
  try {
    // 1. 读取配置文件
    const configPath = path.join(__dirname, './import/refresh-cache.json');
    const jsonStr = await fs.readFile(configPath, 'utf8');
    const { keys } = JSON.parse(jsonStr);

    console.log('🚀 开始批量刷新缓存，共', keys.length, '个项');
    console.log('ℹ️  待刷新KEY：', keys);

    // 2. 遍历所有缓存key，逐个刷新
    for (const key of keys) {
      try {
        console.log('\n==============================================');
        console.log('🔄 正在刷新：', key);

        // 调用统一缓存刷新接口
        const res = await fetch('http://localhost:3001/api/cache/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cacheKey: key }),
        });

        const result = await res.json();
        console.log('✅ 刷新成功：', key, ' | ', result.msg);
      } catch (err) {
        console.error('❌ 刷新失败：', key, ' => ', err.message);
      }
    }

    console.log('\n==============================================');
    console.log('🏁 所有缓存刷新任务已全部提交完成！');
  } catch (err) {
    console.error('❌ 脚本执行异常：', err.message);
  }
}

// 执行
refreshCache();
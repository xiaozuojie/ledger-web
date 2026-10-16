/** GitHub Pages SPA：深链刷新靠 404.html 回落到 index */
const fs = require('fs')
const path = require('path')
const dist = path.join(__dirname, '..', 'dist')
const index = path.join(dist, 'index.html')
const out = path.join(dist, '404.html')
if (!fs.existsSync(index)) {
  console.error('[copy-404] dist/index.html missing')
  process.exit(1)
}
fs.copyFileSync(index, out)
console.log('[copy-404] wrote dist/404.html')

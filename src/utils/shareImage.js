export function paintSettlementImage(canvas, title, lines, total) {
  const w = 600
  const h = 800
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f5f7fa'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1a6fb5'
  ctx.fillRect(0, 0, w, 100)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText(title || '结算', 32, 62)
  ctx.fillStyle = '#111827'
  ctx.font = '26px sans-serif'
  let y = 150
  ;(lines || []).forEach((line) => {
    ctx.fillText(String(line), 36, y)
    y += 42
  })
  ctx.fillStyle = '#fde047'
  ctx.fillRect(32, y + 16, w - 64, 80)
  ctx.fillStyle = '#92400e'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText(`总计 ${total} 元`, 48, y + 68)
}

export function downloadCanvasPng(canvas, fileName) {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'settlement.png'
  a.click()
}

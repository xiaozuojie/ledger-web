/** 对照纸面/Excel 样表绘制结算图（深蓝表头 + 桃色汇总 + 黄底总计） */

const COLORS = {
  page: '#f3f4f6',
  card: '#ffffff',
  border: '#b0b8c4',
  headerBg: '#2F5597',
  headerText: '#ffffff',
  text: '#1f2937',
  muted: '#4b5563',
  summaryBg: '#FBE5D6',
  totalBg: '#FFD966',
  title: '#111827'
}

function money(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0.00'
  return v.toFixed(2)
}

function formatShortDate(dateStr) {
  const s = String(dateStr || '')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${Number(m[2])}/${Number(m[3])}`
  return s
}

function wrapLines(ctx, text, maxWidth) {
  const raw = String(text ?? '')
  if (!raw) return ['']
  const chars = [...raw]
  const lines = []
  let cur = ''
  for (const ch of chars) {
    const trial = cur + ch
    if (ctx.measureText(trial).width > maxWidth && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur = trial
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function fillRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.fill()
}

function strokeRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.stroke()
}

function drawCellText(ctx, text, x, y, w, h, opts = {}) {
  const {
    align = 'center',
    color = COLORS.text,
    font = '22px sans-serif',
    pad = 8,
    valign = 'middle'
  } = opts
  ctx.fillStyle = color
  ctx.font = font
  const lines = wrapLines(ctx, text, w - pad * 2)
  const lineH = 26
  const blockH = lines.length * lineH
  let ty =
    valign === 'top'
      ? y + pad + lineH - 6
      : y + (h - blockH) / 2 + lineH - 6
  for (const line of lines) {
    let tx = x + w / 2
    ctx.textAlign = 'center'
    if (align === 'left') {
      tx = x + pad
      ctx.textAlign = 'left'
    } else if (align === 'right') {
      tx = x + w - pad
      ctx.textAlign = 'right'
    }
    ctx.fillText(line, tx, ty)
    ty += lineH
  }
  ctx.textAlign = 'left'
}

function measureRowHeight(ctx, cells, widths, font, minH = 48) {
  ctx.font = font
  let maxLines = 1
  cells.forEach((text, i) => {
    const lines = wrapLines(ctx, text, widths[i] - 16)
    maxLines = Math.max(maxLines, lines.length)
  })
  return Math.max(minH, maxLines * 26 + 16)
}

/**
 * 综合样表结算图（对齐 Excel：四列明细 + 结算汇总）
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   title?: string,
 *   rows: Array<{ date: string, trucks?: string, laborNote?: string, workDays?: number|string }>,
 *   result: {
 *     truckCount: number, truckUnitPrice: number, truckFee: number,
 *     workDays: number, laborUnitPrice: number, laborFee: number,
 *     extras?: Array<{ name: string, amount: number }>,
 *     total: number
 *   }
 * }} payload
 */
export function paintMixedSettlementSheet(canvas, payload) {
  const title = payload.title || '车 / 做卫生 记账明细'
  const rows = payload.rows || []
  const r = payload.result || {}
  const extras = r.extras || []

  const pad = 28
  const tableW = 720
  const colW = [90, 120, 360, 150]
  const headerH = 52
  const minRowH = 48
  const fontCell = '22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontHead = 'bold 22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontTitle = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif'

  // 预计算高度
  const measureCtx = canvas.getContext('2d')
  measureCtx.font = fontCell
  const dataHeights = rows.map((row) =>
    measureRowHeight(
      measureCtx,
      [
        formatShortDate(row.date),
        row.trucks || '',
        row.laborNote || '',
        row.workDays === '' || row.workDays == null
          ? ''
          : String(Number(row.workDays).toFixed(1))
      ],
      colW,
      fontCell,
      minRowH
    )
  )
  // 至少留一行空行，贴近样表
  const emptyRows = rows.length === 0 ? 2 : 1
  for (let i = 0; i < emptyRows; i++) dataHeights.push(minRowH)

  const feeRows = []
  if (Number(r.truckCount) > 0 || Number(r.truckFee) > 0) {
    feeRows.push({
      label: '渣土车费',
      formula: `${r.truckCount} 车 × ${r.truckUnitPrice} 元/车`,
      amount: money(r.truckFee)
    })
  }
  feeRows.push({
    label: '做卫生人工费',
    formula: `${r.workDays} 人天 × ${r.laborUnitPrice} 元/人天`,
    amount: money(r.laborFee)
  })
  extras.forEach((x) => {
    feeRows.push({
      label: x.name || '零星',
      formula: '',
      amount: money(x.amount)
    })
  })

  const summaryHeadH = 48
  const feeRowH = 48
  const totalH = 56
  const titleBlock = 52
  const tableH =
    headerH +
    dataHeights.reduce((s, h) => s + h, 0) +
    summaryHeadH +
    feeRows.length * feeRowH +
    totalH

  const w = tableW + pad * 2
  const h = titleBlock + tableH + pad * 2 + 8
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = COLORS.page
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = COLORS.card
  fillRoundRect(ctx, pad - 8, pad - 8, tableW + 16, titleBlock + tableH + 16, 10)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  strokeRoundRect(ctx, pad - 8, pad - 8, tableW + 16, titleBlock + tableH + 16, 10)

  // 标题
  ctx.fillStyle = COLORS.title
  ctx.font = fontTitle
  ctx.textAlign = 'left'
  ctx.fillText(title, pad, pad + 34)

  let y = pad + titleBlock
  const x0 = pad

  // 表头
  ctx.fillStyle = COLORS.headerBg
  ctx.fillRect(x0, y, tableW, headerH)
  const heads = ['日期', '渣土车数', '做卫生人工记录', '折合人天']
  let cx = x0
  heads.forEach((label, i) => {
    drawCellText(ctx, label, cx, y, colW[i], headerH, {
      color: COLORS.headerText,
      font: fontHead
    })
    cx += colW[i]
  })
  // 表头竖线
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  cx = x0
  for (let i = 0; i < colW.length - 1; i++) {
    cx += colW[i]
    ctx.beginPath()
    ctx.moveTo(cx, y)
    ctx.lineTo(cx, y + headerH)
    ctx.stroke()
  }
  y += headerH

  // 数据行（含空行）
  const allCells = [
    ...rows.map((row) => [
      formatShortDate(row.date),
      row.trucks || '',
      row.laborNote || '',
      row.workDays === '' || row.workDays == null
        ? ''
        : Number(row.workDays).toFixed(1)
    ]),
    ...Array.from({ length: emptyRows }, () => ['', '', '', ''])
  ]

  allCells.forEach((cells, idx) => {
    const rh = dataHeights[idx]
    ctx.fillStyle = COLORS.card
    ctx.fillRect(x0, y, tableW, rh)
    ctx.strokeStyle = COLORS.border
    ctx.strokeRect(x0, y, tableW, rh)
    let xx = x0
    for (let i = 0; i < 4; i++) {
      if (i > 0) {
        ctx.beginPath()
        ctx.moveTo(xx, y)
        ctx.lineTo(xx, y + rh)
        ctx.stroke()
      }
      drawCellText(ctx, cells[i], xx, y, colW[i], rh, {
        font: fontCell,
        align: i === 2 ? 'left' : 'center',
        color: COLORS.text
      })
      xx += colW[i]
    }
    y += rh
  })

  // 结算汇总标题
  ctx.fillStyle = COLORS.summaryBg
  ctx.fillRect(x0, y, tableW, summaryHeadH)
  ctx.strokeStyle = COLORS.border
  ctx.strokeRect(x0, y, tableW, summaryHeadH)
  drawCellText(ctx, '结算汇总', x0, y, tableW, summaryHeadH, {
    font: 'bold 24px "PingFang SC","Microsoft YaHei",sans-serif',
    color: COLORS.text
  })
  y += summaryHeadH

  // 费用行：左标签 | 中公式 | 右金额
  const feeCols = [160, 400, 160]
  feeRows.forEach((fee) => {
    ctx.fillStyle = COLORS.card
    ctx.fillRect(x0, y, tableW, feeRowH)
    ctx.strokeStyle = COLORS.border
    ctx.strokeRect(x0, y, tableW, feeRowH)
    let xx = x0
    const texts = [fee.label, fee.formula, fee.amount]
    const aligns = ['center', 'center', 'right']
    feeCols.forEach((fw, i) => {
      if (i > 0) {
        ctx.beginPath()
        ctx.moveTo(xx, y)
        ctx.lineTo(xx, y + feeRowH)
        ctx.stroke()
      }
      drawCellText(ctx, texts[i], xx, y, fw, feeRowH, {
        font: fontCell,
        align: aligns[i],
        color: COLORS.text
      })
      xx += fw
    })
    y += feeRowH
  })

  // 总计行
  ctx.fillStyle = COLORS.totalBg
  ctx.fillRect(x0, y, tableW, totalH)
  ctx.strokeStyle = COLORS.border
  ctx.strokeRect(x0, y, tableW, totalH)
  drawCellText(ctx, `总计  ${money(r.total)}`, x0, y, tableW, totalH, {
    font: 'bold 28px "PingFang SC","Microsoft YaHei",sans-serif',
    align: 'right',
    color: COLORS.title
  })
}

/**
 * 纯工时账本结算图（同风格简化表）
 */
export function paintLaborSettlementSheet(canvas, payload) {
  const title = payload.title || '工时记账明细'
  const rows = payload.rows || []
  const r = payload.result || {}
  const extras = r.extras || []

  const mapped = {
    title,
    rows: rows.map((row) => ({
      date: row.date,
      trucks: '',
      laborNote: row.laborNote || row.summary || '',
      workDays: row.workDays
    })),
    result: {
      truckCount: 0,
      truckUnitPrice: 0,
      truckFee: 0,
      workDays: r.workDays,
      laborUnitPrice: r.unitPrice ?? r.laborUnitPrice,
      laborFee: r.laborFee,
      extras,
      total: r.total
    }
  }
  // 工时：表头改成更贴切的文案——复用绘制但改列名需专用路径
  paintLaborTable(canvas, mapped, rows, r, extras, title)
}

function paintLaborTable(canvas, _mapped, rows, r, extras, title) {
  const pad = 28
  const tableW = 720
  const colW = [120, 200, 200, 200]
  const headerH = 52
  const minRowH = 48
  const fontCell = '22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontHead = 'bold 22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontTitle = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif'

  const measureCtx = canvas.getContext('2d')
  const dataHeights = rows.map((row) =>
    measureRowHeight(
      measureCtx,
      [
        formatShortDate(row.date),
        String(row.peopleText || ''),
        String(row.daysText || ''),
        row.workDays == null ? '' : Number(row.workDays).toFixed(1)
      ],
      colW,
      fontCell,
      minRowH
    )
  )
  const emptyRows = rows.length === 0 ? 2 : 1
  for (let i = 0; i < emptyRows; i++) dataHeights.push(minRowH)

  const feeRows = [
    {
      label: '人工费',
      formula: `${r.workDays} 工日 × ${r.unitPrice ?? r.laborUnitPrice} 元/工日`,
      amount: money(r.laborFee)
    },
    ...extras.map((x) => ({
      label: x.name || '零星',
      formula: '',
      amount: money(x.amount)
    }))
  ]

  const summaryHeadH = 48
  const feeRowH = 48
  const totalH = 56
  const titleBlock = 52
  const tableH =
    headerH +
    dataHeights.reduce((s, h) => s + h, 0) +
    summaryHeadH +
    feeRows.length * feeRowH +
    totalH

  const w = tableW + pad * 2
  const h = titleBlock + tableH + pad * 2 + 8
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = COLORS.page
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = COLORS.card
  fillRoundRect(ctx, pad - 8, pad - 8, tableW + 16, titleBlock + tableH + 16, 10)
  ctx.strokeStyle = COLORS.border
  strokeRoundRect(ctx, pad - 8, pad - 8, tableW + 16, titleBlock + tableH + 16, 10)

  ctx.fillStyle = COLORS.title
  ctx.font = fontTitle
  ctx.fillText(title, pad, pad + 34)

  let y = pad + titleBlock
  const x0 = pad

  ctx.fillStyle = COLORS.headerBg
  ctx.fillRect(x0, y, tableW, headerH)
  ;['日期', '人数', '天数', '折合工日'].forEach((label, i) => {
    let xx = x0 + colW.slice(0, i).reduce((s, n) => s + n, 0)
    drawCellText(ctx, label, xx, y, colW[i], headerH, {
      color: COLORS.headerText,
      font: fontHead
    })
  })
  y += headerH

  const allCells = [
    ...rows.map((row) => [
      formatShortDate(row.date),
      String(row.peopleText || ''),
      String(row.daysText || ''),
      row.workDays == null ? '' : Number(row.workDays).toFixed(1)
    ]),
    ...Array.from({ length: emptyRows }, () => ['', '', '', ''])
  ]
  allCells.forEach((cells, idx) => {
    const rh = dataHeights[idx]
    ctx.fillStyle = COLORS.card
    ctx.fillRect(x0, y, tableW, rh)
    ctx.strokeStyle = COLORS.border
    ctx.strokeRect(x0, y, tableW, rh)
    let xx = x0
    cells.forEach((t, i) => {
      if (i > 0) {
        ctx.beginPath()
        ctx.moveTo(xx, y)
        ctx.lineTo(xx, y + rh)
        ctx.stroke()
      }
      drawCellText(ctx, t, xx, y, colW[i], rh, { font: fontCell })
      xx += colW[i]
    })
    y += rh
  })

  ctx.fillStyle = COLORS.summaryBg
  ctx.fillRect(x0, y, tableW, summaryHeadH)
  ctx.strokeRect(x0, y, tableW, summaryHeadH)
  drawCellText(ctx, '结算汇总', x0, y, tableW, summaryHeadH, {
    font: 'bold 24px "PingFang SC","Microsoft YaHei",sans-serif'
  })
  y += summaryHeadH

  const feeCols = [160, 400, 160]
  feeRows.forEach((fee) => {
    ctx.fillStyle = COLORS.card
    ctx.fillRect(x0, y, tableW, feeRowH)
    ctx.strokeRect(x0, y, tableW, feeRowH)
    let xx = x0
    ;[fee.label, fee.formula, fee.amount].forEach((t, i) => {
      if (i > 0) {
        ctx.beginPath()
        ctx.moveTo(xx, y)
        ctx.lineTo(xx, y + feeRowH)
        ctx.stroke()
      }
      drawCellText(ctx, t, xx, y, feeCols[i], feeRowH, {
        font: fontCell,
        align: i === 2 ? 'right' : 'center'
      })
      xx += feeCols[i]
    })
    y += feeRowH
  })

  ctx.fillStyle = COLORS.totalBg
  ctx.fillRect(x0, y, tableW, totalH)
  ctx.strokeRect(x0, y, tableW, totalH)
  drawCellText(ctx, `总计  ${money(r.total)}`, x0, y, tableW, totalH, {
    font: 'bold 28px "PingFang SC","Microsoft YaHei",sans-serif',
    align: 'right'
  })
}

/** @deprecated 旧版蓝头清单；请改用 paintMixedSettlementSheet */
export function paintSettlementImage(canvas, title, lines, total) {
  paintMixedSettlementSheet(canvas, {
    title: title || '结算明细',
    rows: [],
    result: {
      truckCount: 0,
      truckUnitPrice: 0,
      truckFee: 0,
      workDays: 0,
      laborUnitPrice: 0,
      laborFee: 0,
      extras: (lines || []).map((line) => ({ name: String(line), amount: 0 })),
      total
    }
  })
}

export function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png')
}

export function downloadCanvasPng(canvas, fileName) {
  const url = canvasToDataUrl(canvas)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'settlement.png'
  a.click()
}

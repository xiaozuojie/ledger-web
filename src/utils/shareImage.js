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

function colOffset(colW, index) {
  let x = 0
  for (let i = 0; i < index; i++) x += colW[i]
  return x
}

function drawVLines(ctx, x0, y, h, colW) {
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  let x = x0
  for (let i = 0; i < colW.length - 1; i++) {
    x += colW[i]
    ctx.beginPath()
    ctx.moveTo(x + 0.5, y)
    ctx.lineTo(x + 0.5, y + h)
    ctx.stroke()
  }
}

/**
 * 结算汇总区：与明细四列对齐
 * | 标签(日期+车次并) | 公式(人工记录列) | 金额(人天列) |
 * 总计行：前三列空，「总计」靠右贴金额列，金额列加粗
 */
function paintSummarySection(ctx, x0, y, colW, tableW, feeRows, total) {
  const summaryHeadH = 44
  const feeRowH = 52
  const totalH = 56
  const fontLabel = '22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontFormula = '22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontAmount = 'bold 22px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontSumHead = 'bold 23px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontTotalLabel = 'bold 24px "PingFang SC","Microsoft YaHei",sans-serif'
  const fontTotalAmt = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif'

  const labelW = colW[0] + colW[1]
  const formulaW = colW[2]
  const amountW = colW[3]
  const formulaX = x0 + labelW
  const amountX = formulaX + formulaW

  // —— 汇总标题（左对齐，更像 Excel）——
  ctx.fillStyle = COLORS.summaryBg
  ctx.fillRect(x0, y, tableW, summaryHeadH)
  ctx.strokeStyle = COLORS.border
  ctx.strokeRect(x0 + 0.5, y + 0.5, tableW - 1, summaryHeadH - 1)
  drawCellText(ctx, '结算汇总', x0, y, tableW, summaryHeadH, {
    font: fontSumHead,
    align: 'left',
    color: COLORS.title,
    pad: 14
  })
  y += summaryHeadH

  // —— 费用行 ——
  feeRows.forEach((fee) => {
    ctx.fillStyle = COLORS.card
    ctx.fillRect(x0, y, tableW, feeRowH)
    ctx.strokeStyle = COLORS.border
    ctx.strokeRect(x0 + 0.5, y + 0.5, tableW - 1, feeRowH - 1)
    // 竖线：在明细列边界（车次|人工、人工|人天）
    drawVLines(ctx, x0, y, feeRowH, colW)
    // 标签跨前两列
    drawCellText(ctx, fee.label, x0, y, labelW, feeRowH, {
      font: fontLabel,
      align: 'left',
      pad: 14,
      color: COLORS.text
    })
    drawCellText(ctx, fee.formula || '', formulaX, y, formulaW, feeRowH, {
      font: fontFormula,
      align: 'left',
      pad: 12,
      color: COLORS.muted
    })
    drawCellText(ctx, fee.amount, amountX, y, amountW, feeRowH, {
      font: fontAmount,
      align: 'right',
      pad: 14,
      color: COLORS.title
    })
    y += feeRowH
  })

  // —— 总计行：黄底；「总计」在公式列右对齐，金额在人天列 ——
  ctx.fillStyle = COLORS.totalBg
  ctx.fillRect(x0, y, tableW, totalH)
  ctx.strokeStyle = COLORS.border
  ctx.strokeRect(x0 + 0.5, y + 0.5, tableW - 1, totalH - 1)
  drawVLines(ctx, x0, y, totalH, colW)
  drawCellText(ctx, '总计', formulaX, y, formulaW, totalH, {
    font: fontTotalLabel,
    align: 'right',
    pad: 12,
    color: COLORS.title
  })
  drawCellText(ctx, money(total), amountX, y, amountW, totalH, {
    font: fontTotalAmt,
    align: 'right',
    pad: 14,
    color: COLORS.title
  })

  return y + totalH
}

export function summaryBlockHeight(feeCount) {
  return 44 + feeCount * 52 + 56
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

  const feeRows = [
    {
      label: '渣土车费',
      formula: `${r.truckCount ?? 0} 车 × ${r.truckUnitPrice ?? 0} 元/车`,
      amount: money(r.truckFee)
    },
    {
      label: '做卫生人工费',
      formula: `${r.workDays ?? 0} 人天 × ${r.laborUnitPrice ?? 0} 元/人天`,
      amount: money(r.laborFee)
    },
    ...extras.map((x) => ({
      label: x.name || '零星',
      formula: '',
      amount: money(x.amount)
    }))
  ]

  const titleBlock = 52
  const sumH = summaryBlockHeight(feeRows.length)
  const tableH =
    headerH + dataHeights.reduce((s, h) => s + h, 0) + sumH

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
  drawVLines(ctx, x0, y, headerH, colW)
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
    ctx.strokeRect(x0 + 0.5, y + 0.5, tableW - 1, rh - 1)
    drawVLines(ctx, x0, y, rh, colW)
    let xx = x0
    for (let i = 0; i < 4; i++) {
      drawCellText(ctx, cells[i], xx, y, colW[i], rh, {
        font: fontCell,
        align: i === 2 ? 'left' : i === 3 ? 'right' : 'center',
        color: COLORS.text,
        pad: i === 2 || i === 3 ? 12 : 8
      })
      xx += colW[i]
    }
    y += rh
  })

  paintSummarySection(ctx, x0, y, colW, tableW, feeRows, r.total)
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

  const titleBlock = 52
  const sumH = summaryBlockHeight(feeRows.length)
  const tableH =
    headerH + dataHeights.reduce((s, h) => s + h, 0) + sumH

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
    const xx = x0 + colOffset(colW, i)
    drawCellText(ctx, label, xx, y, colW[i], headerH, {
      color: COLORS.headerText,
      font: fontHead
    })
  })
  drawVLines(ctx, x0, y, headerH, colW)
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
    ctx.strokeRect(x0 + 0.5, y + 0.5, tableW - 1, rh - 1)
    drawVLines(ctx, x0, y, rh, colW)
    let xx = x0
    cells.forEach((t, i) => {
      drawCellText(ctx, t, xx, y, colW[i], rh, {
        font: fontCell,
        align: i === 3 ? 'right' : 'center',
        pad: i === 3 ? 12 : 8
      })
      xx += colW[i]
    })
    y += rh
  })

  paintSummarySection(ctx, x0, y, colW, tableW, feeRows, r.total)
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

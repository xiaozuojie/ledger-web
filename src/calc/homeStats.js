import { computeMixed, computeLabor } from './settlement.js'
import { computePersonal } from './personal.js'
import { formatDate } from '../utils/date.js'

function parseYmd(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = day === 0 ? 6 : day - 1
  x.setDate(x.getDate() - diff)
  return x
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function inRange(dateStr, from, to) {
  const d = parseYmd(dateStr)
  if (!d) return false
  return d >= from && d <= to
}

/**
 * 首页汇总：现场账用合计；个人账时间维度用「支出」金额。
 */
export function aggregateHomeStats(ledgers, opts = {}) {
  const now = opts.now || new Date()
  const today = formatDate(now)
  const weekFrom = startOfWeek(now)
  const weekTo = new Date(
    weekFrom.getFullYear(),
    weekFrom.getMonth(),
    weekFrom.getDate() + 6
  )
  const monthFrom = startOfMonth(now)
  const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const byLedger = []
  let todayAmount = 0
  let todayCount = 0
  let weekAmount = 0
  let weekCount = 0
  let monthAmount = 0
  let monthCount = 0
  /** @type {Record<string, { id: string, name: string, amount: number }>} */
  const compositionMap = {}

  for (const led of ledgers || []) {
    const entries = led.entries || []
    const extras = led.extras || []
    const rates = led.rates || {}

    if (led.settlement_kind === 'personal') {
      const full = computePersonal({
        entries,
        budget: led.budget,
        categories: led.categories
      })
      byLedger.push({
        id: led.id,
        name: led.name,
        invite_slug: led.invite_slug,
        settlement_kind: 'personal',
        entryCount: full.entryCount,
        truckCount: 0,
        workDays: 0,
        total: full.expense,
        income: full.income,
        net: full.net
      })

      const todayEntries = entries.filter((e) => e.date === today)
      if (todayEntries.length) {
        const r = computePersonal({
          entries: todayEntries,
          categories: led.categories
        })
        todayAmount += r.expense
        todayCount += todayEntries.length
      }

      const weekEntries = entries.filter((e) =>
        inRange(e.date, weekFrom, weekTo)
      )
      if (weekEntries.length) {
        const r = computePersonal({
          entries: weekEntries,
          categories: led.categories
        })
        weekAmount += r.expense
        weekCount += weekEntries.length
      }

      const monthResult = computePersonal({
        entries,
        budget: led.budget,
        categories: led.categories,
        monthPrefix
      })
      monthAmount += monthResult.expense
      monthCount += monthResult.entryCount

      for (const line of monthResult.composition || []) {
        if (!line.amount || line.direction === 'income') continue
        const key = `p:${line.id}`
        if (!compositionMap[key]) {
          compositionMap[key] = {
            id: line.id,
            name: line.name,
            amount: 0
          }
        }
        compositionMap[key].amount += Number(line.amount) || 0
      }
      continue
    }

    const compute =
      led.settlement_kind === 'labor' ? computeLabor : computeMixed
    const full = compute({
      entries,
      rates,
      extras,
      feeTypes: led.feeTypes,
      ledger: led
    })

    byLedger.push({
      id: led.id,
      name: led.name,
      invite_slug: led.invite_slug,
      settlement_kind: led.settlement_kind,
      entryCount: full.entryCount,
      truckCount: full.truckCount,
      workDays: full.workDays,
      total: full.total
    })

    const todayEntries = entries.filter((e) => e.date === today)
    if (todayEntries.length) {
      const r = compute({
        entries: todayEntries,
        rates,
        extras: [],
        feeTypes: led.feeTypes,
        ledger: led
      })
      todayAmount += r.total
      todayCount += todayEntries.length
    }

    const weekEntries = entries.filter((e) =>
      inRange(e.date, weekFrom, weekTo)
    )
    if (weekEntries.length) {
      const r = compute({
        entries: weekEntries,
        rates,
        extras: [],
        feeTypes: led.feeTypes,
        ledger: led
      })
      weekAmount += r.total
      weekCount += weekEntries.length
    }

    const monthEntries = entries.filter((e) =>
      inRange(e.date, monthFrom, monthTo)
    )
    const monthResult = compute({
      entries: monthEntries,
      rates,
      extras,
      feeTypes: led.feeTypes,
      ledger: led
    })
    monthAmount += monthResult.total
    monthCount += monthEntries.length

    for (const line of monthResult.feeBreakdown || []) {
      if (!line.amount) continue
      const key = line.id || line.name
      if (!compositionMap[key]) {
        compositionMap[key] = {
          id: line.id,
          name: line.name,
          amount: 0
        }
      }
      compositionMap[key].amount += Number(line.amount) || 0
    }
  }

  const composition = Object.values(compositionMap).sort(
    (a, b) => b.amount - a.amount
  )
  const compositionTotal = composition.reduce((s, x) => s + x.amount, 0)

  return {
    byLedger: byLedger.sort((a, b) => b.total - a.total),
    byTime: {
      today: { amount: todayAmount, count: todayCount },
      week: { amount: weekAmount, count: weekCount },
      month: { amount: monthAmount, count: monthCount }
    },
    composition: composition.map((x) => ({
      ...x,
      pct: compositionTotal
        ? Math.round((x.amount / compositionTotal) * 1000) / 10
        : 0
    })),
    compositionTotal
  }
}

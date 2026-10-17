import { sumWorkDays, laborTotal } from './hours.js'
import { parseTruckCount } from './trucks.js'

/** 单行当日零星金额 */
export function entryExtrasSum(entry) {
  const list = entryExtrasList(entry)
  return list.reduce((s, x) => s + (Number(x.amount) || 0), 0)
}

export function entryExtrasList(entry) {
  if (!entry) return []
  if (Array.isArray(entry.extras) && entry.extras.length) return entry.extras
  const fromFields = entry.fields && entry.fields.dayExtras
  return Array.isArray(fromFields) ? fromFields : []
}

/** 全部明细的当日零星合计 */
export function sumEntryExtras(entries) {
  return (entries || []).reduce((s, e) => s + entryExtrasSum(e), 0)
}

function ledgerExtrasSum(extras) {
  return (extras || []).reduce((s, x) => s + (Number(x.amount) || 0), 0)
}

export function computeMixed({ entries, rates, extras }) {
  const workDays = sumWorkDays(entries)
  const truckCount = (entries || []).reduce((s, e) => {
    const f = e.fields || {}
    return s + parseTruckCount(f.trucks || '')
  }, 0)
  const truckUnit = rates?.truckUnitPrice ?? 100
  const laborUnit = rates?.laborUnitPrice ?? 230
  const truckFee = truckCount * truckUnit
  const laborFee = laborTotal(workDays, laborUnit)
  const list = extras || []
  const dayExtrasSum = sumEntryExtras(entries)
  const bookExtrasSum = ledgerExtrasSum(list)
  const extrasSum = dayExtrasSum + bookExtrasSum
  return {
    kind: 'mixed',
    workDays,
    truckCount,
    truckUnitPrice: truckUnit,
    laborUnitPrice: laborUnit,
    truckFee,
    laborFee,
    extras: list,
    dayExtrasSum,
    bookExtrasSum,
    extrasSum,
    total: truckFee + laborFee + extrasSum,
    entryCount: (entries || []).length
  }
}

export function computeLabor({ entries, rates, extras }) {
  const workDays = sumWorkDays(entries)
  const unitPrice = rates?.laborUnitPrice ?? 300
  const laborFee = laborTotal(workDays, unitPrice)
  const list = extras || []
  const dayExtrasSum = sumEntryExtras(entries)
  const bookExtrasSum = ledgerExtrasSum(list)
  const extrasSum = dayExtrasSum + bookExtrasSum
  return {
    kind: 'labor',
    workDays,
    unitPrice,
    laborFee,
    extras: list,
    dayExtrasSum,
    bookExtrasSum,
    extrasSum,
    total: laborFee + extrasSum,
    entryCount: (entries || []).length
  }
}

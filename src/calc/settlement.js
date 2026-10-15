import { sumWorkDays, laborTotal } from './hours.js'
import { parseTruckCount } from './trucks.js'

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
  const extrasSum = list.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  return {
    kind: 'mixed',
    workDays,
    truckCount,
    truckUnitPrice: truckUnit,
    laborUnitPrice: laborUnit,
    truckFee,
    laborFee,
    extras: list,
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
  const extrasSum = list.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  return {
    kind: 'labor',
    workDays,
    unitPrice,
    laborFee,
    extras: list,
    extrasSum,
    total: laborFee + extrasSum,
    entryCount: (entries || []).length
  }
}

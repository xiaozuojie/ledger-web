import { sumWorkDays, laborTotal } from './hours.js'
import { parseTruckCount } from './trucks.js'
import {
  entryExtrasSum,
  entryExtrasList,
  sumEntryExtras
} from './settlementExtras.js'
import {
  buildFeeBreakdown,
  feeTypesOfLedger,
  normalizeFeeTypes,
  BUILTIN_IDS
} from './feeTypes.js'

export { entryExtrasSum, entryExtrasList, sumEntryExtras }

function attachLegacyFields(base, feeBreakdown) {
  const truck = feeBreakdown.find((x) => x.id === BUILTIN_IDS.truck) || {}
  const labor = feeBreakdown.find((x) => x.id === BUILTIN_IDS.labor) || {}
  const customSum = feeBreakdown
    .filter(
      (x) => x.id !== BUILTIN_IDS.truck && x.id !== BUILTIN_IDS.labor
    )
    .reduce((s, x) => s + (Number(x.amount) || 0), 0)
  return {
    ...base,
    workDays: labor.qty ?? base.workDays,
    truckCount: truck.qty ?? base.truckCount,
    truckUnitPrice: truck.unitPrice ?? base.truckUnitPrice,
    laborUnitPrice: labor.unitPrice ?? base.laborUnitPrice,
    truckFee: truck.amount ?? 0,
    laborFee: labor.amount ?? 0,
    customFeeSum: customSum,
    feeBreakdown,
    total: (truck.amount || 0) + (labor.amount || 0) + customSum
  }
}

/**
 * @param {{ entries, rates, extras, feeTypes?, ledger? }} opts
 */
export function computeMixed({ entries, rates, extras, feeTypes, ledger }) {
  const types =
    feeTypes ||
    (ledger ? feeTypesOfLedger(ledger) : null) ||
    normalizeFeeTypes(null, 'mixed')

  // 同步内置单价：rates 优先覆盖内置 truck/labor 的展示单价
  const synced = types.map((t) => {
    if (t.id === BUILTIN_IDS.truck && rates?.truckUnitPrice != null) {
      return { ...t, unitPrice: Number(rates.truckUnitPrice) }
    }
    if (t.id === BUILTIN_IDS.labor && rates?.laborUnitPrice != null) {
      return { ...t, unitPrice: Number(rates.laborUnitPrice) }
    }
    return t
  })

  const feeBreakdown = buildFeeBreakdown({
    feeTypes: synced,
    entries,
    rates,
    extras
  })

  const workDays = sumWorkDays(entries)
  const truckCount = (entries || []).reduce((s, e) => {
    const f = e.fields || {}
    return s + parseTruckCount(f.trucks || '')
  }, 0)
  const truckUnit = rates?.truckUnitPrice ?? 100
  const laborUnit = rates?.laborUnitPrice ?? 230
  const list = []
  const dayExtrasSum = 0
  const bookExtrasSum = 0
  const extrasSum = 0

  const base = {
    kind: 'mixed',
    workDays,
    truckCount,
    truckUnitPrice: truckUnit,
    laborUnitPrice: laborUnit,
    truckFee: truckCount * truckUnit,
    laborFee: laborTotal(workDays, laborUnit),
    extras: list,
    dayExtrasSum,
    bookExtrasSum,
    extrasSum,
    entryCount: (entries || []).length
  }

  return attachLegacyFields(base, feeBreakdown)
}

export function computeLabor({ entries, rates, extras, feeTypes, ledger }) {
  const types =
    feeTypes ||
    (ledger ? feeTypesOfLedger({ ...ledger, settlement_kind: 'labor' }) : null) ||
    normalizeFeeTypes(null, 'labor')

  const synced = types.map((t) => {
    if (t.id === BUILTIN_IDS.truck && rates?.truckUnitPrice != null) {
      return { ...t, unitPrice: Number(rates.truckUnitPrice) }
    }
    if (t.id === BUILTIN_IDS.labor && rates?.laborUnitPrice != null) {
      return { ...t, unitPrice: Number(rates.laborUnitPrice) }
    }
    return t
  })

  const feeBreakdown = buildFeeBreakdown({
    feeTypes: synced,
    entries,
    rates,
    extras
  })

  const workDays = sumWorkDays(entries)
  const unitPrice = rates?.laborUnitPrice ?? 300
  const laborFee = laborTotal(workDays, unitPrice)
  const truckCount = (entries || []).reduce((s, e) => {
    const f = e.fields || {}
    return s + parseTruckCount(f.trucks || '')
  }, 0)
  const truckUnit = rates?.truckUnitPrice ?? 100
  const truckFee = truckCount * truckUnit
  const list = []
  const dayExtrasSum = 0
  const bookExtrasSum = 0
  const extrasSum = 0

  const base = {
    kind: 'labor',
    workDays,
    unitPrice,
    laborFee,
    truckCount,
    truckUnitPrice: truckUnit,
    truckFee,
    extras: list,
    dayExtrasSum,
    bookExtrasSum,
    extrasSum,
    entryCount: (entries || []).length
  }

  return attachLegacyFields(base, feeBreakdown)
}

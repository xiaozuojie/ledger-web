import { hasSupabase } from '../lib/supabase.js'
import * as local from './localApi.js'
import * as cloud from './supabaseApi.js'

/**
 * 有 Supabase 密钥且未强制 local → 云端；
 * VITE_DATA_MODE=local 或未配置 → 本地。
 */
const forceLocal = import.meta.env.VITE_DATA_MODE === 'local'
const useLocal = forceLocal || !hasSupabase

const api = useLocal ? local : cloud

export const dataMode = useLocal ? 'local' : 'supabase'
export const cloudConfigured = hasSupabase && !forceLocal

export const listTemplates = (...a) => api.listTemplates(...a)
export const listLedgers = (...a) => api.listLedgers(...a)
export const createLedger = (...a) => api.createLedger(...a)
export const openLedger = (...a) => api.openLedger(...a)
export const unlockLedger = (...a) => api.unlockLedger(...a)
export const logout = (...a) => api.logout(...a)
export const getLedger = (...a) => api.getLedger(...a)
export const updateRates = (...a) => api.updateRates(...a)
export const listEntries = (...a) => api.listEntries(...a)
export const upsertEntry = (...a) => api.upsertEntry(...a)
export const removeEntry = (...a) => api.removeEntry(...a)
export const listExtras = (...a) => api.listExtras(...a)
export const addExtra = (...a) => api.addExtra(...a)
export const removeExtra = (...a) => api.removeExtra(...a)
export const getTemplate = (...a) => api.getTemplate(...a)
export const cloneTemplate = (...a) => api.cloneTemplate(...a)
export const updateTemplate = (...a) => api.updateTemplate(...a)
export const listAllLedgerBundles = (...a) => api.listAllLedgerBundles(...a)
export const listFeeTypes = (...a) => api.listFeeTypes(...a)
export const addFeeType = (...a) => api.addFeeType(...a)
export const updateFeeType = (...a) => api.updateFeeType(...a)
export const removeFeeType = (...a) => api.removeFeeType(...a)
export const createLedgerByMode = (...a) => api.createLedgerByMode(...a)
export const updateBudget = (...a) => api.updateBudget(...a)
export const bulkAddPersonalEntries = (...a) => api.bulkAddPersonalEntries(...a)
export const listAccounts = (...a) => api.listAccounts(...a)
export const upsertAccount = (...a) => api.upsertAccount(...a)
export const removeAccount = (...a) => api.removeAccount(...a)
export const listGoals = (...a) => api.listGoals(...a)
export const upsertGoal = (...a) => api.upsertGoal(...a)
export const removeGoal = (...a) => api.removeGoal(...a)
export const importPersonalCsv = (...a) => api.importPersonalCsv(...a)
export const exportBackup = (...a) => api.exportBackup(...a)
export const importBackup = (...a) => api.importBackup(...a)

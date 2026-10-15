import { hasSupabase } from '../lib/supabase.js'
import * as local from './localApi.js'
import * as cloud from './supabaseApi.js'

/** 未配置 Supabase 时自动用本地存储，手机打开即可用 */
const useLocal =
  import.meta.env.VITE_DATA_MODE === 'local' ||
  !hasSupabase ||
  import.meta.env.VITE_DATA_MODE !== 'supabase'

const api = useLocal ? local : cloud

export const dataMode = useLocal ? 'local' : 'supabase'

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

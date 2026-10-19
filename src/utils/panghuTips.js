import { todayStr } from './date.js'

const DISMISS_KEY = 'panghu_tip_dismissed_day'

const ROTATE = [
  '胖虎说：记一笔不丢人，月底对账才丢人。',
  '胖虎说：车次人天今日清，少翻旧账少生气。',
  '胖虎说：午饭也能记，积少成多才看得见。',
  '胖虎说：开放链接分享给工友，各记各的也行。',
  '胖虎说：清缓存会丢本机账，记得去「我的」备份。'
]

export function tipDismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayStr()
  } catch {
    return false
  }
}

export function dismissTipToday() {
  try {
    localStorage.setItem(DISMISS_KEY, todayStr())
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   kind?: string,
 *   todayEntryCount?: number,
 *   budgetPct?: number,
 *   budgetLeft?: number|null,
 *   hasLedgers?: boolean
 * }} ctx
 */
export function pickPanghuTip(ctx = {}) {
  if (ctx.budgetPct != null && ctx.budgetPct >= 100) {
    return {
      id: 'budget-over',
      tone: 'warn',
      text: '胖虎提醒：本月预算已经花超了，先喘口气再记。'
    }
  }
  if (ctx.budgetPct != null && ctx.budgetPct >= 80) {
    return {
      id: 'budget-high',
      tone: 'warn',
      text: `胖虎提醒：预算用了 ${ctx.budgetPct}%，还剩 ${ctx.budgetLeft ?? '？'} 元。`
    }
  }
  if (ctx.kind === 'personal' && (ctx.todayEntryCount || 0) === 0) {
    return {
      id: 'personal-empty',
      tone: 'info',
      text: '胖虎说：今天还没记。一句话也能记：午饭30 打车15。'
    }
  }
  if (
    (ctx.kind === 'mixed' || ctx.kind === 'labor') &&
    (ctx.todayEntryCount || 0) === 0
  ) {
    return {
      id: 'field-empty',
      tone: 'info',
      text: '胖虎说：现场今天还没落笔，点「记一笔」就行。'
    }
  }
  if (ctx.hasLedgers === false) {
    return {
      id: 'no-ledger',
      tone: 'info',
      text: '胖虎说：先建一本账吧——现场综合、工时或个人账任选。'
    }
  }
  const day = todayStr()
  const idx =
    [...day].reduce((s, c) => s + c.charCodeAt(0), 0) % ROTATE.length
  return { id: 'rotate', tone: 'info', text: ROTATE[idx] }
}

import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getSession } from './lib/session.js'
import HomeView from './views/HomeView.vue'
import OpenLedgerView from './views/OpenLedgerView.vue'
import MixedSheetView from './views/MixedSheetView.vue'
import LaborLedgerView from './views/LaborLedgerView.vue'
import EntryEditView from './views/EntryEditView.vue'
import TemplatesView from './views/TemplatesView.vue'
import TemplateEditView from './views/TemplateEditView.vue'
import TodayView from './views/TodayView.vue'
import StatsView from './views/StatsView.vue'
import MineView from './views/MineView.vue'
import FeeTypesView from './views/FeeTypesView.vue'
import PersonalTodayView from './views/PersonalTodayView.vue'
import PersonalEntryView from './views/PersonalEntryView.vue'
import AuthView from './views/AuthView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/auth', name: 'auth', component: AuthView },
    {
      path: '/l/:slug',
      name: 'open',
      component: OpenLedgerView
    },
    {
      path: '/today',
      name: 'today',
      component: TodayView,
      meta: { auth: true }
    },
    {
      path: '/ledger/mixed',
      name: 'mixed',
      component: MixedSheetView,
      meta: { auth: true }
    },
    {
      path: '/ledger/labor',
      name: 'labor',
      component: LaborLedgerView,
      meta: { auth: true }
    },
    {
      path: '/types',
      name: 'fee-types',
      component: FeeTypesView,
      meta: { auth: true }
    },
    {
      path: '/stats',
      name: 'stats',
      component: StatsView,
      meta: { auth: true }
    },
    {
      path: '/personal/today',
      name: 'personal-today',
      component: PersonalTodayView,
      meta: { auth: true }
    },
    {
      path: '/personal/entry',
      name: 'personal-entry',
      component: PersonalEntryView,
      meta: { auth: true }
    },
    {
      path: '/mine',
      name: 'mine',
      component: MineView,
      meta: { auth: true }
    },
    {
      path: '/entry',
      name: 'entry',
      component: EntryEditView,
      meta: { auth: true }
    },
    {
      path: '/templates',
      name: 'templates',
      component: TemplatesView,
      meta: { auth: true }
    },
    {
      path: '/templates/edit',
      name: 'template-edit',
      component: TemplateEditView,
      meta: { auth: true }
    }
  ]
})

router.beforeEach((to) => {
  if (to.meta.auth && !getToken()) {
    return { name: 'home' }
  }
  return true
})

export function ledgerHomeRoute() {
  const s = getSession()
  if (!s) return { name: 'home' }
  if (s.settlement_kind === 'personal') return { name: 'personal-today' }
  if (s.settlement_kind === 'mixed') return { name: 'today' }
  return { name: 'labor' }
}

export default router

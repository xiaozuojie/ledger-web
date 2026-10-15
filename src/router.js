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
import MineView from './views/MineView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
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
  return s.settlement_kind === 'mixed'
    ? { name: 'today' }
    : { name: 'labor' }
}

export default router

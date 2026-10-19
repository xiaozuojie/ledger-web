<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getToken } from './lib/session.js'
import AppTabBar from './components/AppTabBar.vue'

const route = useRoute()

const showTabBar = computed(() => {
  if (!getToken()) return false
  const hide = new Set([
    'home',
    'auth',
    'open',
    'entry',
    'personal-entry',
    'template-edit',
    'templates',
    'widget'
  ])
  return !hide.has(route.name)
})
</script>

<template>
  <div class="wrap" :class="{ 'has-tabbar': showTabBar }">
    <router-view />
    <AppTabBar v-if="showTabBar" />
  </div>
</template>

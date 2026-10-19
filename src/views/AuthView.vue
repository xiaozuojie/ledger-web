<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signIn, signUp } from '../lib/auth.js'
import { hasSupabase } from '../lib/supabase.js'

const router = useRouter()
const route = useRoute()
const mode = ref(route.query.mode === 'signup' ? 'signup' : 'login')
const email = ref('')
const password = ref('')
const err = ref('')
const hint = ref('')
const busy = ref(false)

async function submit() {
  err.value = ''
  hint.value = ''
  if (!hasSupabase) {
    err.value = '未配置云端，请在 .env 填写 VITE_SUPABASE_URL 与 ANON_KEY'
    return
  }
  if (!email.value.trim() || password.value.length < 6) {
    err.value = '请填写邮箱，密码至少 6 位'
    return
  }
  busy.value = true
  try {
    if (mode.value === 'signup') {
      const data = await signUp(email.value, password.value)
      if (data.session) {
        hint.value = '注册成功，已登录'
        router.replace({ name: 'home' })
      } else {
        hint.value =
          '注册成功。若项目开启了邮箱确认，请先到邮箱点链接再登录。'
        mode.value = 'login'
      }
    } else {
      await signIn(email.value, password.value)
      router.replace({ name: 'home' })
    }
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <header class="page-hero">
    <div class="brand-mark">PANGHU</div>
    <h1>{{ mode === 'signup' ? '注册' : '登录' }}</h1>
    <p class="lead">云端账本跟账号走，换手机也能打开</p>
  </header>

  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="hint" class="hint-ok">{{ hint }}</p>

  <section class="card">
    <label>邮箱</label>
    <input v-model="email" type="email" autocomplete="username" placeholder="you@example.com" />
    <label>密码</label>
    <input
      v-model="password"
      type="password"
      autocomplete="current-password"
      placeholder="至少 6 位"
      @keyup.enter="submit"
    />
    <button
      class="btn btn-primary btn-block"
      type="button"
      :disabled="busy"
      @click="submit"
    >
      {{ busy ? '请稍候…' : mode === 'signup' ? '注册' : '登录' }}
    </button>
    <button
      class="btn btn-ghost btn-block"
      type="button"
      style="margin-top: 8px"
      @click="mode = mode === 'signup' ? 'login' : 'signup'"
    >
      {{ mode === 'signup' ? '已有账号？去登录' : '没有账号？去注册' }}
    </button>
    <button
      class="btn btn-ghost btn-block"
      type="button"
      style="margin-top: 8px"
      @click="router.push({ name: 'home' })"
    >
      返回首页
    </button>
  </section>
</template>

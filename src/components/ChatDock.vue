<script setup>
import { ref } from 'vue'
import { parseChat } from '../calc/parseChat.js'
import { canSpeak, listenOnce } from '../utils/speechInput.js'
import PanghuMark from './PanghuMark.vue'

const props = defineProps({
  saving: { type: Boolean, default: false }
})
const emit = defineEmits(['save'])

const draft = ref('')
const listening = ref(false)
const messages = ref([
  {
    role: 'panghu',
    text: '直接说或粘贴。例如：午饭30 打车15，或贴一段微信支付通知。'
  }
])
const pending = ref([])

function push(role, text) {
  messages.value = [...messages.value, { role, text }].slice(-12)
}

function review(text) {
  const raw = String(text || '').trim()
  if (!raw) return
  push('me', raw)
  const rows = parseChat(raw)
  pending.value = rows
  if (!rows.length) {
    push('panghu', '没认出金额。试试「午饭30」，或贴「向美团付款18.5元」。')
    return
  }
  const lines = rows
    .map((r) => `${r.direction === 'income' ? '收' : '支'} ${r.note} ${r.amount}`)
    .join('，')
  push('panghu', `我看成：${lines}。确认后记入今天。`)
}

function send() {
  review(draft.value)
  draft.value = ''
}

async function speak() {
  if (!canSpeak()) {
    push('panghu', '这个浏览器没有语音识别，请用 Chrome，或直接打字。')
    return
  }
  listening.value = true
  try {
    const text = await listenOnce()
    if (text) {
      draft.value = text
      review(text)
    }
  } catch (e) {
    push('panghu', e.message || '语音没听清')
  } finally {
    listening.value = false
  }
}

function confirm() {
  if (!pending.value.length || props.saving) return
  emit('save', pending.value.slice())
  pending.value = []
  push('panghu', '记下了。')
}
</script>

<template>
  <section class="card chat-dock">
    <div class="chat-head">
      <PanghuMark />
      <div>
        <strong>跟胖虎说</strong>
        <p class="muted">语音、一句话、粘贴支付通知。不是云端大模型。</p>
      </div>
    </div>
    <div class="chat-log">
      <p v-for="(m, i) in messages" :key="i" :class="m.role">{{ m.text }}</p>
    </div>
    <label>说一笔或贴通知</label>
    <textarea v-model="draft" rows="2" placeholder="午饭30 打车15" />
    <div class="btn-row">
      <button class="btn btn-ghost" type="button" :disabled="listening" @click="speak">
        {{ listening ? '在听…' : '语音' }}
      </button>
      <button class="btn btn-primary" type="button" @click="send">发给胖虎</button>
    </div>
    <button
      v-if="pending.length"
      class="btn btn-primary btn-block"
      type="button"
      style="margin-top: 8px"
      :disabled="saving"
      @click="confirm"
    >
      {{ saving ? '保存中…' : `确认记入 ${pending.length} 笔` }}
    </button>
  </section>
</template>

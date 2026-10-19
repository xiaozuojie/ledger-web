<script setup>
import { computed, ref, watch } from 'vue'
import {
  dismissTipToday,
  pickPanghuTip,
  tipDismissedToday
} from '../utils/panghuTips.js'

const props = defineProps({
  ctx: { type: Object, default: () => ({}) }
})

const hidden = ref(tipDismissedToday())
const tip = computed(() => pickPanghuTip(props.ctx))

watch(
  () => props.ctx,
  () => {
    if (!tipDismissedToday()) hidden.value = false
  },
  { deep: true }
)

function dismiss() {
  dismissTipToday()
  hidden.value = true
}
</script>

<template>
  <div
    v-if="!hidden && tip"
    class="panghu-tip"
    :class="tip.tone === 'warn' ? 'warn' : 'info'"
  >
    <p>{{ tip.text }}</p>
    <button type="button" class="linkish" @click="dismiss">今日不再显示</button>
  </div>
</template>

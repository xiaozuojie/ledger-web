<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  visible: { type: Boolean, default: false },
  ms: { type: Number, default: 5000 }
})
const emit = defineEmits(['undo', 'expire'])

const left = ref(0)
let timer = null
let tick = null

function clear() {
  if (timer) clearTimeout(timer)
  if (tick) clearInterval(tick)
  timer = null
  tick = null
}

watch(
  () => props.visible,
  (v) => {
    clear()
    if (!v) return
    left.value = Math.ceil(props.ms / 1000)
    tick = setInterval(() => {
      left.value = Math.max(0, left.value - 1)
    }, 1000)
    timer = setTimeout(() => {
      clear()
      emit('expire')
    }, props.ms)
  }
)

onBeforeUnmount(clear)

function onUndo() {
  clear()
  emit('undo')
}
</script>

<template>
  <div v-if="visible" class="undo-toast" role="status">
    <span>{{ message }}{{ left ? `（${left}s）` : '' }}</span>
    <button type="button" class="undo-btn" @click="onUndo">撤销</button>
  </div>
</template>

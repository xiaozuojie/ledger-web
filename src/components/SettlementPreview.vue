<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  src: { type: String, default: '' },
  title: { type: String, default: '结算图' }
})
const emit = defineEmits(['close'])

const canShare = computed(
  () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'
)

function onClose() {
  emit('close')
}

async function onShare() {
  if (!props.src) return
  try {
    const res = await fetch(props.src)
    const blob = await res.blob()
    const file = new File([blob], 'settlement.png', { type: 'image/png' })
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      throw new Error('unsupported')
    }
    await navigator.share({
      files: [file],
      title: props.title,
      text: props.title
    })
  } catch {
    // 分享不可用时退回长按图片保存
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="preview-mask" @click.self="onClose">
      <div class="preview-sheet" role="dialog" aria-modal="true" :aria-label="title">
        <div class="preview-head">
          <strong>{{ title }}</strong>
          <button type="button" class="btn btn-ghost preview-close" @click="onClose">
            关闭
          </button>
        </div>
        <div class="preview-body">
          <img :src="src" alt="结算图" class="preview-img" />
          <p class="muted preview-tip">长按图片可保存到相册</p>
        </div>
        <div class="preview-actions">
          <button
            v-if="canShare"
            type="button"
            class="btn btn-primary btn-block"
            @click="onShare"
          >
            分享给好友
          </button>
          <button type="button" class="btn btn-ghost btn-block" @click="onClose">
            完成
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

export function canSpeak() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
}

/** 说完一句就结束。Chrome 可用；不支持时抛中文错误。 */
export function listenOnce() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) {
    return Promise.reject(new Error('当前浏览器没有语音识别，请用 Chrome'))
  }
  return new Promise((resolve, reject) => {
    const rec = new Ctor()
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || ''
      resolve(String(text).trim())
    }
    rec.onerror = (event) => {
      const code = event?.error || 'error'
      if (code === 'not-allowed') {
        reject(new Error('麦克风被拒绝，请允许后再试'))
        return
      }
      reject(new Error('语音识别失败'))
    }
    rec.start()
  })
}

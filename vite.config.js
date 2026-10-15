import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_PAGES_BASE || '/'
  return {
    base,
    plugins: [vue()],
    test: { environment: 'node' }
  }
})

import { defineConfig } from 'vite'

const COOP_HEADERS = {
  'Cross-Origin-Opener-Policy':  'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  server:  { port: 5173, headers: COOP_HEADERS },
  preview: { headers: COOP_HEADERS },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
})

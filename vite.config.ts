import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const COOP_HEADERS = {
  'Cross-Origin-Opener-Policy':  'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const excluirWasmOrt: Plugin = {
  name: 'excluir-wasm-ort',
  generateBundle(_, bundle) {
    for (const key of Object.keys(bundle)) {
      if (key.endsWith('.wasm')) delete bundle[key]
    }
  }
}

export default defineConfig({
  server:  { port: 5173, headers: COOP_HEADERS, allowedHosts: true },
  preview: { headers: COOP_HEADERS },
  optimizeDeps: {
    exclude: ['onnxruntime-web', '@mediapipe/tasks-vision']
  },
  build: {
    rollupOptions: {
      plugins: [excluirWasmOrt]
    }
  }
})

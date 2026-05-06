import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const COOP_HEADERS = {
  'Cross-Origin-Opener-Policy':  'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// Los .wasm de ORT se sirven desde CDN via ort.env.wasm.wasmPaths — no van al bundle
const excluirWasmOrt: Plugin = {
  name: 'excluir-wasm-ort',
  generateBundle(_, bundle) {
    for (const key of Object.keys(bundle)) {
      if (key.endsWith('.wasm')) delete bundle[key]
    }
  }
}

export default defineConfig({
  server:  { port: 5173, headers: COOP_HEADERS },
  preview: { headers: COOP_HEADERS },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  build: {
    rollupOptions: {
      plugins: [excluirWasmOrt]
    }
  }
})

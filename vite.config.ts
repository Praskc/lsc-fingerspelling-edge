import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    headers: {
      // Requerido para ONNX Runtime WASM con SharedArrayBuffer
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  build: {
    rollupOptions: {
      external: [],
    }
  }
})
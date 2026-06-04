import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const COOP_HEADERS = {
  'Cross-Origin-Opener-Policy':  'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  server:  { port: 5173, headers: COOP_HEADERS, allowedHosts: true },
  preview: { headers: COOP_HEADERS },
  optimizeDeps: {
    exclude: ['onnxruntime-web', '@mediapipe/tasks-vision']
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{mjs,wasm}',
          dest: 'ort'
        },
        {
          src: 'node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm}',
          dest: 'mediapipe'
        }
      ]
    })
  ],
  build: {
    target:    'es2022',
    minify:    'terser',
    cssMinify: 'lightningcss',
    terserOptions: {
      compress: {
        passes:     2,
        drop_console: false,
        pure_funcs: ['console.debug', 'console.info']
      },
      mangle: { safari10: true }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'ort':       ['onnxruntime-web'],
          'mediapipe': ['@mediapipe/tasks-vision'],
        }
      }
    }
  }
})

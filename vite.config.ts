import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SimplePeer',
      fileName: (format) => `peer-pressure.${format}.js`,
      formats: ['es', 'umd']
    },
    sourcemap: true,
    target: 'es2020',
    outDir: 'dist'
  }
})

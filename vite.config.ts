import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      rollupTypes: true
    })
  ],
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

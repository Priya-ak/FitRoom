import { defineConfig, mergeConfig } from 'vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import baseConfig from './vite.config.ts'

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [netlify()],
  }),
)

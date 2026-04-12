import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{js,mjs,jsx}'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})

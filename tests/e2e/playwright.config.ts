import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

function loadRootEnv() {
  const envPath = path.resolve(__dirname, '..', '..', '.env')
  if (!existsSync(envPath)) {
    return
  }

  const contents = readFileSync(envPath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) {
      continue
    }

    let value = line.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadRootEnv()

const frontendPort = process.env.CCC_FRONTEND_HOST_PORT?.trim() || '13000'
const apiPort = process.env.CCC_API_HOST_PORT?.trim() || '15000'
const frontendOrigin = process.env.CCC_FRONTEND_PUBLIC_ORIGIN?.trim() || `http://localhost:${frontendPort}`
const apiOrigin = process.env.CCC_API_PUBLIC_ORIGIN?.trim() || `http://localhost:${apiPort}`

process.env.CCC_BASE_URL ||= frontendOrigin
process.env.CCC_API_BASE_URL ||= apiOrigin

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.CCC_BASE_URL,
    locale: 'tr-TR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
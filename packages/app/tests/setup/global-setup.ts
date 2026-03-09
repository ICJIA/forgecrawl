import { execSync, spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { resolve } from 'path'

let serverProcess: ChildProcess | undefined

const TEST_PORT = 5199
const TEST_DATA_DIR = resolve(__dirname, '../../.test-data')

export async function setup() {
  // Clean test data directory
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true })
  }
  mkdirSync(TEST_DATA_DIR, { recursive: true })

  // Build the app
  console.log('Building app for tests...')
  execSync('pnpm build', {
    cwd: resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NUXT_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long-for-jwt',
    },
  })

  // Start the server
  console.log(`Starting test server on port ${TEST_PORT}...`)
  serverProcess = spawn('node', ['.output/server/index.mjs'], {
    cwd: resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(TEST_PORT),
      NUXT_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long-for-jwt',
      NUXT_DATA_DIR: TEST_DATA_DIR,
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  })

  serverProcess.stderr?.on('data', (data) => {
    const msg = data.toString()
    if (!msg.includes('ExperimentalWarning')) {
      process.stderr.write(data)
    }
  })

  // Wait for server to be ready
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`
  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`)
      if (res.ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }

  if (!ready) {
    throw new Error('Test server failed to start')
  }

  console.log(`Test server ready at ${baseUrl}`)

  // Store the base URL for tests to use
  process.env.TEST_BASE_URL = baseUrl
}

export async function teardown() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    // Wait for graceful shutdown
    await new Promise(r => setTimeout(r, 1000))
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL')
    }
  }

  // Clean up test data
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true })
  }
}

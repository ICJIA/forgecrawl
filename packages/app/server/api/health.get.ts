import { isSetupComplete } from '../utils/setup'
import { config } from '../../../../forgecrawl.config'

export default defineEventHandler((event) => {
  let setupComplete = false
  let dbStatus = 'ok'

  try {
    setupComplete = isSetupComplete()
  } catch {
    dbStatus = 'error'
    setResponseStatus(event, 503)
  }

  return {
    status: dbStatus === 'error' ? 'degraded' : 'ok',
    version: config.app.version,
    database: dbStatus,
    setup_complete: setupComplete,
  }
})

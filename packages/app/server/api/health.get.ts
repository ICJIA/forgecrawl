import { isSetupComplete } from '../utils/setup'
import { config } from '../../../../forgecrawl.config'

export default defineEventHandler(() => {
  let setupComplete = false
  let dbStatus = 'ok'

  try {
    setupComplete = isSetupComplete()
  } catch {
    dbStatus = 'error'
  }

  return {
    status: 'ok',
    version: config.app.version,
    database: dbStatus,
    setup_complete: setupComplete,
  }
})

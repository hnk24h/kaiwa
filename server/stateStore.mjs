import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_SETTINGS = {
  dailyGoalMinutes: 20,
  defaultSpeed: 1.0,
  seekStepSec: 3,
  autoPinPdfPage: false,
  pauseBetweenLoopsSec: 1,
  darkMode: false,
}

export const DEFAULT_STUDY_STATE = {
  lastSession: null,
  trackProgress: {},
  abPresets: {},
  notes: {},
  dailyMinutes: {},
  studyPlan: null,
  settings: { ...DEFAULT_SETTINGS },
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath))
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

export function createStateStore(dataDir) {
  const statePath = path.join(dataDir, 'study-state.json')
  const configPath = path.join(dataDir, 'config.json')

  function readState() {
    try {
      if (!fs.existsSync(statePath)) {
        return structuredClone(DEFAULT_STUDY_STATE)
      }
      const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      return {
        ...structuredClone(DEFAULT_STUDY_STATE),
        ...raw,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(raw?.settings || {}),
        },
      }
    } catch {
      return structuredClone(DEFAULT_STUDY_STATE)
    }
  }

  function writeState(nextState) {
    const normalized = {
      ...structuredClone(DEFAULT_STUDY_STATE),
      ...nextState,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(nextState?.settings || {}),
      },
    }
    atomicWriteJson(statePath, normalized)
    return normalized
  }

  function readConfig() {
    try {
      if (!fs.existsSync(configPath)) return {}
      return JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } catch {
      return {}
    }
  }

  function writeConfig(cfg) {
    atomicWriteJson(configPath, cfg)
    return cfg
  }

  return {
    readState,
    writeState,
    readConfig,
    writeConfig,
  }
}

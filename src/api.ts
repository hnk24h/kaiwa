import { CatalogResponse, StudySettings, StudyState } from './types'

const LOCAL_CACHE_KEY = 'kaiwa-shadowing-state-v1'

export const DEFAULT_SETTINGS: StudySettings = {
  dailyGoalMinutes: 20,
  defaultSpeed: 1.0,
  seekStepSec: 3,
  autoPinPdfPage: false,
  pauseBetweenLoopsSec: 1,
  darkMode: false,
}

export const DEFAULT_STATE: StudyState = {
  lastSession: null,
  trackProgress: {},
  abPresets: {},
  notes: {},
  dailyMinutes: {},
  studyPlan: null,
  settings: { ...DEFAULT_SETTINGS },
}

export async function fetchCatalog(): Promise<CatalogResponse> {
  const res = await fetch('/api/catalog')
  if (!res.ok) {
    throw new Error(`Không thể tải danh sách sách (${res.status})`)
  }
  return res.json()
}

export async function fetchState(): Promise<StudyState> {
  try {
    const res = await fetch('/api/state')
    if (res.ok) {
      const data = await res.json()
      const merged: StudyState = {
        ...DEFAULT_STATE,
        ...data,
        settings: { ...DEFAULT_SETTINGS, ...(data?.settings || {}) },
      }
      try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(merged))
      } catch {
        // ignore storage quota
      }
      return merged
    }
  } catch {
    // fallback to localStorage cache
  }

  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_STATE,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed?.settings || {}) },
      }
    }
  } catch {
    // ignore
  }
  return structuredClone(DEFAULT_STATE)
}

export async function saveState(state: StudyState): Promise<void> {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }

  const res = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
  if (!res.ok) {
    throw new Error(`Lỗi lưu tiến độ (${res.status})`)
  }
}

export async function updateMediaRoot(
  mediaRoot: string
): Promise<{ mediaRoot: string; mediaRootExists: boolean; bookCount: number }> {
  const res = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaRoot }),
  })
  if (!res.ok) {
    throw new Error(`Không thể cập nhật thư mục (${res.status})`)
  }
  return res.json()
}

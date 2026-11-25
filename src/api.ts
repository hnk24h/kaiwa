import { CatalogResponse, MediaMode, StudySettings, StudyState } from './types'

const LOCAL_CACHE_KEY = 'kaiwa-shadowing-state-v1'
const API_BASE_KEY = 'kaiwa-api-base-url'

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

export function getApiBaseUrl(): string {
  try {
    return (localStorage.getItem(API_BASE_KEY) || '').trim().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function setApiBaseUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '')
  try {
    if (cleaned) {
      localStorage.setItem(API_BASE_KEY, cleaned)
    } else {
      localStorage.removeItem(API_BASE_KEY)
    }
  } catch {
    // ignore
  }
}

function prefixMediaUrl(baseUrl: string, url: string | null): string | null {
  if (!url) return null
  if (!baseUrl) return url
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('local://')) {
    return url
  }
  return `${baseUrl}${url}`
}

function normalizeServerCatalog(baseUrl: string, raw: CatalogResponse): CatalogResponse {
  if (!baseUrl) return raw
  return {
    ...raw,
    books: raw.books.map((book) => ({
      ...book,
      pdfUrl: prefixMediaUrl(baseUrl, book.pdfUrl),
      kaitouPdfUrl: prefixMediaUrl(baseUrl, book.kaitouPdfUrl),
      coverUrl: prefixMediaUrl(baseUrl, book.coverUrl),
      sections: book.sections.map((sec) => ({
        ...sec,
        tracks: sec.tracks.map((t) => ({
          ...t,
          url: prefixMediaUrl(baseUrl, t.url) || t.url,
        })),
      })),
    })),
  }
}

export async function fetchCatalog(): Promise<{
  mode: MediaMode
  catalog: CatalogResponse | null
}> {
  const baseUrl = getApiBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/api/catalog`)
    const contentType = res.headers.get('content-type') || ''
    if (!res.ok || !contentType.includes('application/json')) {
      return { mode: 'local-folder', catalog: null }
    }
    const data = (await res.json()) as CatalogResponse
    if (!data || !Array.isArray(data.books)) {
      return { mode: 'local-folder', catalog: null }
    }
    return {
      mode: 'server',
      catalog: normalizeServerCatalog(baseUrl, data),
    }
  } catch {
    return { mode: 'local-folder', catalog: null }
  }
}

function loadLocalState(): StudyState {
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

export async function fetchState(mode: MediaMode = 'server'): Promise<StudyState> {
  if (mode === 'server') {
    const baseUrl = getApiBaseUrl()
    try {
      const res = await fetch(`${baseUrl}/api/state`)
      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json()
        const merged: StudyState = {
          ...DEFAULT_STATE,
          ...data,
          settings: { ...DEFAULT_SETTINGS, ...(data?.settings || {}) },
        }
        try {
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(merged))
        } catch {
          // ignore
        }
        return merged
      }
    } catch {
      // fallback to localStorage cache
    }
  }
  return loadLocalState()
}

export async function saveState(state: StudyState, mode: MediaMode = 'server'): Promise<void> {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }

  if (mode !== 'server') return

  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/api/state`, {
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
  const baseUrl = getApiBaseUrl()
  const res = await fetch(`${baseUrl}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaRoot }),
  })
  if (!res.ok) {
    throw new Error(`Không thể cập nhật thư mục (${res.status})`)
  }
  return res.json()
}

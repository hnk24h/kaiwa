import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_STATE,
  fetchCatalog,
  fetchState,
  saveState,
  updateMediaRoot,
} from './api'
import {
  Book,
  CatalogResponse,
  HomeTab,
  ReviewRating,
  ShadowingStep,
  StudyPlan,
  StudySettings,
  StudyState,
} from './types'
import { applyReviewRating, getDueReviewItems } from './utils/srs'
import { markTrackCompletedInPlan, shiftPlanToToday } from './utils/studyPlan'
import { getTodayKey } from './utils/time'
import { TopNavHeader } from './components/TopNavHeader'
import { LibraryView } from './components/LibraryView'
import { StudyPlanView } from './components/StudyPlanView'
import { ProgressReviewView } from './components/ProgressReviewView'
import { ShadowingStudio } from './components/ShadowingStudio'
import { Loader2, X } from 'lucide-react'

interface ActiveStudioSession {
  book: Book
  trackId?: string
  pdfPage?: number
  pdfKind?: 'main' | 'kaitou'
  initialStep?: ShadowingStep
}

export default function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [state, setState] = useState<StudyState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [studio, setStudio] = useState<ActiveStudioSession | null>(null)
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>('library')

  // Global Settings Modal state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rootInput, setRootInput] = useState('')
  const [rootSaving, setRootSaving] = useState(false)
  const [rootFeedback, setRootFeedback] = useState<string | null>(null)

  const saveTimerRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)

  useEffect(() => {
    let active = true
    Promise.all([fetchCatalog(), fetchState()])
      .then(([cat, st]) => {
        if (!active) return
        setCatalog(cat)
        setState(st)
        setRootInput(cat.mediaRoot)
        hydratedRef.current = true
      })
      .catch((err) => {
        if (!active) return
        setLoadError(err instanceof Error ? err.message : 'Lỗi kết nối server')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Apply Dark Mode class
  useEffect(() => {
    const root = document.documentElement
    if (state.settings.darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [state.settings.darkMode])

  // Debounced persist state
  useEffect(() => {
    if (!hydratedRef.current) return
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveState(state).catch(() => {})
    }, 500)
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [state])

  const handleUpdateState = useCallback((updater: (prev: StudyState) => StudyState) => {
    setState((prev) => updater(prev))
  }, [])

  const handleUpdateSettings = useCallback((patch: Partial<StudySettings>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...patch,
      },
    }))
  }, [])

  const handleRateReview = useCallback((trackId: string, rating: ReviewRating) => {
    const todayKey = getTodayKey()
    setState((prev) => ({
      ...prev,
      studyPlan: markTrackCompletedInPlan(prev.studyPlan, trackId, todayKey),
      trackProgress: {
        ...prev.trackProgress,
        [trackId]: applyReviewRating(prev.trackProgress[trackId], rating, todayKey),
      },
    }))
  }, [])

  const handleSavePlan = useCallback((plan: StudyPlan | null) => {
    setState((prev) => ({
      ...prev,
      studyPlan: plan,
      settings: plan
        ? { ...prev.settings, dailyGoalMinutes: plan.minutesPerDay }
        : prev.settings,
    }))
  }, [])

  const handleShiftPlanToToday = useCallback(() => {
    const todayKey = getTodayKey()
    setState((prev) => ({
      ...prev,
      studyPlan: prev.studyPlan ? shiftPlanToToday(prev.studyPlan, todayKey) : null,
    }))
  }, [])

  const handleTogglePlanTrack = useCallback((dayNumber: number, trackId: string) => {
    setState((prev) => {
      if (!prev.studyPlan) return prev
      const nextDays = prev.studyPlan.days.map((day) => {
        if (day.dayNumber !== dayNumber) return day
        const exists = day.completedTrackIds.includes(trackId)
        return {
          ...day,
          completedTrackIds: exists
            ? day.completedTrackIds.filter((id) => id !== trackId)
            : [...day.completedTrackIds, trackId],
        }
      })
      return {
        ...prev,
        studyPlan: { ...prev.studyPlan, days: nextDays },
      }
    })
  }, [])

  const handleUpdateMediaRoot = useCallback(async (nextRoot: string) => {
    await updateMediaRoot(nextRoot)
    const nextCat = await fetchCatalog()
    setCatalog(nextCat)
  }, [])

  async function handleSaveMediaRootForm(e: React.FormEvent) {
    e.preventDefault()
    if (!rootInput.trim()) return
    setRootSaving(true)
    setRootFeedback(null)
    try {
      await handleUpdateMediaRoot(rootInput.trim())
      setRootFeedback('Đã cập nhật đường dẫn thư mục thành công.')
    } catch (err) {
      setRootFeedback(err instanceof Error ? err.message : 'Lỗi cập nhật thư mục')
    } finally {
      setRootSaving(false)
    }
  }

  const dueReviewCount = useMemo(() => {
    if (!catalog) return 0
    return getDueReviewItems(catalog.books, state.trackProgress).length
  }, [catalog, state.trackProgress])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper text-ink dark:bg-slate-950 dark:text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-indigoKaiwa" />
        <p className="text-sm font-medium text-stone-600 dark:text-slate-300">
          Đang tải thư viện sách & audio Shadowing...
        </p>
      </div>
    )
  }

  if (loadError || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6 dark:bg-slate-950">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
          <h1 className="text-base font-bold text-red-600">Không kết nối được Server Media</h1>
          <p className="mt-2 text-xs text-stone-600 dark:text-slate-300">
            {loadError || 'Vui lòng chạy server Node.js bằng lệnh npm run dev hoặc npm start.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-indigoKaiwa px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  if (studio) {
    return (
      <ShadowingStudio
        book={studio.book}
        initialTrackId={studio.trackId}
        initialPdfPage={studio.pdfPage}
        initialPdfKind={studio.pdfKind}
        initialStep={studio.initialStep}
        state={state}
        onUpdateState={handleUpdateState}
        onUpdateSettings={handleUpdateSettings}
        onRateReview={handleRateReview}
        onBackToLibrary={() => setStudio(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-paper text-ink dark:bg-slate-950 dark:text-slate-100">
      <TopNavHeader
        activeTab={activeHomeTab}
        onChangeTab={setActiveHomeTab}
        dueReviewCount={dueReviewCount}
        darkMode={state.settings.darkMode}
        onToggleDarkMode={() => handleUpdateSettings({ darkMode: !state.settings.darkMode })}
        onOpenSettings={() => {
          setRootInput(catalog.mediaRoot)
          setRootFeedback(null)
          setSettingsOpen(true)
        }}
      />

      {activeHomeTab === 'library' && (
        <LibraryView
          books={catalog.books}
          mediaRoot={catalog.mediaRoot}
          mediaRootExists={catalog.mediaRootExists}
          state={state}
          dueReviewCount={dueReviewCount}
          onOpenBook={(book, trackId, pdfPage, pdfKind) =>
            setStudio({ book, trackId, pdfPage, pdfKind })
          }
          onOpenSettings={() => {
            setRootInput(catalog.mediaRoot)
            setRootFeedback(null)
            setSettingsOpen(true)
          }}
          onNavigateTab={setActiveHomeTab}
        />
      )}

      {activeHomeTab === 'plan' && (
        <StudyPlanView
          books={catalog.books}
          state={state}
          onSavePlan={handleSavePlan}
          onShiftPlanToToday={handleShiftPlanToToday}
          onTogglePlanTrack={handleTogglePlanTrack}
          onOpenTrack={(book, trackId, pdfPage, pdfKind, initialStep) =>
            setStudio({ book, trackId, pdfPage, pdfKind, initialStep })
          }
        />
      )}

      {activeHomeTab === 'progress' && (
        <ProgressReviewView
          books={catalog.books}
          state={state}
          onRateReview={handleRateReview}
          onOpenTrack={(book, trackId, pdfPage, pdfKind, initialStep) =>
            setStudio({ book, trackId, pdfPage, pdfKind, initialStep })
          }
        />
      )}

      {/* Global Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-slate-800">
              <h2 className="text-base font-bold">Cài đặt tự học & Thư mục sách</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <form onSubmit={handleSaveMediaRootForm} className="space-y-2">
                <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                  Thư mục chứa sách PDF & Audio
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rootInput}
                    onChange={(e) => setRootInput(e.target.value)}
                    className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs focus:border-indigoKaiwa focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                    placeholder="/mnt/d/02. Tiếng Nhật/luyennoi"
                  />
                  <button
                    type="submit"
                    disabled={rootSaving}
                    className="rounded-lg bg-indigoKaiwa px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {rootSaving ? 'Đang lưu...' : 'Áp dụng'}
                  </button>
                </div>
                {rootFeedback && (
                  <p className="text-xs text-indigoKaiwa dark:text-indigo-300">{rootFeedback}</p>
                )}
              </form>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    Mục tiêu mỗi ngày (phút)
                  </label>
                  <select
                    value={state.settings.dailyGoalMinutes}
                    onChange={(e) =>
                      handleUpdateSettings({ dailyGoalMinutes: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {[10, 15, 20, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} phút / ngày
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    Bước tua nhanh (← / →)
                  </label>
                  <select
                    value={state.settings.seekStepSec}
                    onChange={(e) => handleUpdateSettings({ seekStepSec: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {[2, 3, 5].map((s) => (
                      <option key={s} value={s}>
                        {s} giây
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    Tốc độ đọc mặc định
                  </label>
                  <select
                    value={state.settings.defaultSpeed}
                    onChange={(e) => handleUpdateSettings({ defaultSpeed: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {[0.75, 0.85, 0.95, 1.0, 1.1].map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}x
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    Nghỉ giữa vòng lặp A–B
                  </label>
                  <select
                    value={state.settings.pauseBetweenLoopsSec}
                    onChange={(e) =>
                      handleUpdateSettings({ pauseBetweenLoopsSec: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {[0, 1, 2, 3].map((s) => (
                      <option key={s} value={s}>
                        {s === 0 ? 'Không nghỉ (0s)' : `${s} giây để nhẩm lại`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 p-3 dark:border-slate-700">
                <div>
                  <p className="text-xs font-semibold">Tự động ghim trang PDF theo Track</p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    Khi lật trang PDF, tự động nhớ trang đó cho bài nghe hiện tại
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={state.settings.autoPinPdfPage}
                  onChange={(e) => handleUpdateSettings({ autoPinPdfPage: e.target.checked })}
                  className="h-4 w-4 accent-indigoKaiwa"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

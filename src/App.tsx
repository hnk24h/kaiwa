import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_STATE,
  fetchCatalog,
  fetchState,
  getApiBaseUrl,
  saveState,
  setApiBaseUrl,
  updateMediaRoot,
} from './api'
import {
  Book,
  CatalogResponse,
  HomeTab,
  MediaMode,
  ReviewRating,
  ShadowingStep,
  StudyPlan,
  StudySettings,
  StudyState,
} from './types'
import {
  checkSavedDirectory,
  isDirectoryPickerSupported,
  loadCatalogFromFileList,
  pickLocalFolderCatalog,
  reconnectSavedFolderCatalog,
} from './utils/localFolderCatalog'
import { applyReviewRating, getDueReviewItems } from './utils/srs'
import { markTrackCompletedInPlan, shiftPlanToToday } from './utils/studyPlan'
import { getTodayKey } from './utils/time'
import { TopNavHeader } from './components/TopNavHeader'
import { LibraryView } from './components/LibraryView'
import { StudyPlanView } from './components/StudyPlanView'
import { ProgressReviewView } from './components/ProgressReviewView'
import { ShadowingStudio } from './components/ShadowingStudio'
import {
  Download,
  FolderOpen,
  FolderSync,
  HardDrive,
  Loader2,
  Server,
  Upload,
  X,
} from 'lucide-react'

interface ActiveStudioSession {
  book: Book
  trackId?: string
  pdfPage?: number
  pdfKind?: 'main' | 'kaitou'
  initialStep?: ShadowingStep
}

export default function App() {
  const [mediaMode, setMediaMode] = useState<MediaMode>('server')
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [state, setState] = useState<StudyState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [studio, setStudio] = useState<ActiveStudioSession | null>(null)
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>('library')

  // Browser local-folder state (for Vercel / static hosting)
  const [savedFolderName, setSavedFolderName] = useState<string | null>(null)
  const [folderPicking, setFolderPicking] = useState(false)

  // Global Settings Modal state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rootInput, setRootInput] = useState('')
  const [rootSaving, setRootSaving] = useState(false)
  const [rootFeedback, setRootFeedback] = useState<string | null>(null)
  const [apiUrlInput, setApiUrlInput] = useState(() => getApiBaseUrl())
  const [apiFeedback, setApiFeedback] = useState<string | null>(null)

  const settingsFileInputRef = useRef<HTMLInputElement | null>(null)
  const importStateInputRef = useRef<HTMLInputElement | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)

  const hydrateApp = useCallback(async () => {
    setLoading(true)
    const { mode, catalog: serverCat } = await fetchCatalog()
    setMediaMode(mode)

    const st = await fetchState(mode)
    setState(st)
    hydratedRef.current = true

    if (mode === 'server' && serverCat) {
      setCatalog(serverCat)
      setRootInput(serverCat.mediaRoot)
      setLoading(false)
      return
    }

    // Local-folder mode (e.g. Vercel deployment)
    const saved = await checkSavedDirectory()
    if (saved) {
      setSavedFolderName(saved.name)
      if (saved.permission === 'granted') {
        try {
          const loaded = await reconnectSavedFolderCatalog()
          if (loaded) {
            setCatalog({
              mediaRoot: loaded.folderName,
              mediaRootExists: loaded.books.length > 0,
              books: loaded.books,
            })
            setLoading(false)
            return
          }
        } catch {
          // fall through to prompt reconnection UI
        }
      }
    }

    setCatalog({
      mediaRoot: saved?.name || 'Chưa chọn thư mục',
      mediaRootExists: false,
      books: [],
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    hydrateApp()
  }, [hydrateApp])

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
      saveState(state, mediaMode).catch(() => {})
    }, 500)
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [state, mediaMode])

  const handlePickLocalFolder = useCallback(async () => {
    setFolderPicking(true)
    setApiFeedback(null)
    try {
      const { folderName, books } = await pickLocalFolderCatalog()
      setMediaMode('local-folder')
      setSavedFolderName(folderName)
      setCatalog({
        mediaRoot: folderName,
        mediaRootExists: books.length > 0,
        books,
      })
      setApiFeedback(
        books.length > 0
          ? `Đã kết nối thư mục "${folderName}" (${books.length} bộ sách).`
          : `Đã mở "${folderName}" nhưng chưa thấy sách PDF/Audio phù hợp.`
      )
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setApiFeedback(err instanceof Error ? err.message : 'Không thể mở thư mục.')
      }
    } finally {
      setFolderPicking(false)
    }
  }, [])

  const handleReconnectSavedFolder = useCallback(async () => {
    setFolderPicking(true)
    try {
      const res = await reconnectSavedFolderCatalog()
      if (res) {
        setMediaMode('local-folder')
        setSavedFolderName(res.folderName)
        setCatalog({
          mediaRoot: res.folderName,
          mediaRootExists: res.books.length > 0,
          books: res.books,
        })
      }
    } finally {
      setFolderPicking(false)
    }
  }, [])

  const handleFilesSelected = useCallback(async (files: FileList) => {
    setFolderPicking(true)
    try {
      const { folderName, books } = await loadCatalogFromFileList(files)
      setMediaMode('local-folder')
      setCatalog({
        mediaRoot: folderName,
        mediaRootExists: books.length > 0,
        books,
      })
    } finally {
      setFolderPicking(false)
    }
  }, [])

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
      settings: plan ? { ...prev.settings, dailyGoalMinutes: plan.minutesPerDay } : prev.settings,
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
    const { catalog: nextCat } = await fetchCatalog()
    if (nextCat) setCatalog(nextCat)
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

  async function handleApplyRemoteApiUrl(e: React.FormEvent) {
    e.preventDefault()
    setApiFeedback(null)
    setApiBaseUrl(apiUrlInput)
    const { mode, catalog: nextCat } = await fetchCatalog()
    if (mode === 'server' && nextCat) {
      setMediaMode('server')
      setCatalog(nextCat)
      setRootInput(nextCat.mediaRoot)
      const st = await fetchState('server')
      setState(st)
      setApiFeedback(`Đã kết nối thành công tới Server Media (${nextCat.books.length} cuốn).`)
    } else if (apiUrlInput.trim()) {
      setApiFeedback(
        'Không kết nối được tới URL Server Media này (kiểm tra server đang chạy và CORS/HTTPS).'
      )
    } else {
      setMediaMode('local-folder')
      setApiFeedback('Đã chuyển về chế độ đọc thư mục trực tiếp trên trình duyệt.')
    }
  }

  function handleExportProgress() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kaiwa-shadowing-backup-${getTodayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportProgress(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'))
        setState((prev) => ({
          ...DEFAULT_STATE,
          ...prev,
          ...parsed,
          settings: { ...DEFAULT_STATE.settings, ...(parsed?.settings || {}) },
        }))
        setApiFeedback('Đã khôi phục tiến độ học thành công.')
      } catch {
        setApiFeedback('File JSON sao lưu không hợp lệ.')
      }
    }
    reader.readAsText(file)
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
          Đang tải thư viện sách &amp; audio Shadowing...
        </p>
      </div>
    )
  }

  const resolvedCatalog: CatalogResponse = catalog || {
    mediaRoot: 'Chưa chọn thư mục',
    mediaRootExists: false,
    books: [],
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
          setRootInput(resolvedCatalog.mediaRoot)
          setRootFeedback(null)
          setApiFeedback(null)
          setSettingsOpen(true)
        }}
      />

      {activeHomeTab === 'library' && (
        <LibraryView
          books={resolvedCatalog.books}
          mediaMode={mediaMode}
          mediaRoot={resolvedCatalog.mediaRoot}
          mediaRootExists={resolvedCatalog.mediaRootExists}
          savedFolderName={savedFolderName}
          folderPicking={folderPicking}
          state={state}
          dueReviewCount={dueReviewCount}
          onOpenBook={(book, trackId, pdfPage, pdfKind) =>
            setStudio({ book, trackId, pdfPage, pdfKind })
          }
          onOpenSettings={() => {
            setRootInput(resolvedCatalog.mediaRoot)
            setRootFeedback(null)
            setApiFeedback(null)
            setSettingsOpen(true)
          }}
          onNavigateTab={setActiveHomeTab}
          onPickLocalFolder={handlePickLocalFolder}
          onReconnectSavedFolder={handleReconnectSavedFolder}
          onFilesSelected={handleFilesSelected}
        />
      )}

      {activeHomeTab === 'plan' && (
        <StudyPlanView
          books={resolvedCatalog.books}
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
          books={resolvedCatalog.books}
          state={state}
          onRateReview={handleRateReview}
          onOpenTrack={(book, trackId, pdfPage, pdfKind, initialStep) =>
            setStudio({ book, trackId, pdfPage, pdfKind, initialStep })
          }
        />
      )}

      {/* Hidden inputs for settings modal */}
      <input
        ref={settingsFileInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files)
          }
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={importStateInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportProgress(f)
          e.currentTarget.value = ''
        }}
      />

      {/* Global Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-slate-800">
              <h2 className="text-base font-bold">Cài đặt tự học &amp; Nguồn sách Media</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Active Source Mode Badge */}
              <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex items-center gap-2">
                  {mediaMode === 'local-folder' ? (
                    <HardDrive className="h-4 w-4 text-matcha" />
                  ) : (
                    <Server className="h-4 w-4 text-indigoKaiwa" />
                  )}
                  <div>
                    <p className="font-bold">
                      {mediaMode === 'local-folder'
                        ? 'Đọc trực tiếp từ thư mục trên máy (Vercel / Trình duyệt)'
                        : 'Đang kết nối Server Media'}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400">
                      {resolvedCatalog.books.length} bộ sách sẵn sàng
                    </p>
                  </div>
                </div>
              </div>

              {/* Local Folder Picker (works on Vercel & localhost) */}
              <div className="space-y-2 rounded-xl border border-stone-200 p-3.5 dark:border-slate-700">
                <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                  1. Chọn thư mục sách trên máy tính (khuyên dùng khi chạy trên Vercel)
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedFolderName && (
                    <button
                      type="button"
                      disabled={folderPicking}
                      onClick={handleReconnectSavedFolder}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-matcha px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <FolderSync className="h-3.5 w-3.5" />
                      Mở lại &ldquo;{savedFolderName}&rdquo;
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={folderPicking}
                    onClick={() => {
                      if (isDirectoryPickerSupported()) handlePickLocalFolder()
                      else settingsFileInputRef.current?.click()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigoKaiwa px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Chọn thư mục (D:\02. Tiếng Nhật\luyennoi)
                  </button>
                </div>
              </div>

              {/* Server Media Root path when connected to Server */}
              {mediaMode === 'server' && (
                <form onSubmit={handleSaveMediaRootForm} className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    Đường dẫn thư mục trên Server Media
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
              )}

              {/* Optional Remote Media Server URL */}
              <form
                onSubmit={handleApplyRemoteApiUrl}
                className="space-y-2 rounded-xl border border-stone-200 p-3.5 dark:border-slate-700"
              >
                <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                  2. URL Server Media từ xa / Localhost (tùy chọn nâng cao)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiUrlInput}
                    onChange={(e) => setApiUrlInput(e.target.value)}
                    className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs focus:border-indigoKaiwa focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                    placeholder="Để trống nếu đọc trực tiếp trên máy (hoặc nhập https://...)"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Kết nối
                  </button>
                </div>
                {apiFeedback && (
                  <p className="text-xs text-indigoKaiwa dark:text-indigo-300">{apiFeedback}</p>
                )}
              </form>

              {/* Study Preferences */}
              <div className="grid grid-cols-2 gap-3 pt-1">
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

              {/* Backup / Restore JSON */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-slate-800">
                <span className="text-xs font-semibold text-stone-600 dark:text-slate-300">
                  Sao lưu tiến độ &amp; sổ tay Kaiwa
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportProgress}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Xuất JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => importStateInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Nhập JSON
                  </button>
                </div>
              </div>
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

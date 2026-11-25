import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ABPreset,
  AudioTrack,
  Book,
  KaiwaNote,
  PdfMaskMode,
  ReviewRating,
  ShadowingStep,
  StudySettings,
  StudyState,
  TrackProgress,
  TrackStatus,
} from '../types'
import { ensureReviewScheduled } from '../utils/srs'
import { markTrackCompletedInPlan } from '../utils/studyPlan'
import { formatShortDate, getTodayKey } from '../utils/time'
import { PdfCanvasViewer } from './PdfCanvasViewer'
import { AudioDeck } from './AudioDeck'
import { VoiceRecorderPanel } from './VoiceRecorderPanel'
import { KaiwaNotesPanel } from './KaiwaNotesPanel'
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Circle,
  HelpCircle,
  Keyboard,
  Mic,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Repeat,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

interface ShadowingStudioProps {
  book: Book
  initialTrackId?: string
  initialPdfPage?: number
  initialPdfKind?: 'main' | 'kaitou'
  initialStep?: ShadowingStep
  state: StudyState
  onUpdateState: (updater: (prev: StudyState) => StudyState) => void
  onUpdateSettings: (patch: Partial<StudySettings>) => void
  onRateReview: (trackId: string, rating: ReviewRating) => void
  onBackToLibrary: () => void
}

const SHADOWING_STEPS: Array<{ step: ShadowingStep; label: string; hint: string }> = [
  { step: 1, label: '1. Nghe chay', hint: 'Che sách — tập trung bắt âm & ngữ điệu' },
  { step: 2, label: '2. Đọc hiểu', hint: 'Mở sách — hiểu nghĩa, kính ngữ & ghi chú' },
  { step: 3, label: '3. Shadowing (nhìn sách)', hint: 'Đọc đuổi theo sát tốc độ audio (dùng A–B)' },
  { step: 4, label: '4. Shadowing mù & Thu âm', hint: 'Che sách, thu âm và so sánh với bản xứ' },
]

function getTargetPageForTrack(
  track: AudioTrack | null,
  kind: 'main' | 'kaitou',
  trackProgressMap: Record<string, TrackProgress>
): number {
  if (!track) return 1
  const prog = trackProgressMap[track.id]
  if (kind === 'kaitou') {
    return prog?.kaitouPage ?? track.defaultKaitouPage ?? track.defaultPdfPage ?? 1
  }
  return prog?.pdfPage ?? track.defaultPdfPage ?? 1
}

export const ShadowingStudio: React.FC<ShadowingStudioProps> = ({
  book,
  initialTrackId,
  initialPdfPage,
  initialPdfKind,
  initialStep,
  state,
  onUpdateState,
  onUpdateSettings,
  onRateReview,
  onBackToLibrary,
}) => {
  const allTracks = useMemo(() => book.sections.flatMap((s) => s.tracks), [book])

  const [activeTrackId, setActiveTrackId] = useState<string>(() => {
    if (initialTrackId && allTracks.some((t) => t.id === initialTrackId)) {
      return initialTrackId
    }
    return allTracks[0]?.id || ''
  })

  const activeTrack: AudioTrack | null = useMemo(
    () => allTracks.find((t) => t.id === activeTrackId) || allTracks[0] || null,
    [allTracks, activeTrackId]
  )

  const resolvedInitialKind: 'main' | 'kaitou' =
    initialPdfKind || (book.kaitouPdfUrl ? book.defaultPdfKind || 'main' : 'main')

  const [pdfKind, setPdfKind] = useState<'main' | 'kaitou'>(resolvedInitialKind)
  const [pdfPage, setPdfPage] = useState<number>(() => {
    if (initialPdfPage) return initialPdfPage
    return getTargetPageForTrack(activeTrack, resolvedInitialKind, state.trackProgress)
  })

  const [shadowStep, setShadowStep] = useState<ShadowingStep>(initialStep || 3)
  const [maskMode, setMaskMode] = useState<PdfMaskMode>(
    initialStep === 1 || initialStep === 4 ? 'blur' : 'clear'
  )
  const [isPeeking, setIsPeeking] = useState(false)

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true)
  const [rightTab, setRightTab] = useState<'recorder' | 'notes' | 'ab'>(
    initialStep === 2 ? 'notes' : 'recorder'
  )
  const [helpOpen, setHelpOpen] = useState(false)

  const [trackSearch, setTrackSearch] = useState('')
  const [trackStatusFilter, setTrackStatusFilter] = useState<'all' | TrackStatus>('all')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<number>(state.settings.defaultSpeed || 1.0)
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const [abActive, setAbActive] = useState(false)
  const [repeatTrack, setRepeatTrack] = useState(false)
  const [autoNext, setAutoNext] = useState(true)
  const [autoPlayRequestId, setAutoPlayRequestId] = useState(0)

  const trackProgress: TrackProgress = useMemo(() => {
    if (!activeTrack) {
      return { status: 'new', playCount: 0, loopCount: 0, updatedAt: '' }
    }
    return (
      state.trackProgress[activeTrack.id] || {
        status: 'new',
        playCount: 0,
        loopCount: 0,
        updatedAt: '',
      }
    )
  }, [activeTrack, state.trackProgress])

  const activeNotes: KaiwaNote[] = useMemo(() => {
    if (!activeTrack) return []
    return state.notes[activeTrack.id] || []
  }, [activeTrack, state.notes])

  const activeAbPresets: ABPreset[] = useMemo(() => {
    if (!activeTrack) return []
    return state.abPresets[activeTrack.id] || []
  }, [activeTrack, state.abPresets])

  // Record lastSession whenever track / page / pdfKind changes
  useEffect(() => {
    if (!activeTrack) return
    onUpdateState((prev) => ({
      ...prev,
      lastSession: {
        bookId: book.id,
        trackId: activeTrack.id,
        pdfPage,
        pdfKind,
        updatedAt: new Date().toISOString(),
      },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, activeTrack?.id, pdfPage, pdfKind])

  // Active practice timer: counts seconds while playing or recording
  const activeSecondsAccRef = useRef(0)
  useEffect(() => {
    if (!isPlaying && !isRecording) return
    const timer = window.setInterval(() => {
      activeSecondsAccRef.current += 1
      if (activeSecondsAccRef.current >= 15) {
        const minsToAdd = activeSecondsAccRef.current / 60
        activeSecondsAccRef.current = 0
        const todayKey = getTodayKey()
        onUpdateState((prev) => ({
          ...prev,
          dailyMinutes: {
            ...prev.dailyMinutes,
            [todayKey]: Number(((prev.dailyMinutes[todayKey] || 0) + minsToAdd).toFixed(2)),
          },
        }))
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isPlaying, isRecording, onUpdateState])

  const selectTrack = useCallback(
    (track: AudioTrack, autoPlay = false) => {
      setActiveTrackId(track.id)
      setLoopA(null)
      setLoopB(null)
      setAbActive(false)
      setCurrentTime(0)

      // Automatically jump PDF to the exact mapped or pinned page for this track
      const nextPage = getTargetPageForTrack(track, pdfKind, state.trackProgress)
      setPdfPage(nextPage)

      if (autoPlay) {
        setAutoPlayRequestId((n) => n + 1)
      }
    },
    [pdfKind, state.trackProgress]
  )

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPdfPage(nextPage)
      if (!activeTrack || !state.settings.autoPinPdfPage) return
      onUpdateState((prev) => {
        const cur = prev.trackProgress[activeTrack.id] || {
          status: 'learning' as TrackStatus,
          playCount: 0,
          loopCount: 0,
          updatedAt: new Date().toISOString(),
        }
        return {
          ...prev,
          trackProgress: {
            ...prev.trackProgress,
            [activeTrack.id]: {
              ...cur,
              ...(pdfKind === 'kaitou' ? { kaitouPage: nextPage } : { pdfPage: nextPage }),
              updatedAt: new Date().toISOString(),
            },
          },
        }
      })
    },
    [activeTrack, pdfKind, state.settings.autoPinPdfPage, onUpdateState]
  )

  const handlePinCurrentPage = useCallback(() => {
    if (!activeTrack) return
    onUpdateState((prev) => {
      const cur = prev.trackProgress[activeTrack.id] || {
        status: 'learning' as TrackStatus,
        playCount: 0,
        loopCount: 0,
        updatedAt: new Date().toISOString(),
      }
      return {
        ...prev,
        trackProgress: {
          ...prev.trackProgress,
          [activeTrack.id]: {
            ...cur,
            ...(pdfKind === 'kaitou' ? { kaitouPage: pdfPage } : { pdfPage }),
            updatedAt: new Date().toISOString(),
          },
        },
      }
    })
  }, [activeTrack, pdfKind, pdfPage, onUpdateState])

  const handleResetPinnedPage = useCallback(() => {
    if (!activeTrack) return
    const fallbackPage =
      pdfKind === 'kaitou'
        ? activeTrack.defaultKaitouPage ?? activeTrack.defaultPdfPage ?? 1
        : activeTrack.defaultPdfPage ?? 1
    setPdfPage(fallbackPage)
    onUpdateState((prev) => {
      const cur = prev.trackProgress[activeTrack.id]
      if (!cur) return prev
      const nextProg = { ...cur, updatedAt: new Date().toISOString() }
      if (pdfKind === 'kaitou') delete nextProg.kaitouPage
      else delete nextProg.pdfPage
      return {
        ...prev,
        trackProgress: {
          ...prev.trackProgress,
          [activeTrack.id]: nextProg,
        },
      }
    })
  }, [activeTrack, pdfKind, onUpdateState])

  const handlePdfKindChange = useCallback(
    (kind: 'main' | 'kaitou') => {
      setPdfKind(kind)
      setPdfPage(getTargetPageForTrack(activeTrack, kind, state.trackProgress))
    },
    [activeTrack, state.trackProgress]
  )

  const seekTo = useCallback((sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    const clamped = Math.max(0, Math.min(audio.duration || 99999, sec))
    audio.currentTime = clamped
    setCurrentTime(clamped)
  }, [])

  const seekAndPlay = useCallback((sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, sec)
    setCurrentTime(audio.currentTime)
    audio.play().catch(() => {})
  }, [])

  const handleSetLoopA = useCallback(
    (explicit?: number) => {
      const val = explicit ?? currentTime
      setLoopA(val)
      if (loopB !== null && loopB > val + 0.2) {
        setAbActive(true)
      }
    },
    [currentTime, loopB]
  )

  const handleSetLoopB = useCallback(
    (explicit?: number) => {
      const val = explicit ?? currentTime
      setLoopB(val)
      if (loopA !== null && val > loopA + 0.2) {
        setAbActive(true)
        seekTo(loopA)
      }
    },
    [currentTime, loopA, seekTo]
  )

  const handleToggleAbActive = useCallback(() => {
    if (loopA === null || loopB === null || loopB <= loopA + 0.2) return
    setAbActive((prev) => {
      const next = !prev
      if (next) seekTo(loopA)
      return next
    })
  }, [loopA, loopB, seekTo])

  const handleSaveAbPreset = useCallback(() => {
    if (!activeTrack || loopA === null || loopB === null || loopB <= loopA + 0.2) return
    const label = window.prompt(
      'Đặt tên ngắn cho đoạn A–B này (ví dụ: Câu xin lỗi khách hàng):',
      `Đoạn ${Math.floor(loopA)}s–${Math.floor(loopB)}s`
    )
    if (!label) return
    const preset: ABPreset = {
      id: `ab-${Date.now()}`,
      label: label.trim(),
      a: loopA,
      b: loopB,
      createdAt: new Date().toISOString(),
    }
    onUpdateState((prev) => ({
      ...prev,
      abPresets: {
        ...prev.abPresets,
        [activeTrack.id]: [preset, ...(prev.abPresets[activeTrack.id] || [])],
      },
    }))
    setRightDrawerOpen(true)
    setRightTab('ab')
  }, [activeTrack, loopA, loopB, onUpdateState])

  const handleStepSelect = useCallback((step: ShadowingStep) => {
    setShadowStep(step)
    if (step === 1) {
      setMaskMode('blur')
    } else if (step === 2) {
      setMaskMode('clear')
      setRightDrawerOpen(true)
      setRightTab('notes')
    } else if (step === 3) {
      setMaskMode('clear')
    } else if (step === 4) {
      setMaskMode('blur')
      setRightDrawerOpen(true)
      setRightTab('recorder')
    }
  }, [])

  const updateTrackStatus = useCallback(
    (status: TrackStatus) => {
      if (!activeTrack) return
      const todayKey = getTodayKey()
      onUpdateState((prev) => {
        const cur = prev.trackProgress[activeTrack.id] || {
          status: 'new' as TrackStatus,
          playCount: 0,
          loopCount: 0,
          updatedAt: new Date().toISOString(),
        }
        const updatedProg = ensureReviewScheduled(
          {
            ...cur,
            status,
            updatedAt: new Date().toISOString(),
          },
          todayKey
        )
        const nextPlan =
          status === 'learning' || status === 'mastered'
            ? markTrackCompletedInPlan(prev.studyPlan, activeTrack.id, todayKey)
            : prev.studyPlan
        return {
          ...prev,
          studyPlan: nextPlan,
          trackProgress: {
            ...prev.trackProgress,
            [activeTrack.id]: updatedProg,
          },
        }
      })
    },
    [activeTrack, onUpdateState]
  )

  const incrementCounter = useCallback(
    (field: 'playCount' | 'loopCount') => {
      if (!activeTrack) return
      const todayKey = getTodayKey()
      onUpdateState((prev) => {
        const cur = prev.trackProgress[activeTrack.id] || {
          status: 'learning' as TrackStatus,
          playCount: 0,
          loopCount: 0,
          updatedAt: new Date().toISOString(),
        }
        const nextStatus: TrackStatus = cur.status === 'new' ? 'learning' : cur.status
        const updatedProg = ensureReviewScheduled(
          {
            ...cur,
            status: nextStatus,
            [field]: (cur[field] || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
          todayKey
        )
        const nextPlan =
          field === 'playCount'
            ? markTrackCompletedInPlan(prev.studyPlan, activeTrack.id, todayKey)
            : prev.studyPlan
        return {
          ...prev,
          studyPlan: nextPlan,
          trackProgress: {
            ...prev.trackProgress,
            [activeTrack.id]: updatedProg,
          },
        }
      })
    },
    [activeTrack, onUpdateState]
  )

  const goAdjacentTrack = useCallback(
    (delta: number, autoPlay = false) => {
      if (!activeTrack || allTracks.length === 0) return
      const idx = allTracks.findIndex((t) => t.id === activeTrack.id)
      const nextIdx = idx + delta
      if (nextIdx >= 0 && nextIdx < allTracks.length) {
        selectTrack(allTracks[nextIdx], autoPlay)
      }
    },
    [activeTrack, allTracks, selectTrack]
  )

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const step = state.settings.seekStepSec || 3

      if (e.code === 'Space') {
        e.preventDefault()
        const audio = audioRef.current
        if (audio) {
          if (audio.paused) audio.play().catch(() => {})
          else audio.pause()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seekTo(currentTime - (e.shiftKey ? 10 : step))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        seekTo(currentTime + (e.shiftKey ? 10 : step))
      } else if (e.key === '[') {
        e.preventDefault()
        handleSetLoopA()
      } else if (e.key === ']') {
        e.preventDefault()
        handleSetLoopB()
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        handleToggleAbActive()
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setMaskMode((m) => (m === 'clear' ? 'blur' : m === 'blur' ? 'curtain' : 'clear'))
      } else if (e.key.toLowerCase() === 'v') {
        setIsPeeking(true)
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setLeftSidebarOpen((v) => !v)
      } else if (e.key === ',') {
        e.preventDefault()
        handlePageChange(Math.max(1, pdfPage - 1))
      } else if (e.key === '.') {
        e.preventDefault()
        handlePageChange(pdfPage + 1)
      } else if (e.key === '?') {
        e.preventDefault()
        setHelpOpen((v) => !v)
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'v') {
        setIsPeeking(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [
    currentTime,
    pdfPage,
    state.settings.seekStepSec,
    seekTo,
    handleSetLoopA,
    handleSetLoopB,
    handleToggleAbActive,
    handlePageChange,
  ])

  const filteredSections = useMemo(() => {
    const q = trackSearch.trim().toLowerCase()
    return book.sections
      .map((sec) => ({
        ...sec,
        tracks: sec.tracks.filter((t) => {
          const matchesQuery = !q || t.title.toLowerCase().includes(q)
          const st = state.trackProgress[t.id]?.status || 'new'
          const matchesStatus = trackStatusFilter === 'all' || st === trackStatusFilter
          return matchesQuery && matchesStatus
        }),
      }))
      .filter((sec) => sec.tracks.length > 0)
  }, [book.sections, trackSearch, trackStatusFilter, state.trackProgress])

  const pinnedPageForCurrent =
    pdfKind === 'kaitou' ? trackProgress.kaitouPage : trackProgress.pdfPage
  const mappedPageForCurrent = getTargetPageForTrack(activeTrack, pdfKind, state.trackProgress)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink dark:bg-slate-950 dark:text-slate-100">
      {/* Top Studio Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBackToLibrary}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Thư viện</span>
          </button>

          <button
            type="button"
            onClick={() => setLeftSidebarOpen((v) => !v)}
            className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Ẩn/hiện danh sách bài (B)"
          >
            {leftSidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>

          <div className="min-w-0">
            <p className="font-jp truncate text-xs font-bold sm:text-sm">{book.title}</p>
            <p className="truncate text-[11px] text-stone-500 dark:text-slate-400">
              {activeTrack ? `${activeTrack.title} · Tr.${mappedPageForCurrent}` : 'Chưa chọn track'}
              {trackProgress.playCount > 0 && ` · Đã luyện ${trackProgress.playCount} lượt`}
            </p>
          </div>
        </div>

        {/* 4-Step Shadowing Workflow Stepper */}
        <div className="hidden items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 xl:flex dark:border-slate-700 dark:bg-slate-800">
          {SHADOWING_STEPS.map((item) => {
            const active = shadowStep === item.step
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => handleStepSelect(item.step)}
                title={item.hint}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-indigoKaiwa text-white shadow-sm'
                    : 'text-stone-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Right Actions: SRS quick rating + Mastery status + Tool Drawer + Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5">
          {activeTrack && (
            <div className="hidden items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] sm:flex dark:border-slate-700 dark:bg-slate-800">
              <span
                className={`px-1 font-semibold ${
                  trackProgress.nextReviewDate && trackProgress.nextReviewDate <= getTodayKey()
                    ? 'text-vermilion'
                    : 'text-stone-500 dark:text-slate-400'
                }`}
                title="Đánh giá mức độ trôi chảy để lên lịch ôn lại (SRS)"
              >
                {trackProgress.nextReviewDate
                  ? trackProgress.nextReviewDate <= getTodayKey()
                    ? 'Ôn hôm nay:'
                    : `Ôn ${formatShortDate(trackProgress.nextReviewDate)}:`
                  : 'Ôn SRS:'}
              </span>
              <button
                type="button"
                onClick={() => onRateReview(activeTrack.id, 'again')}
                className="rounded px-1.5 py-0.5 font-semibold text-vermilion hover:bg-red-100 dark:hover:bg-red-950"
                title="Còn vấp — nhắc ôn lại ngày mai (1 ngày)"
              >
                Vấp
              </button>
              <button
                type="button"
                onClick={() => onRateReview(activeTrack.id, 'good')}
                className="rounded px-1.5 py-0.5 font-semibold text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950"
                title="Tạm ổn — dãn lịch ôn tiếp theo"
              >
                Ổn
              </button>
              <button
                type="button"
                onClick={() => onRateReview(activeTrack.id, 'easy')}
                className="rounded px-1.5 py-0.5 font-semibold text-matcha hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-950"
                title="Trôi chảy — đánh dấu Thành thạo & dãn lịch xa"
              >
                Thuộc
              </button>
            </div>
          )}

          <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800">
            {(['new', 'learning', 'mastered'] as TrackStatus[]).map((st) => {
              const active = trackProgress.status === st
              const label =
                st === 'new' ? 'Chưa học' : st === 'learning' ? 'Đang luyện' : 'Thành thạo'
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => updateTrackStatus(st)}
                  className={`rounded-md px-2 py-1 font-semibold transition ${
                    active
                      ? st === 'mastered'
                        ? 'bg-matcha text-white'
                        : st === 'learning'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-stone-500 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Phím tắt & Hướng dẫn (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setRightDrawerOpen((v) => !v)}
            className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Mở / đóng bảng Thu âm & Ghi chú"
          >
            {rightDrawerOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile / Compact 4-step bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-stone-200 bg-stone-50 px-3 py-1.5 xl:hidden dark:border-slate-800 dark:bg-slate-900">
        {SHADOWING_STEPS.map((item) => {
          const active = shadowStep === item.step
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => handleStepSelect(item.step)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                active
                  ? 'bg-indigoKaiwa text-white'
                  : 'bg-white text-stone-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Main 3-Pane Workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Track Sidebar */}
        {leftSidebarOpen && (
          <aside className="flex w-72 shrink-0 flex-col border-r border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-2 border-b border-stone-100 p-3 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
                <input
                  type="text"
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  placeholder="Tìm Unit / Track..."
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigoKaiwa focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex gap-1 text-[11px]">
                {(['all', 'new', 'learning', 'mastered'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTrackStatusFilter(st)}
                    className={`flex-1 rounded-md py-1 font-medium ${
                      trackStatusFilter === st
                        ? 'bg-indigo-50 text-indigoKaiwa dark:bg-indigo-950/70 dark:text-indigo-300'
                        : 'text-stone-500 hover:bg-stone-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {st === 'all'
                      ? 'Tất cả'
                      : st === 'new'
                        ? 'Mới'
                        : st === 'learning'
                          ? 'Đang học'
                          : 'Xong'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-2.5">
              {filteredSections.map((section) => (
                <div key={section.id} className="space-y-1">
                  <h3 className="px-2 text-[11px] font-bold uppercase tracking-wide text-stone-400 dark:text-slate-500">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.tracks.map((track) => {
                      const isActive = track.id === activeTrack?.id
                      const prog = state.trackProgress[track.id]
                      const status = prog?.status || 'new'
                      const trackTargetPage = getTargetPageForTrack(
                        track,
                        pdfKind,
                        state.trackProgress
                      )
                      const isPinned =
                        pdfKind === 'kaitou'
                          ? prog?.kaitouPage !== undefined
                          : prog?.pdfPage !== undefined

                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => selectTrack(track, true)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                            isActive
                              ? 'bg-indigoKaiwa text-white shadow-sm'
                              : 'text-stone-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {status === 'mastered' ? (
                              <CheckCircle2
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isActive ? 'text-emerald-200' : 'text-matcha'
                                }`}
                              />
                            ) : status === 'learning' ? (
                              <Sparkles
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isActive ? 'text-amber-200' : 'text-amber-500'
                                }`}
                              />
                            ) : (
                              <Circle
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isActive ? 'text-indigo-200' : 'text-stone-300 dark:text-slate-600'
                                }`}
                              />
                            )}
                            <span className="font-jp truncate font-medium">{track.title}</span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 text-[10px]">
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : isPinned
                                    ? 'bg-indigo-50 text-indigoKaiwa dark:bg-indigo-950/60 dark:text-indigo-300'
                                    : 'bg-stone-100 text-stone-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              Tr.{trackTargetPage}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center PDF Viewer */}
        <main className="min-w-0 flex-1">
          <PdfCanvasViewer
            mainPdfUrl={book.pdfUrl}
            kaitouPdfUrl={book.kaitouPdfUrl}
            pdfKind={pdfKind}
            onChangePdfKind={handlePdfKindChange}
            page={pdfPage}
            onChangePage={handlePageChange}
            mappedPage={mappedPageForCurrent}
            pinnedPage={pinnedPageForCurrent}
            hasTranslationFacingPage={book.hasTranslationFacingPage}
            autoPin={state.settings.autoPinPdfPage}
            onPinCurrentPage={handlePinCurrentPage}
            onResetPinnedPage={handleResetPinnedPage}
            maskMode={maskMode}
            onChangeMaskMode={setMaskMode}
            isPeeking={isPeeking}
          />
        </main>

        {/* Right Tool Drawer */}
        {rightDrawerOpen && activeTrack && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex border-b border-stone-200 p-1.5 text-xs dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRightTab('recorder')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 font-semibold transition ${
                  rightTab === 'recorder'
                    ? 'bg-indigoKaiwa text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Thu âm</span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab('notes')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 font-semibold transition ${
                  rightTab === 'notes'
                    ? 'bg-indigoKaiwa text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <NotebookPen className="h-3.5 w-3.5" />
                <span>Kaiwa ({activeNotes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab('ab')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 font-semibold transition ${
                  rightTab === 'ab'
                    ? 'bg-indigoKaiwa text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>A–B ({activeAbPresets.length})</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {rightTab === 'recorder' ? (
                <VoiceRecorderPanel
                  trackId={activeTrack.id}
                  onRecordingStateChange={setIsRecording}
                  onPlayNativeSegment={() => {
                    if (abActive && loopA !== null) {
                      seekAndPlay(loopA)
                    } else {
                      seekAndPlay(Math.max(0, currentTime - 3))
                    }
                  }}
                  onStartShadowingWithAudio={() => {
                    if (abActive && loopA !== null) {
                      seekAndPlay(loopA)
                    } else {
                      audioRef.current?.play().catch(() => {})
                    }
                  }}
                />
              ) : (
                <KaiwaNotesPanel
                  mode={rightTab === 'ab' ? 'ab' : 'notes'}
                  currentTime={currentTime}
                  notes={activeNotes}
                  abPresets={activeAbPresets}
                  onAddNote={(note) => {
                    const entry: KaiwaNote = {
                      ...note,
                      id: `note-${Date.now()}`,
                      createdAt: new Date().toISOString(),
                    }
                    onUpdateState((prev) => ({
                      ...prev,
                      notes: {
                        ...prev.notes,
                        [activeTrack.id]: [entry, ...(prev.notes[activeTrack.id] || [])],
                      },
                    }))
                  }}
                  onDeleteNote={(noteId) => {
                    onUpdateState((prev) => ({
                      ...prev,
                      notes: {
                        ...prev.notes,
                        [activeTrack.id]: (prev.notes[activeTrack.id] || []).filter(
                          (n) => n.id !== noteId
                        ),
                      },
                    }))
                  }}
                  onSeekAndPlay={seekAndPlay}
                  onLoopAroundNote={(sec) => {
                    const a = Math.max(0, sec - 1)
                    const b = Math.min(duration || sec + 4, sec + 3)
                    setLoopA(a)
                    setLoopB(b)
                    setAbActive(true)
                    seekAndPlay(a)
                  }}
                  onApplyAbPreset={(preset) => {
                    setLoopA(preset.a)
                    setLoopB(preset.b)
                    setAbActive(true)
                    seekAndPlay(preset.a)
                  }}
                  onDeleteAbPreset={(presetId) => {
                    onUpdateState((prev) => ({
                      ...prev,
                      abPresets: {
                        ...prev.abPresets,
                        [activeTrack.id]: (prev.abPresets[activeTrack.id] || []).filter(
                          (p) => p.id !== presetId
                        ),
                      },
                    }))
                  }}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Audio Deck */}
      <AudioDeck
        track={activeTrack}
        autoPlayRequestId={autoPlayRequestId}
        audioRef={audioRef}
        isPlaying={isPlaying}
        onPlayingChange={setIsPlaying}
        currentTime={currentTime}
        duration={duration}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        speed={speed}
        onSpeedChange={setSpeed}
        seekStepSec={state.settings.seekStepSec || 3}
        loopA={loopA}
        loopB={loopB}
        abActive={abActive}
        pauseBetweenLoopsSec={state.settings.pauseBetweenLoopsSec}
        onChangePauseBetweenLoops={(sec) => onUpdateSettings({ pauseBetweenLoopsSec: sec })}
        onSetLoopA={handleSetLoopA}
        onSetLoopB={handleSetLoopB}
        onToggleAbActive={handleToggleAbActive}
        onClearAb={() => {
          setLoopA(null)
          setLoopB(null)
          setAbActive(false)
        }}
        onSaveAbPreset={handleSaveAbPreset}
        repeatTrack={repeatTrack}
        onToggleRepeatTrack={() => setRepeatTrack((v) => !v)}
        autoNext={autoNext}
        onToggleAutoNext={() => setAutoNext((v) => !v)}
        onPrevTrack={() => goAdjacentTrack(-1, true)}
        onNextTrack={() => goAdjacentTrack(1, true)}
        onTrackEnded={() => {
          incrementCounter('playCount')
          if (autoNext) {
            goAdjacentTrack(1, true)
          }
        }}
        onLoopCompleted={() => incrementCounter('loopCount')}
        notes={activeNotes}
        onSeekTo={seekTo}
      />

      {/* Keyboard Shortcuts Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-indigoKaiwa" />
                <h2 className="text-sm font-bold">Phím tắt luyện Shadowing rảnh tay</h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-stone-500 dark:text-slate-400">Phát / Tạm dừng</span>
              <span className="font-mono font-semibold">Space</span>

              <span className="text-stone-500 dark:text-slate-400">Tua lùi / tới {state.settings.seekStepSec}s</span>
              <span className="font-mono font-semibold">← / →</span>

              <span className="text-stone-500 dark:text-slate-400">Tua lùi / tới 10s</span>
              <span className="font-mono font-semibold">Shift + ← / →</span>

              <span className="text-stone-500 dark:text-slate-400">Đặt điểm A / Điểm B</span>
              <span className="font-mono font-semibold">[ / ]</span>

              <span className="text-stone-500 dark:text-slate-400">Bật / tắt lặp A–B</span>
              <span className="font-mono font-semibold">R</span>

              <span className="text-stone-500 dark:text-slate-400">Làm mờ / Rèm che PDF</span>
              <span className="font-mono font-semibold">H</span>

              <span className="text-stone-500 dark:text-slate-400">Liếc nhanh khi đang che</span>
              <span className="font-mono font-semibold">Giữ V</span>

              <span className="text-stone-500 dark:text-slate-400">Trang PDF trước / sau</span>
              <span className="font-mono font-semibold">, / .</span>

              <span className="text-stone-500 dark:text-slate-400">Ẩn / hiện danh sách Track</span>
              <span className="font-mono font-semibold">B</span>
            </div>

            <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-[11px] leading-relaxed text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200">
              <p className="flex items-center gap-1 font-semibold">
                <Repeat className="h-3.5 w-3.5" /> Mẹo tự học Kaiwa hiệu quả:
              </p>
              <p className="mt-1">
                Đừng học quá nhiều track một lúc. Hãy chọn <strong>1 hội thoại ngắn</strong>, bật lặp <strong>A–B</strong> kèm <strong>Nghỉ 1s</strong>, đọc đuổi 5–10 lượt rồi chuyển sang bước <strong>4. Shadowing mù & Thu âm</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

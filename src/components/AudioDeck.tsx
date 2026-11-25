import React, { useEffect, useRef, useState } from 'react'
import { AudioTrack, KaiwaNote } from '../types'
import { formatTime } from '../utils/time'
import {
  BookmarkPlus,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react'

const SPEED_OPTIONS = [0.65, 0.75, 0.85, 0.95, 1.0, 1.1, 1.25]

interface AudioDeckProps {
  track: AudioTrack | null
  audioRef: React.RefObject<HTMLAudioElement | null>
  isPlaying: boolean
  onPlayingChange: (playing: boolean) => void
  currentTime: number
  duration: number
  onTimeUpdate: (time: number) => void
  onDurationChange: (dur: number) => void
  speed: number
  onSpeedChange: (speed: number) => void
  seekStepSec: number
  loopA: number | null
  loopB: number | null
  abActive: boolean
  pauseBetweenLoopsSec: number
  onChangePauseBetweenLoops: (sec: number) => void
  onSetLoopA: (t?: number) => void
  onSetLoopB: (t?: number) => void
  onToggleAbActive: () => void
  onClearAb: () => void
  onSaveAbPreset: () => void
  repeatTrack: boolean
  onToggleRepeatTrack: () => void
  autoNext: boolean
  onToggleAutoNext: () => void
  onPrevTrack: () => void
  onNextTrack: () => void
  onTrackEnded: () => void
  onLoopCompleted: () => void
  notes: KaiwaNote[]
  onSeekTo: (sec: number) => void
}

export const AudioDeck: React.FC<AudioDeckProps> = ({
  track,
  audioRef,
  isPlaying,
  onPlayingChange,
  currentTime,
  duration,
  onTimeUpdate,
  onDurationChange,
  speed,
  onSpeedChange,
  seekStepSec,
  loopA,
  loopB,
  abActive,
  pauseBetweenLoopsSec,
  onChangePauseBetweenLoops,
  onSetLoopA,
  onSetLoopB,
  onToggleAbActive,
  onClearAb,
  onSaveAbPreset,
  repeatTrack,
  onToggleRepeatTrack,
  autoNext,
  onToggleAutoNext,
  onPrevTrack,
  onNextTrack,
  onTrackEnded,
  onLoopCompleted,
  notes,
  onSeekTo,
}) => {
  const [volume, setVolume] = useState(1)
  const [waitingBetweenLoops, setWaitingBetweenLoops] = useState(false)
  const pauseTimerRef = useRef<number | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
    audio.preservesPitch = true
  }, [speed, audioRef, track?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume, audioRef])

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        window.clearTimeout(pauseTimerRef.current)
      }
    }
  }, [track?.id])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio || !track) return
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
      setWaitingBetweenLoops(false)
    }
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  function handleTimeUpdateEvent() {
    const audio = audioRef.current
    if (!audio) return
    const t = audio.currentTime
    onTimeUpdate(t)

    if (
      abActive &&
      loopA !== null &&
      loopB !== null &&
      loopB > loopA + 0.2 &&
      t >= loopB
    ) {
      onLoopCompleted()
      if (pauseBetweenLoopsSec > 0 && !waitingBetweenLoops) {
        audio.pause()
        setWaitingBetweenLoops(true)
        pauseTimerRef.current = window.setTimeout(() => {
          setWaitingBetweenLoops(false)
          if (audioRef.current) {
            audioRef.current.currentTime = loopA
            audioRef.current.play().catch(() => {})
          }
        }, pauseBetweenLoopsSec * 1000)
      } else if (!waitingBetweenLoops) {
        audio.currentTime = loopA
      }
    }
  }

  function handleEndedEvent() {
    if (repeatTrack && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
      return
    }
    onPlayingChange(false)
    onTrackEnded()
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || !duration) return
    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeekTo(ratio * duration)
  }

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const hasValidAb = loopA !== null && loopB !== null && loopB > loopA + 0.2
  const abLeftPct = hasValidAb && duration > 0 ? (loopA! / duration) * 100 : 0
  const abWidthPct = hasValidAb && duration > 0 ? ((loopB! - loopA!) / duration) * 100 : 0

  return (
    <div className="border-t border-stone-200 bg-white px-3 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-900 sm:px-5">
      <audio
        ref={audioRef}
        src={track?.url || undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget
          el.playbackRate = speed
          el.preservesPitch = true
          onDurationChange(el.duration || 0)
        }}
        onTimeUpdate={handleTimeUpdateEvent}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={handleEndedEvent}
      />

      {/* Interactive Timeline */}
      <div className="mb-2 flex items-center gap-3">
        <span className="w-11 text-right font-mono text-[11px] font-medium text-stone-500 dark:text-slate-400">
          {formatTime(currentTime)}
        </span>

        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-3 flex-1 cursor-pointer rounded-full bg-stone-200 dark:bg-slate-800"
        >
          {/* A-B Range Highlight */}
          {hasValidAb && (
            <div
              className={`absolute inset-y-0 rounded-full ${
                abActive ? 'bg-amber-400/65' : 'bg-amber-300/35'
              }`}
              style={{ left: `${abLeftPct}%`, width: `${abWidthPct}%` }}
            />
          )}

          {/* Playback Fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-indigoKaiwa transition-[width] duration-75"
            style={{ width: `${progressPct}%` }}
          />

          {/* A & B Pins */}
          {loopA !== null && duration > 0 && (
            <div
              className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded bg-amber-600"
              style={{ left: `${(loopA / duration) * 100}%` }}
              title={`Điểm A: ${formatTime(loopA)}`}
            />
          )}
          {loopB !== null && duration > 0 && (
            <div
              className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded bg-vermilion"
              style={{ left: `${(loopB / duration) * 100}%` }}
              title={`Điểm B: ${formatTime(loopB)}`}
            />
          )}

          {/* Kaiwa Note Markers */}
          {duration > 0 &&
            notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSeekTo(n.timeSec)
                }}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-matcha shadow hover:scale-125"
                style={{ left: `${Math.min(100, (n.timeSec / duration) * 100)}%` }}
                title={`${formatTime(n.timeSec)} — ${n.jpText}`}
              />
            ))}
        </div>

        <span className="w-11 font-mono text-[11px] font-medium text-stone-500 dark:text-slate-400">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Track Info + Playback */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevTrack}
            className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Track trước"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onSeekTo(Math.max(0, currentTime - seekStepSec))}
            className="inline-flex items-center gap-0.5 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            title={`Tua lùi ${seekStepSec}s (←)`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>-{seekStepSec}s</span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!track}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigoKaiwa text-white shadow transition hover:bg-indigo-700 disabled:opacity-40"
            title="Phát / Tạm dừng (Space)"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => onSeekTo(Math.min(duration || 9999, currentTime + seekStepSec))}
            className="inline-flex items-center gap-0.5 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            title={`Tua tới ${seekStepSec}s (→)`}
          >
            <span>+{seekStepSec}s</span>
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onNextTrack}
            className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Track tiếp theo"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {waitingBetweenLoops && (
            <span className="animate-pulse rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Đang nghỉ {pauseBetweenLoopsSec}s — hãy nhẩm lại!
            </span>
          )}
        </div>

        {/* A-B Loop Controls */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => onSetLoopA()}
            className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
              loopA !== null
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Đặt điểm đầu A ([)"
          >
            A {loopA !== null ? formatTime(loopA) : '([)'}
          </button>
          <button
            type="button"
            onClick={() => onSetLoopB()}
            className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
              loopB !== null
                ? 'border-red-300 bg-red-50 text-vermilion dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                : 'border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Đặt điểm cuối B (])"
          >
            B {loopB !== null ? formatTime(loopB) : '(])'}
          </button>

          <button
            type="button"
            disabled={!hasValidAb}
            onClick={onToggleAbActive}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition disabled:opacity-40 ${
              abActive
                ? 'bg-amber-500 text-white shadow-sm'
                : 'border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Bật/tắt lặp đoạn A–B (R)"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>Lặp A–B</span>
          </button>

          {hasValidAb && (
            <>
              <button
                type="button"
                onClick={onSaveAbPreset}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 font-medium text-indigoKaiwa hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-800"
                title="Lưu đoạn A–B này để ôn lại"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lưu A–B</span>
              </button>
              <button
                type="button"
                onClick={onClearAb}
                className="rounded-lg border border-stone-200 p-1 text-stone-500 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                title="Xóa điểm A–B"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <select
            value={pauseBetweenLoopsSec}
            onChange={(e) => onChangePauseBetweenLoops(Number(e.target.value))}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            title="Thời gian nghỉ giữa các vòng lặp A–B để bạn tự nhẩm lại"
          >
            <option value={0}>Nghỉ 0s</option>
            <option value={1}>Nghỉ 1s</option>
            <option value={2}>Nghỉ 2s</option>
            <option value={3}>Nghỉ 3s</option>
          </select>
        </div>

        {/* Speed, Repeat Track, Auto-next, Volume */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            {SPEED_OPTIONS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => onSpeedChange(sp)}
                className={`rounded-md px-1.5 py-1 font-mono text-[11px] font-semibold transition ${
                  speed === sp
                    ? 'bg-indigoKaiwa text-white shadow-sm'
                    : 'text-stone-600 hover:text-ink dark:text-slate-300'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleRepeatTrack}
            className={`rounded-lg border px-2 py-1 font-medium ${
              repeatTrack
                ? 'border-indigoKaiwa bg-indigo-50 text-indigoKaiwa dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-stone-200 text-stone-600 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Lặp toàn bộ track"
          >
            Lặp bài
          </button>

          <button
            type="button"
            onClick={onToggleAutoNext}
            className={`hidden rounded-lg border px-2 py-1 font-medium sm:inline-flex ${
              autoNext
                ? 'border-indigoKaiwa bg-indigo-50 text-indigoKaiwa dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-stone-200 text-stone-600 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Tự động chuyển sang bài tiếp theo khi hết track"
          >
            Auto-next
          </button>

          <div className="hidden items-center gap-1.5 md:flex">
            <Volume2 className="h-4 w-4 text-stone-500" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 accent-indigoKaiwa"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

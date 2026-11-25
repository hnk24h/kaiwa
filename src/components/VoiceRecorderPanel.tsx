import React, { useEffect, useRef, useState } from 'react'
import { UserRecording } from '../types'
import {
  deleteUserRecording,
  getRecordingsForTrack,
  saveUserRecording,
} from '../utils/audioRecordingDb'
import { formatTime } from '../utils/time'
import {
  Headphones,
  Mic,
  Play,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react'

interface VoiceRecorderPanelProps {
  trackId: string
  onPlayNativeSegment: () => void
  onStartShadowingWithAudio: () => void
  onRecordingStateChange?: (recording: boolean) => void
}

export const VoiceRecorderPanel: React.FC<VoiceRecorderPanelProps> = ({
  trackId,
  onPlayNativeSegment,
  onStartShadowingWithAudio,
  onRecordingStateChange,
}) => {
  const [recordings, setRecordings] = useState<UserRecording[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSec, setRecordingSec] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [playingRecId, setPlayingRecId] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    getRecordingsForTrack(trackId)
      .then((list) => {
        if (active) setRecordings(list)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [trackId])

  useEffect(() => {
    return () => {
      stopCleanup()
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause()
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopCleanup() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setMicLevel(0)
  }

  async function startRecording(alsoPlayNative: boolean) {
    setErrorMsg(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Trình duyệt không hỗ trợ thu âm hoặc thiếu HTTPS/localhost.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      // Live volume meter
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const updateMeter = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i += 1) sum += data[i]
        const avg = sum / data.length
        setMicLevel(Math.min(100, Math.round((avg / 90) * 100)))
        rafRef.current = requestAnimationFrame(updateMeter)
      }
      updateMeter()

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data)
        }
      }
      recorder.onstop = async () => {
        const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        const entry: UserRecording = {
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          trackId,
          blob,
          durationSec,
          createdAt: new Date().toISOString(),
        }
        await saveUserRecording(entry)
        const nextList = await getRecordingsForTrack(trackId)
        setRecordings(nextList)
        stopCleanup()
        setIsRecording(false)
        onRecordingStateChange?.(false)
      }

      startTimeRef.current = Date.now()
      setRecordingSec(0)
      timerRef.current = window.setInterval(() => {
        setRecordingSec(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 250)

      recorder.start()
      setIsRecording(true)
      onRecordingStateChange?.(true)

      if (alsoPlayNative) {
        onStartShadowingWithAudio()
      }
    } catch (err) {
      stopCleanup()
      setErrorMsg(
        err instanceof Error
          ? `Không truy cập được micro: ${err.message}`
          : 'Không thể bật micro.'
      )
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function playRecording(rec: UserRecording) {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      playbackAudioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (playingRecId === rec.id) {
      setPlayingRecId(null)
      return
    }

    const url = URL.createObjectURL(rec.blob)
    objectUrlRef.current = url
    const audio = new Audio(url)
    playbackAudioRef.current = audio
    setPlayingRecId(rec.id)
    audio.onended = () => setPlayingRecId(null)
    audio.play().catch(() => setPlayingRecId(null))
  }

  async function handleDelete(id: string) {
    if (playingRecId === id && playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      setPlayingRecId(null)
    }
    await deleteUserRecording(id)
    setRecordings((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3.5 text-xs">
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <p className="font-semibold text-ink dark:text-slate-100">
          Thu âm & So sánh giọng bản xứ
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-stone-500 dark:text-slate-400">
          Đeo tai nghe nếu chọn <strong>Shadowing + Thu âm</strong> để giọng của bạn tách biệt với file mẫu.
        </p>

        {/* Mic Meter */}
        {isRecording && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-vermilion">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 animate-ping rounded-full bg-vermilion" />
                Đang ghi âm...
              </span>
              <span>{formatTime(recordingSec)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-vermilion transition-all duration-75"
                style={{ width: `${micLevel}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {!isRecording ? (
            <>
              <button
                type="button"
                onClick={() => startRecording(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-vermilion px-3 py-2.5 font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <Mic className="h-4 w-4" />
                Shadowing + Thu âm cùng lúc
              </button>
              <button
                type="button"
                onClick={() => startRecording(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Mic className="h-4 w-4 text-vermilion" />
                Chỉ thu âm (tự nói chay)
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2.5 font-semibold text-white hover:bg-stone-800 dark:bg-slate-700"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Dừng & Lưu bản ghi
            </button>
          )}
        </div>

        {errorMsg && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700 dark:bg-red-950/60 dark:text-red-300">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Native Replay for instant comparison */}
      <button
        type="button"
        onClick={onPlayNativeSegment}
        className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 font-semibold text-indigoKaiwa transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
      >
        <Headphones className="h-4 w-4" />
        Nghe lại mẫu bản xứ (A–B / Track)
      </button>

      {/* Recordings List */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Bản thu của bạn ({recordings.length})
        </p>

        {recordings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-[11px] text-stone-400 dark:border-slate-700">
            Chưa có bản ghi âm nào cho track này. Hãy thử Shadowing mù rồi nghe lại để sửa ngữ điệu!
          </div>
        ) : (
          recordings.map((rec, idx) => {
            const playing = playingRecId === rec.id
            const timeLabel = new Date(rec.createdAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <div
                key={rec.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink dark:text-slate-100">
                    Lần thu #{recordings.length - idx}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    {formatTime(rec.durationSec)} · lúc {timeLabel}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => playRecording(rec)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold transition ${
                      playing
                        ? 'bg-matcha text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {playing ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{playing ? 'Đang phát' : 'Nghe'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(rec.id)}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60"
                    title="Xóa bản thu"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

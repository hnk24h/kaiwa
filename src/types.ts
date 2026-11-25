export type BookCategory = 'basic' | 'intermediate-advanced' | 'business'

export interface AudioTrack {
  id: string
  title: string
  fileName: string
  relPath: string
  url: string
  ext: string
  sectionId: string
  order: number
  defaultPdfPage?: number
  defaultKaitouPage?: number
}

export interface BookSection {
  id: string
  title: string
  tracks: AudioTrack[]
}

export interface Book {
  id: string
  title: string
  subtitle: string
  level: string
  category: BookCategory
  tags: string[]
  description: string
  accentColor: string
  pdfRelPath: string | null
  pdfUrl: string | null
  kaitouPdfRelPath: string | null
  kaitouPdfUrl: string | null
  defaultPdfKind?: 'main' | 'kaitou'
  hasTranslationFacingPage?: boolean
  coverUrl: string | null
  sections: BookSection[]
  totalTracks: number
}

export interface CatalogResponse {
  mediaRoot: string
  mediaRootExists: boolean
  books: Book[]
}

export type TrackStatus = 'new' | 'learning' | 'mastered'

export type ReviewRating = 'again' | 'good' | 'easy'

export interface TrackProgress {
  status: TrackStatus
  playCount: number
  loopCount: number
  pdfPage?: number
  kaitouPage?: number
  updatedAt: string
  reviewStage?: number
  nextReviewDate?: string
  lastReviewedAt?: string
  reviewCount?: number
}

export interface ABPreset {
  id: string
  label: string
  a: number
  b: number
  createdAt: string
}

export interface KaiwaNote {
  id: string
  timeSec: number
  jpText: string
  meaning: string
  createdAt: string
}

export interface LastSession {
  bookId: string
  trackId: string
  pdfPage: number
  pdfKind: 'main' | 'kaitou'
  updatedAt: string
}

export interface StudySettings {
  dailyGoalMinutes: number
  defaultSpeed: number
  seekStepSec: number
  autoPinPdfPage: boolean
  pauseBetweenLoopsSec: number
  darkMode: boolean
}

export type PlanPresetId = 'daily-life' | 'work-kaiwa' | 'full-mastery' | 'custom'

export interface StudyPlanDay {
  dayNumber: number
  dateKey: string
  title: string
  newTrackIds: string[]
  reviewTrackIds: string[]
  completedTrackIds: string[]
}

export interface StudyPlan {
  id: string
  name: string
  preset: PlanPresetId
  bookIds: string[]
  tracksPerDay: number
  minutesPerDay: number
  startDate: string
  createdAt: string
  days: StudyPlanDay[]
}

export type HomeTab = 'library' | 'plan' | 'progress'

export interface StudyState {
  lastSession: LastSession | null
  trackProgress: Record<string, TrackProgress>
  abPresets: Record<string, ABPreset[]>
  notes: Record<string, KaiwaNote[]>
  dailyMinutes: Record<string, number>
  studyPlan: StudyPlan | null
  settings: StudySettings
}

export type ShadowingStep = 1 | 2 | 3 | 4

export type PdfMaskMode = 'clear' | 'blur' | 'curtain'

export interface UserRecording {
  id: string
  trackId: string
  blob: Blob
  durationSec: number
  createdAt: string
}

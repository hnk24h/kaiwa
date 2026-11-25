export interface MensetsuSectionDef {
  id: string
  title: string
  cd: 1 | 2
  startTrack: number
  endTrack: number
  labels: string[]
}

export interface LessonBlockDef {
  id: string
  title: string
  startTrack: number
  endTrack: number
  mainStart: number
  mainEnd: number
  kaitouStart: number
  kaitouEnd: number
}

export declare const SHOCHUUKYUU_PAGES: number[]
export declare const CHUUJOUKYUU_CD1_PAGES: number[]
export declare const CHUUJOUKYUU_CD2_PAGES: number[]
export declare const CHUUJOUKYUU_UNIT8_TITLES: Record<number, string>
export declare const MENSETSU_CD1_PAGES: number[]
export declare const MENSETSU_CD2_PAGES: number[]
export declare const MENSETSU_SECTIONS_DEF: MensetsuSectionDef[]
export declare const NAMACHUUKEI_1_CD1_LESSONS: LessonBlockDef[]
export declare const NAMACHUUKEI_1_CD2_LESSONS: LessonBlockDef[]
export declare const NAMACHUUKEI_2_CD1_LESSONS: LessonBlockDef[]
export declare const NAMACHUUKEI_2_CD2_LESSONS: LessonBlockDef[]
export declare const NAMACHUUKEI_CHUUJOU_LESSONS: LessonBlockDef[]

export declare function mapLessonTrackPages(
  lesson: LessonBlockDef,
  trackNum: number,
  isIntroTrack?: boolean
): { defaultPdfPage: number; defaultKaitouPage: number }

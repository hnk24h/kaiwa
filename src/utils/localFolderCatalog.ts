import { AudioTrack, Book, BookSection } from '../types'
import {
  CHUUJOUKYUU_CD1_PAGES,
  CHUUJOUKYUU_CD2_PAGES,
  CHUUJOUKYUU_UNIT8_TITLES,
  MENSETSU_CD1_PAGES,
  MENSETSU_CD2_PAGES,
  MENSETSU_SECTIONS_DEF,
  NAMACHUUKEI_1_CD1_LESSONS,
  NAMACHUUKEI_1_CD2_LESSONS,
  NAMACHUUKEI_2_CD1_LESSONS,
  NAMACHUUKEI_2_CD2_LESSONS,
  NAMACHUUKEI_CHUUJOU_LESSONS,
  SHOCHUUKYUU_PAGES,
  mapLessonTrackPages,
} from '../../shared/trackPageMaps.mjs'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg'])
const DIR_HANDLE_DB = 'kaiwa-dir-handle-db'
const DIR_HANDLE_STORE = 'handles'
const DIR_HANDLE_KEY = 'media-root'

const KANJI_NUMBERS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

const CHUUJOUKYUU_UNIT_TOPICS: Record<number, string> = {
  1: 'Gia đình, vợ chồng & người yêu',
  2: 'Bạn bè thân thiết',
  3: 'Người quen & hàng xóm',
  4: 'Bác sĩ, nhân viên cửa hàng',
  5: 'Đồng nghiệp công sở',
  6: 'Cấp trên & cấp dưới',
  7: 'Khách hàng ngoài công ty & Phỏng vấn',
  8: 'Hội thoại dài & Thuyết trình',
}

interface FileRegistryEntry {
  file?: File
  handle?: FileSystemFileHandle
}

const fileRegistry = new Map<string, FileRegistryEntry>()
const audioUrlCache = new Map<string, string>()

function localUrl(relPath: string): string {
  return `local://${relPath}`
}

export function isLocalMediaUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith('local://'))
}

export function clearLocalObjectUrls(): void {
  for (const objUrl of audioUrlCache.values()) {
    URL.revokeObjectURL(objUrl)
  }
  audioUrlCache.clear()
}

export async function getLocalFile(url: string): Promise<File | null> {
  if (!isLocalMediaUrl(url)) return null
  const relPath = url.slice('local://'.length)
  const entry = fileRegistry.get(relPath)
  if (!entry) return null
  if (entry.file) return entry.file
  if (entry.handle) {
    const file = await entry.handle.getFile()
    entry.file = file
    return file
  }
  return null
}

export async function resolveAudioObjectUrl(url: string): Promise<string | null> {
  if (!isLocalMediaUrl(url)) return url
  const cached = audioUrlCache.get(url)
  if (cached) return cached
  const file = await getLocalFile(url)
  if (!file) return null
  const objUrl = URL.createObjectURL(file)
  audioUrlCache.set(url, objUrl)
  return objUrl
}

function getExt(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function getBaseName(name: string): string {
  const slash = name.lastIndexOf('/')
  const file = slash >= 0 ? name.slice(slash + 1) : name
  const dot = file.lastIndexOf('.')
  return dot >= 0 ? file.slice(0, dot) : file
}

function getFileName(relPath: string): string {
  const slash = relPath.lastIndexOf('/')
  return slash >= 0 ? relPath.slice(slash + 1) : relPath
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function listAudioPathsInDir(allPaths: Set<string>, dirRel: string): string[] {
  const prefix = dirRel ? `${dirRel}/` : ''
  const result: string[] = []
  for (const p of allPaths) {
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    if (rest.includes('/')) continue
    if (AUDIO_EXTENSIONS.has(getExt(rest))) {
      result.push(p)
    }
  }
  return result.sort(naturalSort)
}

function buildTracksFromPaths(
  relPaths: string[],
  bookId: string,
  sectionId: string
): AudioTrack[] {
  return relPaths.map((relPath, idx) => {
    const fileName = getFileName(relPath)
    const ext = getExt(fileName).slice(1)
    return {
      id: `${bookId}::${relPath}`,
      title: getBaseName(fileName),
      fileName,
      relPath,
      url: localUrl(relPath),
      ext,
      sectionId,
      order: idx + 1,
    }
  })
}

function parseKanjiUnitLabel(fileName: string): { key: string; title: string } {
  const unitMatch = fileName.match(/ユニット「([一二三四五六七八九十]+)」/)
  if (!unitMatch) {
    return { key: 'intro', title: 'Giới thiệu (Mở đầu)' }
  }
  const num = KANJI_NUMBERS[unitMatch[1]] || unitMatch[1]
  return { key: `unit-${num}`, title: `Unit ${num}` }
}

function parseChuujoukyuuUnitLabel(fileName: string, cdLabel: string): { key: string; title: string } {
  if (/^2-11\b/.test(fileName)) {
    return {
      key: 'cd2-unit-5',
      title: `CD2 · Unit 5: ${CHUUJOUKYUU_UNIT_TOPICS[5]}`,
    }
  }
  const unitMatch = fileName.match(/Unit\s*(\d+)/i)
  if (!unitMatch) {
    return { key: `${cdLabel.toLowerCase()}-intro`, title: `${cdLabel} — Mở đầu` }
  }
  const num = Number(unitMatch[1])
  const topic = CHUUJOUKYUU_UNIT_TOPICS[num]
  return {
    key: `${cdLabel.toLowerCase()}-unit-${num}`,
    title: topic ? `${cdLabel} · Unit ${num}: ${topic}` : `${cdLabel} · Unit ${num}`,
  }
}

function formatChuujoukyuuTrackTitle(fileName: string, idxInCd: number, cdNum: number): string {
  const base = getBaseName(fileName)
  if (cdNum === 2 && idxInCd === 10) {
    return '2-11 Unit 5 Section 2 同僚との会話 (上級)'
  }
  const u8Match = base.match(/Unit\s*8\s*Section\s*(\d+)/i)
  if (u8Match) {
    const secNum = Number(u8Match[1])
    const topic = CHUUJOUKYUU_UNIT8_TITLES[secNum]
    if (topic) return `${base.slice(0, 5)}Unit 8 Section ${secNum} · ${topic}`
  }
  return base
}

function groupTracksByParser(
  tracks: AudioTrack[],
  parser: (fileName: string) => { key: string; title: string }
): BookSection[] {
  const map = new Map<string, BookSection>()
  for (const track of tracks) {
    const { key, title } = parser(track.fileName)
    if (!map.has(key)) {
      map.set(key, { id: key, title, tracks: [] })
    }
    const section = map.get(key)!
    section.tracks.push({ ...track, sectionId: key })
  }
  return Array.from(map.values())
}

function groupNamachuukeiTracks(
  rawTracks: AudioTrack[],
  lessons: typeof NAMACHUUKEI_1_CD1_LESSONS,
  cdIntroTrackNum = 1
): BookSection[] {
  return lessons
    .map((lesson) => {
      const tracks: AudioTrack[] = []
      for (const t of rawTracks) {
        const trackNum = t.order
        if (trackNum >= lesson.startTrack && trackNum <= lesson.endTrack) {
          const isIntro = trackNum === cdIntroTrackNum && lesson.startTrack === cdIntroTrackNum
          const { defaultPdfPage, defaultKaitouPage } = mapLessonTrackPages(
            lesson,
            trackNum,
            isIntro
          )
          tracks.push({
            ...t,
            sectionId: lesson.id,
            title: isIntro ? `${t.title} · Mở đầu ${lesson.title.split(':')[0]}` : t.title,
            defaultPdfPage,
            defaultKaitouPage,
          })
        }
      }
      return { id: lesson.id, title: lesson.title, tracks }
    })
    .filter((sec) => sec.tracks.length > 0)
}

export async function buildBooksFromFileMap(
  relPaths: string[],
  resolveImageUrl?: (relPath: string) => Promise<string | null>
): Promise<Book[]> {
  const allPaths = new Set(relPaths)
  const books: Book[] = []
  const usedTopLevel = new Set<string>()

  const hasPrefix = (dirRel: string) => {
    const p = `${dirRel}/`
    for (const f of allPaths) {
      if (f.startsWith(p)) return true
    }
    return false
  }

  // 1. シャドーイング 日本語を話そう！ 初～中級編
  {
    const id = 'shadowing-shochuukyuu'
    const pdfRel = 'シャドウイング 日本語を話そう初_中級.pdf'
    const audioRel = 'シャドウイング 日本語を話そう初_中級'
    const hasPdf = allPaths.has(pdfRel)
    const audioPaths = listAudioPathsInDir(allPaths, audioRel)
    if (hasPdf || audioPaths.length > 0) {
      usedTopLevel.add(pdfRel)
      usedTopLevel.add(audioRel)
      const rawTracks = buildTracksFromPaths(audioPaths, id, 'default').map((t, idx) => ({
        ...t,
        defaultPdfPage: SHOCHUUKYUU_PAGES[idx] ?? 1,
      }))
      const sections = groupTracksByParser(rawTracks, parseKanjiUnitLabel)
      books.push({
        id,
        title: 'シャドーイング 日本語を話そう！ 初～中級編',
        subtitle: 'Shadowing tiếng Nhật — Sơ đến Trung cấp',
        level: 'Cơ bản – Sơ trung cấp',
        category: 'basic',
        tags: ['N5–N3', 'Đời sống', 'Có bản dịch tiếng Việt'],
        description:
          'Giáo trình luyện shadowing kinh điển giúp chỉnh phát âm, nhịp điệu tự nhiên và phản xạ hội thoại hằng ngày.',
        accentColor: '#3B4CCA',
        pdfRelPath: hasPdf ? pdfRel : null,
        pdfUrl: hasPdf ? localUrl(pdfRel) : null,
        kaitouPdfRelPath: null,
        kaitouPdfUrl: null,
        hasTranslationFacingPage: true,
        coverUrl: null,
        sections,
        totalTracks: rawTracks.length,
      })
    }
  }

  // 2. シャドーイング 日本語を話そう！ 中～上級編
  {
    const id = 'shadowing-chuujoukyuu'
    const pdfRel = 'シャドウイング 日本語を話そう中_上級.pdf'
    const cd1Rel = 'シャドウイング 日本語を話そう中_上級 CD1'
    const cd2Rel = 'シャドウイング 日本語を話そう中_上級 CD2'
    const hasPdf = allPaths.has(pdfRel)
    const cd1Paths = listAudioPathsInDir(allPaths, cd1Rel)
    const cd2Paths = listAudioPathsInDir(allPaths, cd2Rel)
    if (hasPdf || cd1Paths.length > 0 || cd2Paths.length > 0) {
      usedTopLevel.add(pdfRel)
      usedTopLevel.add(cd1Rel)
      usedTopLevel.add(cd2Rel)
      const cd1Tracks = buildTracksFromPaths(cd1Paths, id, 'cd1').map((t, idx) => ({
        ...t,
        title: formatChuujoukyuuTrackTitle(t.fileName, idx, 1),
        defaultPdfPage: CHUUJOUKYUU_CD1_PAGES[idx] ?? 1,
      }))
      const cd2Tracks = buildTracksFromPaths(cd2Paths, id, 'cd2').map((t, idx) => ({
        ...t,
        title: formatChuujoukyuuTrackTitle(t.fileName, idx, 2),
        defaultPdfPage: CHUUJOUKYUU_CD2_PAGES[idx] ?? 95,
      }))
      const sections = [
        ...groupTracksByParser(cd1Tracks, (f) => parseChuujoukyuuUnitLabel(f, 'CD1')),
        ...groupTracksByParser(cd2Tracks, (f) => parseChuujoukyuuUnitLabel(f, 'CD2')),
      ]
      books.push({
        id,
        title: 'シャドーイング 日本語を話そう！ 中～上級編',
        subtitle: 'Shadowing tiếng Nhật — Trung đến Cao cấp',
        level: 'Trung cấp – Cao cấp',
        category: 'intermediate-advanced',
        tags: ['N3–N1', 'Đời sống & Công sở', 'Có bản dịch tiếng Việt'],
        description:
          'Luyện giao tiếp theo từng mối quan hệ (bạn bè, hàng xóm, đồng nghiệp, cấp trên, khách hàng) và bài thuyết trình tốc độ thật.',
        accentColor: '#D9483B',
        pdfRelPath: hasPdf ? pdfRel : null,
        pdfUrl: hasPdf ? localUrl(pdfRel) : null,
        kaitouPdfRelPath: null,
        kaitouPdfUrl: null,
        hasTranslationFacingPage: true,
        coverUrl: null,
        sections,
        totalTracks: cd1Tracks.length + cd2Tracks.length,
      })
    }
  }

  // 3. シャドーイング 日本語を話そう！ 就職・アルバイト・進学面接編
  {
    const id = 'shadowing-mensetsu'
    const folderRel = '[studyjapanese.net]_Shadowing_Shuushoku.Arubaito.Shingaku_Mensetsu_hen'
    const pdfRel = `${folderRel}/[studyjapanese.net]_Shadowing_Shuushoku.Arubaito.Shingaku_Mensetsu_hen.pdf`
    const cd1Rel = `${folderRel}/[studyjapanese.net]_Shadowing_Shuushoku.Arubaito.Shingaku_Mensetsu_hen-CD1`
    const cd2Rel = `${folderRel}/[studyjapanese.net]_Shadowing_Shuushoku.Arubaito.Shingaku_Mensetsu_hen-CD2`
    const coverRel =
      'シャドーイング　日本語を話そう　就職・アルバイト・進学面接編　[インドネシア語・タイ語・ベトナム語訳版].jpg'
    if (hasPrefix(folderRel)) {
      usedTopLevel.add(folderRel)
      if (allPaths.has(coverRel)) usedTopLevel.add(coverRel)
      const hasPdf = allPaths.has(pdfRel)
      const cd1Tracks = buildTracksFromPaths(listAudioPathsInDir(allPaths, cd1Rel), id, 'cd1').map(
        (t, idx) => ({ ...t, defaultPdfPage: MENSETSU_CD1_PAGES[idx] ?? 2 })
      )
      const cd2Tracks = buildTracksFromPaths(listAudioPathsInDir(allPaths, cd2Rel), id, 'cd2').map(
        (t, idx) => ({ ...t, defaultPdfPage: MENSETSU_CD2_PAGES[idx] ?? 78 })
      )

      const sections: BookSection[] = MENSETSU_SECTIONS_DEF.map((secDef) => {
        const pool = secDef.cd === 1 ? cd1Tracks : cd2Tracks
        const tracks: AudioTrack[] = []
        for (let n = secDef.startTrack; n <= secDef.endTrack; n += 1) {
          const baseTrack = pool[n - 1]
          if (!baseTrack) continue
          const label = secDef.labels[n - secDef.startTrack] || baseTrack.title
          tracks.push({
            ...baseTrack,
            sectionId: secDef.id,
            title: `CD${secDef.cd}-${String(n).padStart(2, '0')} · ${label}`,
          })
        }
        return { id: secDef.id, title: secDef.title, tracks }
      }).filter((sec) => sec.tracks.length > 0)

      const coverUrl =
        allPaths.has(coverRel) && resolveImageUrl ? await resolveImageUrl(coverRel) : null

      books.push({
        id,
        title: 'シャドーイング 日本語を話そう！ 就職・アルバイト・進学面接編',
        subtitle: 'Xin việc, Làm thêm & Phỏng vấn (Bản dịch Tiếng Việt)',
        level: 'Công việc & Phỏng vấn',
        category: 'business',
        tags: ['Công việc', 'Phỏng vấn', 'Có tiếng Việt'],
        description:
          'Tập trung phỏng vấn xin việc chính thức, baito, học lên, kính ngữ công sở và trả lời tự nhiên trước nhà tuyển dụng.',
        accentColor: '#2E7D5B',
        pdfRelPath: hasPdf ? pdfRel : null,
        pdfUrl: hasPdf ? localUrl(pdfRel) : null,
        kaitouPdfRelPath: null,
        kaitouPdfUrl: null,
        hasTranslationFacingPage: true,
        coverUrl,
        sections,
        totalTracks: cd1Tracks.length + cd2Tracks.length,
      })
    }
  }

  // 4. 聞いて覚える話し方 日本語生中継 初中級 1
  {
    const id = 'namachuukei-shochuukyuu-1'
    const folderRel = 'JML_Namachuukei_Shochuukyuu_1'
    const pdfRel = `${folderRel}/Namachuukei Shochuukyuu 1.pdf`
    const kaitouRel = `${folderRel}/Namachuukei Shochuukyuu 1-Kaitou.pdf`
    if (hasPrefix(folderRel)) {
      usedTopLevel.add(folderRel)
      const hasPdf = allPaths.has(pdfRel)
      const hasKaitou = allPaths.has(kaitouRel)
      const p1 = buildTracksFromPaths(
        listAudioPathsInDir(allPaths, `${folderRel}/AudioCD/1-5`),
        id,
        'cd1'
      ).map((t) => ({ ...t, title: `CD1 · ${t.title}` }))
      const p2 = buildTracksFromPaths(
        listAudioPathsInDir(allPaths, `${folderRel}/AudioCD/6-10`),
        id,
        'cd2'
      ).map((t) => ({ ...t, title: `CD2 · ${t.title}` }))

      const sections = [
        ...groupNamachuukeiTracks(p1, NAMACHUUKEI_1_CD1_LESSONS, 1),
        ...groupNamachuukeiTracks(p2, NAMACHUUKEI_1_CD2_LESSONS, 1),
      ]
      books.push({
        id,
        title: '聞いて覚える話し方 日本語生中継 初中級 1',
        subtitle: 'Nihongo Namachuukei — Sơ trung cấp 1',
        level: 'Cơ bản – Sơ trung cấp',
        category: 'basic',
        tags: ['N4–N3', 'Hội thoại thật', 'Có file Đáp án/Script'],
        description:
          'Nghe & bắt chước cách nói chuyện sinh động ngoài đời thật, có kèm file Đáp án/Script riêng để đối chiếu.',
        accentColor: '#0284C7',
        pdfRelPath: hasPdf ? pdfRel : null,
        pdfUrl: hasPdf ? localUrl(pdfRel) : null,
        kaitouPdfRelPath: hasKaitou ? kaitouRel : null,
        kaitouPdfUrl: hasKaitou ? localUrl(kaitouRel) : null,
        defaultPdfKind: hasKaitou ? 'kaitou' : 'main',
        coverUrl: null,
        sections,
        totalTracks: p1.length + p2.length,
      })
    }
  }

  // 5. 聞いて覚える話し方 日本語生中継 初中級 2
  {
    const id = 'namachuukei-shochuukyuu-2'
    const folderRel = 'Namachuukei Shochuukyuu 2'
    const pdfRel = `${folderRel}/Namachuukei Shochuukyuu 2.pdf`
    if (hasPrefix(folderRel)) {
      usedTopLevel.add(folderRel)
      const hasPdf = allPaths.has(pdfRel)
      const p1 = buildTracksFromPaths(
        listAudioPathsInDir(allPaths, `${folderRel}/AudioCD/1-5`),
        id,
        'cd1'
      ).map((t) => ({ ...t, title: `CD1 · ${t.title}` }))
      const p2 = buildTracksFromPaths(
        listAudioPathsInDir(allPaths, `${folderRel}/AudioCD/6-10`),
        id,
        'cd2'
      ).map((t) => ({ ...t, title: `CD2 · ${t.title}` }))

      const sections = [
        ...groupNamachuukeiTracks(p1, NAMACHUUKEI_2_CD1_LESSONS, 1),
        ...groupNamachuukeiTracks(p2, NAMACHUUKEI_2_CD2_LESSONS, 1),
      ]
      books.push({
        id,
        title: '聞いて覚える話し方 日本語生中継 初中級 2',
        subtitle: 'Nihongo Namachuukei — Sơ trung cấp 2',
        level: 'Cơ bản – Sơ trung cấp',
        category: 'basic',
        tags: ['N3', 'Đời sống tự nhiên', 'Kèm Script cuối sách'],
        description:
          'Tiếp nối Tập 1, mở rộng mẫu câu giao tiếp đời sống tự nhiên, có sẵn phần Script hội thoại ở nửa sau PDF.',
        accentColor: '#0D9488',
        pdfRelPath: hasPdf ? pdfRel : null,
        pdfUrl: hasPdf ? localUrl(pdfRel) : null,
        kaitouPdfRelPath: hasPdf ? pdfRel : null,
        kaitouPdfUrl: hasPdf ? localUrl(pdfRel) : null,
        defaultPdfKind: hasPdf ? 'kaitou' : 'main',
        coverUrl: null,
        sections,
        totalTracks: p1.length + p2.length,
      })
    }
  }

  // 6. 聞いて覚える話し方 日本語生中継 中上級
  {
    const id = 'namachuukei-chuujoukyuu'
    const folderRel = 'Namachuukei Chuujoukyuu'
    const pdfRel = `${folderRel}/Namachuukei Chuujoukyuu.pdf`
    const kaitouRel = `${folderRel}/Namachuukei Chuujoukyuu-Kaitou.pdf`
    if (hasPrefix(folderRel)) {
      usedTopLevel.add(folderRel)
      const hasPdf = allPaths.has(pdfRel)
      const hasKaitou = allPaths.has(kaitouRel)
      const allTracks = buildTracksFromPaths(
        listAudioPathsInDir(allPaths, `${folderRel}/Audio CD`),
        id,
        'all'
      )
      const sections = groupNamachuukeiTracks(allTracks, NAMACHUUKEI_CHUUJOU_LESSONS, 1)
      books.push({
        id,
        title: '聞いて覚える話し方 日本語生中継 中上級',
        subtitle: 'Nihongo Namachuukei — Trung đến Cao cấp',
        level: 'Trung cấp – Cao cấp',
        category: 'intermediate-advanced',
        tags: ['N2–N1', 'Công sở & Đời sống', 'Có file Đáp án/Script'],
        description:
          'Tình huống giao tiếp phức tạp ở nơi làm việc và xã hội (nhắn tin, mời mọc, xin phép, truyền đạt thông tin), kèm file Đáp án/Script.',
        accentColor: '#7C3AED',
        pdfRelPath: hasPdf ? pdfRel : null,
        pdfUrl: hasPdf ? localUrl(pdfRel) : null,
        kaitouPdfRelPath: hasKaitou ? kaitouRel : null,
        kaitouPdfUrl: hasKaitou ? localUrl(kaitouRel) : null,
        defaultPdfKind: hasKaitou ? 'kaitou' : 'main',
        coverUrl: null,
        sections,
        totalTracks: allTracks.length,
      })
    }
  }

  // Extra top-level folders
  const extraBuckets = new Map<string, string[]>()
  for (const p of allPaths) {
    const slash = p.indexOf('/')
    if (slash < 0) continue
    const top = p.slice(0, slash)
    if (usedTopLevel.has(top)) continue
    if (!extraBuckets.has(top)) extraBuckets.set(top, [])
    extraBuckets.get(top)!.push(p)
  }

  let extraIdx = 1
  for (const [folderName, paths] of extraBuckets.entries()) {
    const pdfs = paths.filter((f) => getExt(f) === '.pdf').sort(naturalSort)
    const audios = paths.filter((f) => AUDIO_EXTENSIONS.has(getExt(f))).sort(naturalSort)
    if (pdfs.length === 0 && audios.length === 0) continue

    const slug =
      folderName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `extra-${extraIdx}`
    extraIdx += 1
    const bookId = `custom-${slug}`
    const mainPdf = pdfs.find((p) => !/kaitou/i.test(p)) || pdfs[0] || null
    const kaitouPdf = pdfs.find((p) => /kaitou/i.test(p) && p !== mainPdf) || null
    const tracks = buildTracksFromPaths(audios, bookId, 'all')

    books.push({
      id: bookId,
      title: folderName,
      subtitle: 'Tài liệu tự thêm vào thư mục',
      level: 'Tùy chỉnh',
      category: 'basic',
      tags: ['Tự động nhận diện'],
      description: `Tự động tìm thấy ${pdfs.length} PDF và ${tracks.length} file audio.`,
      accentColor: '#475569',
      pdfRelPath: mainPdf,
      pdfUrl: mainPdf ? localUrl(mainPdf) : null,
      kaitouPdfRelPath: kaitouPdf,
      kaitouPdfUrl: kaitouPdf ? localUrl(kaitouPdf) : null,
      coverUrl: null,
      sections: tracks.length > 0 ? [{ id: 'all', title: 'Tất cả bài nghe', tracks }] : [],
      totalTracks: tracks.length,
    })
  }

  return books
}

// IndexedDB persistence for FileSystemDirectoryHandle
function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DIR_HANDLE_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DIR_HANDLE_STORE)) {
        db.createObjectStore(DIR_HANDLE_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_HANDLE_STORE, 'readwrite')
    tx.objectStore(DIR_HANDLE_STORE).put(handle, DIR_HANDLE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(DIR_HANDLE_STORE, 'readonly')
      const req = tx.objectStore(DIR_HANDLE_STORE).get(DIR_HANDLE_KEY)
      req.onsuccess = () => {
        db.close()
        resolve((req.result as FileSystemDirectoryHandle) || null)
      }
      req.onerror = () => {
        db.close()
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

export async function clearSavedDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DIR_HANDLE_STORE, 'readwrite')
      tx.objectStore(DIR_HANDLE_STORE).delete(DIR_HANDLE_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        resolve()
      }
    })
  } catch {
    // ignore
  }
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function checkSavedDirectory(): Promise<{
  handle: FileSystemDirectoryHandle
  name: string
  permission: PermissionState
} | null> {
  if (!isDirectoryPickerSupported()) return null
  const handle = await getSavedDirectoryHandle()
  if (!handle) return null
  try {
    const permission = await (handle as unknown as {
      queryPermission: (opts: { mode: 'read' }) => Promise<PermissionState>
    }).queryPermission({ mode: 'read' })
    return { handle, name: handle.name, permission }
  } catch {
    return null
  }
}

async function walkDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  prefix = ''
): Promise<string[]> {
  const paths: string[] = []
  const iter = (dirHandle as unknown as {
    entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
  }).entries()

  for await (const [name, handle] of iter) {
    if (name === 'desktop.ini' || name.toLowerCase().endsWith('.rar')) continue
    const rel = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      const nested = await walkDirectoryHandle(handle as FileSystemDirectoryHandle, rel)
      paths.push(...nested)
    } else if (handle.kind === 'file') {
      fileRegistry.set(rel, { handle: handle as FileSystemFileHandle })
      paths.push(rel)
    }
  }
  return paths
}

async function buildCatalogFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle
): Promise<{ folderName: string; books: Book[] }> {
  clearLocalObjectUrls()
  fileRegistry.clear()
  const relPaths = await walkDirectoryHandle(dirHandle)
  const books = await buildBooksFromFileMap(relPaths, (rel) => resolveAudioObjectUrl(localUrl(rel)))
  return { folderName: dirHandle.name, books }
}

export async function pickLocalFolderCatalog(): Promise<{
  folderName: string
  books: Book[]
}> {
  const picker = (window as unknown as {
    showDirectoryPicker: (opts: { id?: string; mode?: 'read' }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  const dirHandle = await picker({ id: 'kaiwa-luyennoi', mode: 'read' })
  await saveDirectoryHandle(dirHandle)
  return buildCatalogFromDirectoryHandle(dirHandle)
}

export async function reconnectSavedFolderCatalog(): Promise<{
  folderName: string
  books: Book[]
} | null> {
  const handle = await getSavedDirectoryHandle()
  if (!handle) return null
  const perm = await (handle as unknown as {
    requestPermission: (opts: { mode: 'read' }) => Promise<PermissionState>
  }).requestPermission({ mode: 'read' })
  if (perm !== 'granted') return null
  return buildCatalogFromDirectoryHandle(handle)
}

export async function loadCatalogFromFileList(files: FileList): Promise<{
  folderName: string
  books: Book[]
}> {
  clearLocalObjectUrls()
  fileRegistry.clear()

  let folderName = 'Thư mục sách'
  const relPaths: string[] = []

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const rawRel = (file.webkitRelativePath || file.name).replace(/\\/g, '/')
    const slash = rawRel.indexOf('/')
    let rel = rawRel
    if (slash > 0) {
      folderName = rawRel.slice(0, slash)
      rel = rawRel.slice(slash + 1)
    }
    if (!rel || rel === 'desktop.ini' || rel.toLowerCase().endsWith('.rar')) continue
    fileRegistry.set(rel, { file })
    relPaths.push(rel)
  }

  const books = await buildBooksFromFileMap(relPaths, (rel) => resolveAudioObjectUrl(localUrl(rel)))
  return { folderName, books }
}

import fs from 'node:fs'
import path from 'node:path'
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
} from './trackPageMaps.mjs'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg'])

const KANJI_NUMBERS = {
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

const CHUUJOUKYUU_UNIT_TOPICS = {
  1: 'Gia đình, vợ chồng & người yêu',
  2: 'Bạn bè thân thiết',
  3: 'Người quen & hàng xóm',
  4: 'Bác sĩ, nhân viên cửa hàng',
  5: 'Đồng nghiệp công sở',
  6: 'Cấp trên & cấp dưới',
  7: 'Khách hàng ngoài công ty & Phỏng vấn',
  8: 'Hội thoại dài & Thuyết trình',
}

function toPosixRel(rootDir, fullPath) {
  return path.relative(rootDir, fullPath).split(path.sep).join('/')
}

function mediaUrl(relPath) {
  return `/api/media?p=${encodeURIComponent(relPath)}`
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function listAudioFiles(dirPath, rootDir, bookId, sectionId) {
  if (!fs.existsSync(dirPath)) return []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort(naturalSort)

  return files.map((fileName, idx) => {
    const fullPath = path.join(dirPath, fileName)
    const relPath = toPosixRel(rootDir, fullPath)
    const ext = path.extname(fileName).toLowerCase().slice(1)
    const title = path.basename(fileName, path.extname(fileName))
    return {
      id: `${bookId}::${relPath}`,
      title,
      fileName,
      relPath,
      url: mediaUrl(relPath),
      ext,
      sectionId,
      order: idx + 1,
    }
  })
}

function parseKanjiUnitLabel(fileName) {
  const unitMatch = fileName.match(/ユニット「([一二三四五六七八九十]+)」/)
  if (!unitMatch) {
    return { key: 'intro', title: 'Giới thiệu (Mở đầu)' }
  }
  const num = KANJI_NUMBERS[unitMatch[1]] || unitMatch[1]
  return { key: `unit-${num}`, title: `Unit ${num}` }
}

function parseChuujoukyuuUnitLabel(fileName, cdLabel) {
  // Note: 2-11 filename says "Unit 6 Section 1" in MP3 name, but printed book & audio belong to Unit 5 Section 2 (p.114)
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

function formatChuujoukyuuTrackTitle(fileName, idxInCd, cdNum) {
  const base = path.basename(fileName, path.extname(fileName))
  if (cdNum === 2 && idxInCd === 10) {
    // 2-11 is actually Unit 5 Section 2 (page 114)
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

function groupTracksByParser(tracks, parser) {
  const map = new Map()
  for (const track of tracks) {
    const { key, title } = parser(track.fileName)
    if (!map.has(key)) {
      map.set(key, { id: key, title, tracks: [] })
    }
    const section = map.get(key)
    section.tracks.push({ ...track, sectionId: key })
  }
  return Array.from(map.values())
}

function groupNamachuukeiTracks(rawTracks, lessons, cdIntroTrackNum = 1) {
  return lessons
    .map((lesson) => {
      const tracks = []
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

function buildCuratedBooks(mediaRoot) {
  const books = []
  const usedTopLevelEntries = new Set()

  // 1. シャドーイング 日本語を話そう！ 初～中級編
  {
    const id = 'shadowing-shochuukyuu'
    const pdfRel = 'シャドウイング 日本語を話そう初_中級.pdf'
    const audioRel = 'シャドウイング 日本語を話そう初_中級'
    const pdfPath = path.join(mediaRoot, pdfRel)
    const audioPath = path.join(mediaRoot, audioRel)
    if (fs.existsSync(pdfPath) || fs.existsSync(audioPath)) {
      usedTopLevelEntries.add(pdfRel)
      usedTopLevelEntries.add(audioRel)
      const rawTracks = listAudioFiles(audioPath, mediaRoot, id, 'default').map((t, idx) => ({
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
        pdfRelPath: fs.existsSync(pdfPath) ? pdfRel : null,
        pdfUrl: fs.existsSync(pdfPath) ? mediaUrl(pdfRel) : null,
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
    const pdfPath = path.join(mediaRoot, pdfRel)
    const cd1Path = path.join(mediaRoot, cd1Rel)
    const cd2Path = path.join(mediaRoot, cd2Rel)
    if (fs.existsSync(pdfPath) || fs.existsSync(cd1Path) || fs.existsSync(cd2Path)) {
      usedTopLevelEntries.add(pdfRel)
      usedTopLevelEntries.add(cd1Rel)
      usedTopLevelEntries.add(cd2Rel)
      const cd1Tracks = listAudioFiles(cd1Path, mediaRoot, id, 'cd1').map((t, idx) => ({
        ...t,
        title: formatChuujoukyuuTrackTitle(t.fileName, idx, 1),
        defaultPdfPage: CHUUJOUKYUU_CD1_PAGES[idx] ?? 1,
      }))
      const cd2Tracks = listAudioFiles(cd2Path, mediaRoot, id, 'cd2').map((t, idx) => ({
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
        pdfRelPath: fs.existsSync(pdfPath) ? pdfRel : null,
        pdfUrl: fs.existsSync(pdfPath) ? mediaUrl(pdfRel) : null,
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

    const folderPath = path.join(mediaRoot, folderRel)
    const pdfPath = path.join(mediaRoot, pdfRel)
    const coverPath = path.join(mediaRoot, coverRel)
    if (fs.existsSync(folderPath)) {
      usedTopLevelEntries.add(folderRel)
      if (fs.existsSync(coverPath)) usedTopLevelEntries.add(coverRel)

      const cd1Tracks = listAudioFiles(path.join(mediaRoot, cd1Rel), mediaRoot, id, 'cd1').map(
        (t, idx) => ({
          ...t,
          defaultPdfPage: MENSETSU_CD1_PAGES[idx] ?? 2,
        })
      )
      const cd2Tracks = listAudioFiles(path.join(mediaRoot, cd2Rel), mediaRoot, id, 'cd2').map(
        (t, idx) => ({
          ...t,
          defaultPdfPage: MENSETSU_CD2_PAGES[idx] ?? 78,
        })
      )

      const sections = MENSETSU_SECTIONS_DEF.map((secDef) => {
        const pool = secDef.cd === 1 ? cd1Tracks : cd2Tracks
        const tracks = []
        for (let n = secDef.startTrack; n <= secDef.endTrack; n++) {
          const baseTrack = pool[n - 1]
          if (!baseTrack) continue
          const labelIdx = n - secDef.startTrack
          const label = secDef.labels[labelIdx] || baseTrack.title
          tracks.push({
            ...baseTrack,
            sectionId: secDef.id,
            title: `CD${secDef.cd}-${String(n).padStart(2, '0')} · ${label}`,
          })
        }
        return {
          id: secDef.id,
          title: secDef.title,
          tracks,
        }
      }).filter((sec) => sec.tracks.length > 0)

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
        pdfRelPath: fs.existsSync(pdfPath) ? pdfRel : null,
        pdfUrl: fs.existsSync(pdfPath) ? mediaUrl(pdfRel) : null,
        kaitouPdfRelPath: null,
        kaitouPdfUrl: null,
        hasTranslationFacingPage: true,
        coverUrl: fs.existsSync(coverPath) ? mediaUrl(coverRel) : null,
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
    const folderPath = path.join(mediaRoot, folderRel)
    if (fs.existsSync(folderPath)) {
      usedTopLevelEntries.add(folderRel)
      const pdfPath = path.join(mediaRoot, pdfRel)
      const kaitouPath = path.join(mediaRoot, kaitouRel)
      const p1 = listAudioFiles(path.join(mediaRoot, `${folderRel}/AudioCD/1-5`), mediaRoot, id, 'cd1').map(
        (t) => ({ ...t, title: `CD1 · ${t.title}` })
      )
      const p2 = listAudioFiles(path.join(mediaRoot, `${folderRel}/AudioCD/6-10`), mediaRoot, id, 'cd2').map(
        (t) => ({ ...t, title: `CD2 · ${t.title}` })
      )
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
        pdfRelPath: fs.existsSync(pdfPath) ? pdfRel : null,
        pdfUrl: fs.existsSync(pdfPath) ? mediaUrl(pdfRel) : null,
        kaitouPdfRelPath: fs.existsSync(kaitouPath) ? kaitouRel : null,
        kaitouPdfUrl: fs.existsSync(kaitouPath) ? mediaUrl(kaitouRel) : null,
        defaultPdfKind: fs.existsSync(kaitouPath) ? 'kaitou' : 'main',
        coverUrl: null,
        sections,
        totalTracks: p1.length + p2.length,
      })
    }
  }

  // 5. 聞いて覚える話し方 日本語生中継 初中級 2 (Script booklet embedded at p.97-135)
  {
    const id = 'namachuukei-shochuukyuu-2'
    const folderRel = 'Namachuukei Shochuukyuu 2'
    const pdfRel = `${folderRel}/Namachuukei Shochuukyuu 2.pdf`
    const folderPath = path.join(mediaRoot, folderRel)
    if (fs.existsSync(folderPath)) {
      usedTopLevelEntries.add(folderRel)
      const pdfPath = path.join(mediaRoot, pdfRel)
      const hasPdf = fs.existsSync(pdfPath)
      const p1 = listAudioFiles(path.join(mediaRoot, `${folderRel}/AudioCD/1-5`), mediaRoot, id, 'cd1').map(
        (t) => ({ ...t, title: `CD1 · ${t.title}` })
      )
      const p2 = listAudioFiles(path.join(mediaRoot, `${folderRel}/AudioCD/6-10`), mediaRoot, id, 'cd2').map(
        (t) => ({ ...t, title: `CD2 · ${t.title}` })
      )
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
        pdfUrl: hasPdf ? mediaUrl(pdfRel) : null,
        kaitouPdfRelPath: hasPdf ? pdfRel : null,
        kaitouPdfUrl: hasPdf ? mediaUrl(pdfRel) : null,
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
    const folderPath = path.join(mediaRoot, folderRel)
    if (fs.existsSync(folderPath)) {
      usedTopLevelEntries.add(folderRel)
      const pdfPath = path.join(mediaRoot, pdfRel)
      const kaitouPath = path.join(mediaRoot, kaitouRel)
      const allTracks = listAudioFiles(path.join(mediaRoot, `${folderRel}/Audio CD`), mediaRoot, id, 'all')
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
        pdfRelPath: fs.existsSync(pdfPath) ? pdfRel : null,
        pdfUrl: fs.existsSync(pdfPath) ? mediaUrl(pdfRel) : null,
        kaitouPdfRelPath: fs.existsSync(kaitouPath) ? kaitouRel : null,
        kaitouPdfUrl: fs.existsSync(kaitouPath) ? mediaUrl(kaitouRel) : null,
        defaultPdfKind: fs.existsSync(kaitouPath) ? 'kaitou' : 'main',
        coverUrl: null,
        sections,
        totalTracks: allTracks.length,
      })
    }
  }

  return { books, usedTopLevelEntries }
}

function collectFilesRecursive(dirPath, results = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectFilesRecursive(full, results)
    } else if (entry.isFile()) {
      results.push(full)
    }
  }
  return results
}

function discoverExtraBooks(mediaRoot, usedTopLevelEntries) {
  const extras = []
  const topEntries = fs.readdirSync(mediaRoot, { withFileTypes: true })

  for (const entry of topEntries) {
    if (!entry.isDirectory()) continue
    if (usedTopLevelEntries.has(entry.name)) continue

    const dirFull = path.join(mediaRoot, entry.name)
    const files = collectFilesRecursive(dirFull)
    const pdfs = files.filter((f) => path.extname(f).toLowerCase() === '.pdf').sort(naturalSort)
    const audios = files
      .filter((f) => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort(naturalSort)

    if (pdfs.length === 0 && audios.length === 0) continue

    const slug = entry.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `extra-${extras.length + 1}`
    const bookId = `custom-${slug}`
    const mainPdf = pdfs.find((p) => !/kaitou/i.test(p)) || pdfs[0] || null
    const kaitouPdf = pdfs.find((p) => /kaitou/i.test(p) && p !== mainPdf) || null

    const tracks = audios.map((full, idx) => {
      const relPath = toPosixRel(mediaRoot, full)
      const fileName = path.basename(full)
      return {
        id: `${bookId}::${relPath}`,
        title: path.basename(fileName, path.extname(fileName)),
        fileName,
        relPath,
        url: mediaUrl(relPath),
        ext: path.extname(fileName).toLowerCase().slice(1),
        sectionId: 'all',
        order: idx + 1,
      }
    })

    extras.push({
      id: bookId,
      title: entry.name,
      subtitle: 'Tài liệu tự thêm vào thư mục',
      level: 'Tùy chỉnh',
      category: 'basic',
      tags: ['Tự động nhận diện'],
      description: `Tự động tìm thấy ${pdfs.length} PDF và ${tracks.length} file audio.`,
      accentColor: '#475569',
      pdfRelPath: mainPdf ? toPosixRel(mediaRoot, mainPdf) : null,
      pdfUrl: mainPdf ? mediaUrl(toPosixRel(mediaRoot, mainPdf)) : null,
      kaitouPdfRelPath: kaitouPdf ? toPosixRel(mediaRoot, kaitouPdf) : null,
      kaitouPdfUrl: kaitouPdf ? mediaUrl(toPosixRel(mediaRoot, kaitouPdf)) : null,
      coverUrl: null,
      sections: tracks.length > 0 ? [{ id: 'all', title: 'Tất cả bài nghe', tracks }] : [],
      totalTracks: tracks.length,
    })
  }

  return extras
}

export function buildCatalog(mediaRoot) {
  if (!mediaRoot || !fs.existsSync(mediaRoot)) {
    return {
      mediaRoot,
      mediaRootExists: false,
      books: [],
    }
  }

  const { books, usedTopLevelEntries } = buildCuratedBooks(mediaRoot)
  const extraBooks = discoverExtraBooks(mediaRoot, usedTopLevelEntries)
  return {
    mediaRoot,
    mediaRootExists: true,
    books: [...books, ...extraBooks],
  }
}

// Exact PDF-verified track-to-page mappings for all 6 books in D:\02. Tiếng Nhật\luyennoi

export const SHOCHUUKYUU_PAGES = [
  3, // 01 前書
  // Unit 1 (tracks 2-11)
  25, 27, 29, 31, 33, 35, 37, 39, 41, 43,
  // Unit 2 (tracks 12-20)
  47, 49, 51, 53, 55, 57, 59, 61, 63,
  // Unit 3 (tracks 21-28)
  67, 69, 71, 73, 75, 77, 79, 81,
  // Unit 4 (tracks 29-36)
  87, 89, 91, 93, 95, 97, 99, 101,
  // Unit 5 (tracks 37-43)
  107, 111, 115, 119, 123, 127, 131,
]

export const CHUUJOUKYUU_CD1_PAGES = [
  4, // 1-01 タイトル
  // Unit 1 Sec 1 (1-02..1-04)
  20, 22, 24,
  // Unit 1 Sec 2 (1-05..1-09)
  26, 28, 30, 32, 34,
  // Unit 2 Sec 1 (1-10..1-13)
  40, 42, 44, 46,
  // Unit 2 Sec 2 (1-14..1-18)
  48, 50, 52, 54, 56,
  // Unit 3 Sec 1 (1-19..1-21)
  62, 64, 66,
  // Unit 3 Sec 2 (1-22..1-27)
  68, 70, 72, 74, 76, 78,
  // Unit 4 Sec 1 (1-28..1-29)
  82, 84,
  // Unit 4 Sec 2 (1-30..1-33)
  86, 88, 90, 92,
]

export const CHUUJOUKYUU_CD2_PAGES = [
  95, // 2-01 Disk 2 タイトル
  // Unit 5 Sec 1 (2-02..2-05)
  96, 98, 100, 102,
  // Unit 5 Sec 2 (2-06..2-11) — note: 2-11 is Unit 5 Sec 2 on p.114
  104, 106, 108, 110, 112, 114,
  // Unit 6 Sec 1 (2-12..2-14)
  120, 122, 124,
  // Unit 6 Sec 2 (2-15..2-18)
  126, 128, 130, 132,
  // Unit 7 Sec 1 (2-19..2-20)
  136, 138,
  // Unit 7 Sec 2 (2-21..2-23)
  140, 142, 144,
  // Unit 8 Sec 1..8 (2-24..2-31)
  150, 152, 154, 156, 158, 160, 162, 164,
]

export const CHUUJOUKYUU_UNIT8_TITLES = {
  1: 'クレーム (Khiếu nại)',
  2: '恋愛トーク (Chuyện tình cảm)',
  3: '野球観戦 (Xem bóng chày)',
  4: '上司と部下 (Sếp & nhân viên)',
  5: '就職面接 (Phỏng vấn xin việc)',
  6: 'テレフォンショッピング (Mua sắm qua ĐT)',
  7: '結婚式 新郎のスピーチ (Phát biểu đám cưới)',
  8: 'プレゼンテーション (Thuyết trình)',
}

export const MENSETSU_CD1_PAGES = [
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24,
  28, 30, 32, 34, 36, 38, 40, 42, 44, 48,
  54, 56, 60, 62, 66, 70, 72,
]

export const MENSETSU_CD2_PAGES = [
  78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102,
  108, 110, 112, 114, 116, 118, 120, 122,
  126, 130, 134, 138, 142, 148,
]

export const MENSETSU_SECTIONS_DEF = [
  {
    id: 'unit-1',
    title: 'Unit 1 — Phỏng vấn làm thêm (CD1 01–11)',
    cd: 1,
    startTrack: 1,
    endTrack: 11,
    labels: [
      '1-1 Small Talk · Chào hỏi khi đến phỏng vấn',
      '1-1 Small Talk · Trò chuyện ngắn mở đầu',
      '1-2 Hẹn phỏng vấn qua điện thoại (1)',
      '1-2 Hẹn phỏng vấn qua điện thoại (2)',
      '1-2 Hẹn phỏng vấn qua điện thoại (3)',
      '1-3 Phỏng vấn làm thêm Baito (1)',
      '1-3 Phỏng vấn làm thêm Baito (2)',
      '1-3 Phỏng vấn làm thêm Baito (3)',
      '1-4 Luyện tổng hợp: Gọi điện hẹn lịch',
      '1-4 Luyện tổng hợp: Phỏng vấn Baito',
      'Unit 1 · My Page (Luyện tự nói)',
    ],
  },
  {
    id: 'unit-2',
    title: 'Unit 2 — Phỏng vấn Đại học & Senmon (CD1 12–21)',
    cd: 1,
    startTrack: 12,
    endTrack: 21,
    labels: [
      '2-1 Lý do ứng tuyển & mức độ quan tâm (1)',
      '2-1 Lý do ứng tuyển & mức độ quan tâm (2)',
      '2-1 Lý do ứng tuyển & mức độ quan tâm (3)',
      '2-1 Hỏi về kế hoạch học tập tương lai (1)',
      '2-1 Hỏi về kế hoạch học tập tương lai (2)',
      '2-1 Hỏi về tài chính & đời sống sinh hoạt',
      '2-1 Hỏi về năng lực tiếng Nhật (1)',
      '2-1 Hỏi về năng lực tiếng Nhật (2)',
      '2-2 Luyện tổng hợp: Phỏng vấn nhập học',
      'Unit 2 · My Page (Luyện tự nói)',
    ],
  },
  {
    id: 'unit-3-1',
    title: 'Unit 3-1 — Phỏng vấn & Thảo luận nhóm (CD1 22–28)',
    cd: 1,
    startTrack: 22,
    endTrack: 28,
    labels: [
      '3-1 Phỏng vấn nhóm: Ngành may mặc & quảng cáo',
      '3-1 Phỏng vấn nhóm: Thương mại & bán lẻ',
      '3-1 Phỏng vấn nhóm: Thực phẩm',
      '3-1 Phỏng vấn nhóm: Truyền thông & sự kiện',
      '3-1 Phỏng vấn nhóm: Ngành dịch vụ',
      '3-1 Thảo luận nhóm: Điều phối ý kiến',
      '3-1 Thảo luận nhóm: Trình bày & chốt ý kiến',
    ],
  },
  {
    id: 'unit-3-2',
    title: 'Unit 3-2 — Phỏng vấn cá nhân: Tự PR bản thân (CD2 01–13)',
    cd: 2,
    startTrack: 1,
    endTrack: 13,
    labels: [
      '3-2 Tự PR · Hỏi về điểm mạnh & sở trường (1)',
      '3-2 Tự PR · Hỏi về điểm mạnh & sở trường (2)',
      '3-2 Tự PR · Kinh nghiệm & nỗ lực thời sinh viên (1)',
      '3-2 Tự PR · Kinh nghiệm & nỗ lực thời sinh viên (2)',
      '3-2 Tự PR · Kinh nghiệm & nỗ lực thời sinh viên (3)',
      '3-2 Tự PR · Kinh nghiệm & nỗ lực thời sinh viên (4)',
      '3-2 Tự PR · Tính cách & cách làm việc nhóm (1)',
      '3-2 Tự PR · Tính cách & cách làm việc nhóm (2)',
      '3-2 Tự PR · Định hướng tương lai (1)',
      '3-2 Tự PR · Định hướng tương lai (2)',
      '3-2 Tự PR · Câu hỏi dành riêng cho người nước ngoài (1)',
      '3-2 Tự PR · Câu hỏi dành riêng cho người nước ngoài (2)',
      '3-2 Tự PR · Câu hỏi dành riêng cho người nước ngoài (3)',
    ],
  },
  {
    id: 'unit-3-3',
    title: 'Unit 3-3 — Phỏng vấn cá nhân: Lý do ứng tuyển (CD2 14–21)',
    cd: 2,
    startTrack: 14,
    endTrack: 21,
    labels: [
      '3-3 Động lực ứng tuyển & hiểu biết về công ty',
      '3-3 Ngành sản xuất: Hóa chất & Game',
      '3-3 Ngành sản xuất: Phụ tùng & Đồ thể thao',
      '3-3 Ngành dịch vụ: Bất động sản',
      '3-3 Câu hỏi về công việc, chức vụ & sản phẩm',
      '3-3 Ngành dịch vụ: Hàng không & Du lịch',
      '3-3 Ngành dịch vụ: Khách sạn',
      '3-3 Ngành tài chính, bán lẻ & máy tính',
    ],
  },
  {
    id: 'unit-3-4',
    title: 'Unit 3-4 — Luyện tổng hợp phỏng vấn xin việc (CD2 22–27)',
    cd: 2,
    startTrack: 22,
    endTrack: 27,
    labels: [
      '3-4 Luyện tổng hợp 1: Nhà sản xuất thực phẩm',
      '3-4 Luyện tổng hợp 2: Ngành IT',
      '3-4 Luyện tổng hợp 3: Ngành khách sạn',
      '3-4 Luyện tổng hợp 4: Ngành bán lẻ',
      '3-4 Luyện tổng hợp 5: Giao nhận & Logistics',
      'Unit 3 · My Page (Luyện tự nói)',
    ],
  },
]

export const NAMACHUUKEI_1_CD1_LESSONS = [
  { id: 'lesson-1', title: 'Bài 1: 貸してもらう (Mượn đồ)', startTrack: 1, endTrack: 9, mainStart: 9, mainEnd: 16, kaitouStart: 3, kaitouEnd: 6 },
  { id: 'lesson-2', title: 'Bài 2: 予定を変更する (Đổi lịch hẹn)', startTrack: 10, endTrack: 17, mainStart: 17, mainEnd: 24, kaitouStart: 7, kaitouEnd: 10 },
  { id: 'lesson-3', title: 'Bài 3: レストランで (Ở nhà hàng)', startTrack: 18, endTrack: 25, mainStart: 25, mainEnd: 32, kaitouStart: 11, kaitouEnd: 14 },
  { id: 'lesson-4', title: 'Bài 4: 旅行の感想 (Cảm nghĩ chuyến đi)', startTrack: 26, endTrack: 33, mainStart: 33, mainEnd: 40, kaitouStart: 15, kaitouEnd: 18 },
  { id: 'lesson-5', title: 'Bài 5: 買い物 (Mua sắm)', startTrack: 34, endTrack: 42, mainStart: 41, mainEnd: 48, kaitouStart: 19, kaitouEnd: 22 },
]

export const NAMACHUUKEI_1_CD2_LESSONS = [
  { id: 'lesson-6', title: 'Bài 6: アルバイトを探す (Tìm việc làm thêm)', startTrack: 1, endTrack: 9, mainStart: 49, mainEnd: 56, kaitouStart: 23, kaitouEnd: 26 },
  { id: 'lesson-7', title: 'Bài 7: ほめられて (Được khen)', startTrack: 10, endTrack: 17, mainStart: 57, mainEnd: 64, kaitouStart: 27, kaitouEnd: 29 },
  { id: 'lesson-8', title: 'Bài 8: 交通手段 (Phương tiện đi lại)', startTrack: 18, endTrack: 26, mainStart: 65, mainEnd: 72, kaitouStart: 30, kaitouEnd: 33 },
  { id: 'lesson-9', title: 'Bài 9: ゆずります (Nhượng lại đồ)', startTrack: 27, endTrack: 34, mainStart: 73, mainEnd: 80, kaitouStart: 34, kaitouEnd: 37 },
  { id: 'lesson-10', title: 'Bài 10: マンション (Chung cư & Nội quy)', startTrack: 35, endTrack: 42, mainStart: 81, mainEnd: 88, kaitouStart: 38, kaitouEnd: 41 },
]

export const NAMACHUUKEI_2_CD1_LESSONS = [
  { id: 'lesson-1', title: 'Bài 1: 出会い (Gặp gỡ)', startTrack: 1, endTrack: 9, mainStart: 12, mainEnd: 19, kaitouStart: 97, kaitouEnd: 100 },
  { id: 'lesson-2', title: 'Bài 2: ホテルで (Ở khách sạn)', startTrack: 10, endTrack: 17, mainStart: 20, mainEnd: 27, kaitouStart: 101, kaitouEnd: 104 },
  { id: 'lesson-3', title: 'Bài 3: うわさ (Tin đồn / Kể lại)', startTrack: 18, endTrack: 25, mainStart: 28, mainEnd: 35, kaitouStart: 105, kaitouEnd: 107 },
  { id: 'lesson-4', title: 'Bài 4: 機械のトラブル (Sự cố máy móc)', startTrack: 26, endTrack: 33, mainStart: 36, mainEnd: 43, kaitouStart: 108, kaitouEnd: 111 },
  { id: 'lesson-5', title: 'Bài 5: 失敗 (Thất bại / Sai sót)', startTrack: 34, endTrack: 41, mainStart: 44, mainEnd: 51, kaitouStart: 112, kaitouEnd: 115 },
]

export const NAMACHUUKEI_2_CD2_LESSONS = [
  { id: 'lesson-6', title: 'Bài 6: 電話をかける (Gọi điện thoại)', startTrack: 1, endTrack: 9, mainStart: 52, mainEnd: 59, kaitouStart: 116, kaitouEnd: 119 },
  { id: 'lesson-7', title: 'Bài 7: 健康のために (Vì sức khỏe)', startTrack: 10, endTrack: 17, mainStart: 60, mainEnd: 67, kaitouStart: 120, kaitouEnd: 123 },
  { id: 'lesson-8', title: 'Bài 8: 駅で (Ở nhà ga)', startTrack: 18, endTrack: 26, mainStart: 68, mainEnd: 75, kaitouStart: 124, kaitouEnd: 127 },
  { id: 'lesson-9', title: 'Bài 9: 趣味 (Sở thích & Rủ rê)', startTrack: 27, endTrack: 35, mainStart: 76, mainEnd: 83, kaitouStart: 128, kaitouEnd: 131 },
  { id: 'lesson-10', title: 'Bài 10: 抱負 (Mục tiêu & Cổ vũ)', startTrack: 36, endTrack: 43, mainStart: 84, mainEnd: 91, kaitouStart: 132, kaitouEnd: 135 },
]

export const NAMACHUUKEI_CHUUJOU_LESSONS = [
  { id: 'lesson-1', title: 'Bài 1: 「今、いないんですけど」―伝言― (Nhắn lại)', startTrack: 1, endTrack: 16, mainStart: 9, mainEnd: 18, kaitouStart: 3, kaitouEnd: 7 },
  { id: 'lesson-2', title: 'Bài 2: 「一緒に行ってみない？」―勧誘― (Mời mọc)', startTrack: 17, endTrack: 27, mainStart: 19, mainEnd: 28, kaitouStart: 8, kaitouEnd: 12 },
  { id: 'lesson-3', title: 'Bài 3: 「これ、使わせてもらってもいいかなって」―許可― (Xin phép)', startTrack: 28, endTrack: 39, mainStart: 29, mainEnd: 38, kaitouStart: 13, kaitouEnd: 16 },
  { id: 'lesson-4', title: 'Bài 4: 「渋滞してるらしいですよ」―情報伝達― (Truyền đạt thông tin)', startTrack: 40, endTrack: 52, mainStart: 39, mainEnd: 48, kaitouStart: 17, kaitouEnd: 19 },
  { id: 'lesson-5', title: 'Bài 5: 「そこをなんとか」―依頼・指示― (Nhờ vả & Chỉ thị)', startTrack: 53, endTrack: 63, mainStart: 49, mainEnd: 58, kaitouStart: 20, kaitouEnd: 24 },
  { id: 'lesson-6', title: 'Bài 6: 「予約しておいたはずなんですけど」―文句― (Phàn nàn)', startTrack: 64, endTrack: 77, mainStart: 59, mainEnd: 68, kaitouStart: 25, kaitouEnd: 29 },
  { id: 'lesson-7', title: 'Bài 7: 「中華のほうがいいんじゃない？」―提案― (Đề xuất)', startTrack: 78, endTrack: 88, mainStart: 69, mainEnd: 78, kaitouStart: 30, kaitouEnd: 33 },
  { id: 'lesson-8', title: 'Bài 8: 「給料は悪くないんだけどね」―感想― (Cảm nhận công việc)', startTrack: 89, endTrack: 99, mainStart: 79, mainEnd: 88, kaitouStart: 34, kaitouEnd: 37 },
]

/**
 * Computes deterministic main-book PDF page and Kaitou/Script PDF page
 * for any track inside a Namachuukei lesson block.
 */
export function mapLessonTrackPages(lesson, trackNum, isIntroTrack = false) {
  if (isIntroTrack) {
    return {
      defaultPdfPage: lesson.mainStart,
      defaultKaitouPage: lesson.kaitouStart,
    }
  }
  const offset = Math.max(0, trackNum - lesson.startTrack)
  const count = Math.max(1, lesson.endTrack - lesson.startTrack + 1)
  const ratio = count > 1 ? offset / (count - 1) : 0

  let defaultPdfPage
  if (offset < 4) {
    defaultPdfPage = Math.min(lesson.mainEnd, lesson.mainStart + 1)
  } else {
    const bodyStart = Math.min(lesson.mainEnd, lesson.mainStart + 3)
    const bodyEnd = Math.max(bodyStart, lesson.mainEnd - 1)
    const bodyRatio = count > 5 ? (offset - 4) / (count - 5) : 0
    defaultPdfPage = Math.round(bodyStart + bodyRatio * (bodyEnd - bodyStart))
  }

  const defaultKaitouPage = Math.round(
    lesson.kaitouStart + ratio * (lesson.kaitouEnd - lesson.kaitouStart)
  )

  return { defaultPdfPage, defaultKaitouPage }
}

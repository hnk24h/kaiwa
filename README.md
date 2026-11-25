# Kaiwa Shadowing — Phòng luyện nói tiếng Nhật tự học

Ứng dụng web chuyên dụng giúp tự học **Shadowing** trực tiếp từ bộ sách PDF và file nghe (`.mp3` / `.m4a`) trong máy tính của bạn mà không cần copy dữ liệu (~1 GB).

## Tính năng chính

- **Tự động đọc & tổ chức 6 bộ sách** trong `D:\02. Tiếng Nhật\luyennoi` (hoặc `/mnt/d/02. Tiếng Nhật/luyennoi` trên WSL):
  - *シャドーイング 日本語を話そう！ 初～中級編*
  - *シャドーイング 日本語を話そう！ 中～上級編*
  - *シャドーイング 日本語を話そう！ 就職・アルバイト・進学面接編*
  - *聞いて覚える話し方 日本語生中継 初中級 1 & 2* (kèm tab Đáp án/Script)
  - *聞いて覚える話し方 日本語生中継 中上級* (kèm tab Đáp án/Script)
- **Quy trình Shadowing 4 bước** ngay trên thanh trên cùng:
  1. `Nghe chay` (tự động làm mờ PDF)
  2. `Đọc hiểu` (hiện rõ PDF + ghi chú Kaiwa)
  3. `Shadowing (nhìn sách)` (lặp A–B, chỉnh tốc độ 0.65x–1.25x)
  4. `Shadowing mù & Thu âm` (làm mờ PDF + ghi âm so sánh giọng bản xứ)
- **Ghim trang PDF theo từng Track (`Auto-Pin`)**: Đổi track là tự nhảy đúng trang sách đã ghim.
- **Lặp A–B + Nghỉ giữa vòng (`0s / 1s / 2s / 3s`)**: Cho phép tự nhẩm lại trước khi đoạn audio lặp lại.
- **Màn che / Làm mờ PDF (`H`, giữ `V` để liếc nhanh)** & **Rèm che trượt** để che phần dịch hoặc script.
- **Thu âm giọng nói (IndexedDB)** & **Sổ tay cụm câu Kaiwa gắn timestamp**.

## Cách chạy

### 1. Chế độ Production (khuyên dùng hằng ngày)
Trên Linux / WSL:
```bash
npm install
npm run build
npm start
```
Mở trình duyệt tại: `http://localhost:3100`

Trên Windows: chạy file `start-windows.bat` (mặc định trỏ tới `D:\02. Tiếng Nhật\luyennoi`).

### 2. Chế độ Development
```bash
npm run dev
```
Frontend chạy tại `http://localhost:5173`, API server chạy tại `http://localhost:3100`.

### 3. Thay đổi thư mục chứa sách (tùy chọn)
Có thể truyền biến môi trường `MEDIA_ROOT="/duong/dan/toi/thu/muc"` hoặc sửa trực tiếp trong mục **Cài đặt** trên giao diện web.

iTV WEB - TRANG WEB KHÁN GIẢ RIÊNG
==================================
Đây là trang bình chọn / tìm bài / thả icon / bình luận đặt trên một địa chỉ riêng (không phải localhost:3000).
Máy chạy OBS KHÔNG cần mở cổng ra internet: nó tự kết nối ra trang này để lấy bình chọn/icon/bình luận
và gửi lên danh sách bài + bảng xếp hạng.

  Khán giả --> [iTV WEB trên host riêng] <-- (máy OBS tự kết nối ra, mỗi giây)

BƯỚC 1: ĐƯA TRANG WEB LÊN HOST (chọn 1 cách)
  Cần host chạy được Node.js (bản 16+). Ví dụ:
   - Render.com / Railway / Fly.io: tạo tài khoản, đưa thư mục này lên GitHub, tạo "Web Service" từ repo đó,
       Start command:  node server.js
       Environment:    RELAY_KEY = (một chuỗi bí mật do bạn tự đặt, dài, khó đoán)
     Host sẽ cho bạn một địa chỉ dạng https://ten-ban.onrender.com  -> đó là link gửi khán giả.
     (Gói miễn phí có host tự "ngủ" khi vắng người, lần mở đầu có thể chậm vài chục giây.)
   - VPS: copy thư mục, chạy  RELAY_KEY=chuoi_bi_mat PORT=80 node server.js  (nên dùng pm2 + HTTPS).
   - Thử trên máy: RELAY_KEY=abc node server.js  rồi mở http://localhost:8080

BƯỚC 2: NỐI VỚI MÁY CHẠY OBS
  Mở file config.json trong thư mục itv-server (máy OBS), điền:
     { "relayUrl": "https://ten-ban.onrender.com", "relayKey": "chuỗi bí mật đã đặt ở bước 1" }
  Chạy lại itv-server. Cửa sổ đen sẽ báo "Đã kết nối trang web khán giả".
  Từ giờ gửi khán giả link của trang web riêng; không cần gửi link localhost nữa.

LƯU Ý
  - Giữ bí mật RELAY_KEY. Đừng chia sẻ /admin và /player?key=... của máy OBS.
  - Nếu máy OBS tắt hoặc mất mạng quá 1 phút, trang khán giả báo "đang offline".
  - Bài hát (file/link) chỉ nằm ở máy OBS, trang khán giả không biết link nhạc.

KIỂM TRA KẾT NỐI
  Mở  https://TÊN-CỦA-BẠN.onrender.com/health
    "keySet":false  -> Render CHƯA có RELAY_KEY (vào Environment đặt rồi deploy lại)
    "keySet":true, "synced":false -> máy OBS chưa nối được: xem dòng ">> MẤT kết nối ... [lý do]" ở cửa sổ đen
    "synced":true   -> đã nối thành công
  Cửa sổ Logs của Render in "RELAY_KEY đã đặt: N ký tự"; relayKey ở máy OBS phải có cùng N ký tự.
  Khóa chỉ gồm chữ không dấu và số. Không dùng dấu cách, dấu nháy, tiếng Việt có dấu.

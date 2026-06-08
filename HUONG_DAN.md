# Hướng Dẫn Kích Hoạt Dịch Thuật Giao Diện Chat (Hover Translate) Trên Antigravity IDE

Tài liệu này hướng dẫn cách chạy và sử dụng tính năng dịch thuật thông minh (di chuột dịch tiếng Anh sang tiếng Việt) trong phần Chat của Antigravity IDE trên macOS và Windows một cách ổn định nhất.

---

## 📌 Nguyên lý hoạt động
Do cơ chế bảo mật của IDE và hệ điều hành, chúng ta **không chỉnh sửa trực tiếp các file hệ thống** của Antigravity IDE (nếu sửa, ứng dụng có thể bị báo hỏng).

Giải pháp duy nhất là **kích hoạt cổng gỡ lỗi (cổng 9333)** khi mở IDE, để extension hoặc script chạy ngầm có thể "bơm" (inject) mã nguồn dịch thuật vào cửa sổ Chat.

---

## 🛠 Hướng dẫn thực hiện (Chọn 1 trong 2 cách bên dưới)

### Cách 1: Sử dụng Extension VSIX (Khuyên Dùng)
Nếu bạn đã import file `.vsix` vào IDE:

1. Không cần làm thêm thao tác nào.
2. Nếu Antigravity chưa kích hoạt VSIX ngay, lần mở bình thường tiếp theo sẽ tự thiết lập helper.
3. Nếu cổng dịch `9333` chưa bật, extension thông báo Antigravity sẽ tự khởi động lại sau 10 giây.
4. Status bar đếm ngược từng giây; người dùng không cần bấm gì.
5. Mở Antigravity bằng icon gốc như bình thường.
6. Khi tính năng dịch hoạt động, góc dưới bên phải hiện:
   `🟢 Smart Translate: Active`
7. Di chuột vào các đoạn tiếng Anh trong Chat để xem dịch nghĩa tiếng Việt.

Trước khi gỡ VSIX, chạy:

`Smart Translate: Remove Automatic Startup`

Helper tự động theo hệ điều hành:

- macOS: dùng LaunchAgent và file `auto-relaunch-monitor.sh`.
- Windows: dùng Startup folder của người dùng và file `auto-relaunch-monitor.ps1` chạy ẩn bằng PowerShell, không cần quyền Admin.

---

### Cách 2: Sử dụng Script chạy ngầm (Không cần cài VSIX, chủ yếu cho macOS/dev)
Nếu bạn không muốn cài đặt extension VSIX:

1. **Tắt hoàn toàn Antigravity IDE** (`Cmd + Q`).
2. Trong thư mục dự án dịch thuật, chạy file lệnh khởi động:
   * **Cách click**: Click đúp vào file `Start Antigravity EnVi Hover.command` trong thư mục:
     `ag-chat-envi-hover/`
   * **Cách dùng Terminal**: Chạy các lệnh sau:
     ```bash
     cd /duong-dan/den/ag-chat-envi-hover
     ./launch-runtime.sh
     ```
3. Script này sẽ tự động khởi động Antigravity IDE kèm cổng debug và bơm code dịch thuật vào. 
   *(Lưu ý: Giữ nguyên cửa sổ Terminal chạy script này trong suốt quá trình làm việc).*

---

## 🚀 Cách tạo phím tắt mở IDE nhanh trên macOS (Không cần gõ lệnh lại)

Trong thư mục này đã có sẵn launcher:

`Antigravity EnVi Hover.app`

Bạn có thể kéo app này vào Dock và dùng nó thay icon Antigravity gốc. Mỗi lần mở bằng launcher này, IDE sẽ tự mở với cổng dịch `9333`, VSIX sẽ tự inject và tooltip sẽ hoạt động.

---

## 🔁 Cài helper thủ công

VSIX phiên bản mới tự cài helper hoàn toàn. Các lệnh dưới đây chỉ dùng để sửa lỗi hoặc phát triển trên macOS:

```bash
cd /duong-dan/den/ag-chat-envi-hover
./install-auto-helper.sh
```

Sau khi cài, bạn có thể mở Antigravity bằng icon gốc như bình thường. Nếu helper thấy IDE đang mở nhưng chưa có cổng dịch `9333`, nó sẽ tự quit và mở lại đúng cách.

Gỡ helper:

```bash
cd /duong-dan/den/ag-chat-envi-hover
./uninstall-auto-helper.sh
```

---

## ⌨️ Phím tắt sử dụng trong Chat
* Nhấn tổ hợp phím **`Option + T`** trong giao diện IDE để bật/tắt nhanh tính năng dịch thuật.
* Khi bản dịch dài, tooltip sẽ thu gọn. Bạn chỉ cần **click vào tooltip** để xem toàn bộ bản dịch và click một lần nữa để thu gọn.

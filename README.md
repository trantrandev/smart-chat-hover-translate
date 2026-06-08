# Smart Chat Hover Translate

Smart context-aware hover-translation extension for the Antigravity IDE chat / Agent Manager UI.

[Tiếng Việt bên dưới](#tiếng-việt)

---

## English

### Key Features
- **Hover Translation**: Hover over English text inside the Antigravity Chat or Agent Manager to view the translated meaning instantly in a small, clean tooltip.
- **Context-Aware Accuracy**: The extension uses bracket-wrapping (`[target]`) on full sentence/paragraph structures before sending to Google Translate, ensuring grammatically correct, context-specific translations.
- **Dynamic Status Bar Item**:
  - `Smart Translate: On` (Green) when active.
  - `Smart Translate: Off` (Orange) when the debug port is not enabled. Click the status bar item to automatically relaunch Antigravity IDE with the correct debug arguments.
- **Shortcut Toggle**: Press `Option + T` (macOS) inside the IDE to toggle the translation tool on/off at any time.

---

### Installation Instructions

1. **Download the Extension**:
   - Download the latest `smart-chat-hover-translate-x.x.x.vsix` file from the **Releases** section of this repository.
2. **Install in Antigravity IDE**:
   - Open Antigravity IDE.
   - Open the **Extensions** panel (`Cmd + Shift + X`).
   - Click the triple-dot menu (`...`) in the top-right of the Extensions panel.
   - Select **Install from VSIX...**
   - Choose the downloaded `.vsix` file.
3. **Activate**:
   - Look at the bottom-right status bar. If it says **`Smart Translate: Off`**, click it and select **Yes** to relaunch the IDE.
   - Once relaunched, the status bar will change to **`Smart Translate: On`** and hover translation is active!

---

## Tiếng Việt

Bộ tiện ích mở rộng dịch thuật thông minh theo ngữ cảnh khi di chuột (hover) dành cho giao diện chat/Agent Manager của Antigravity IDE.

### Tính năng nổi bật
- **Dịch khi di chuột**: Di chuột qua các cụm từ tiếng Anh trong khung Chat hoặc Agent Manager của Antigravity để xem nghĩa tiếng Việt ngay trên tooltip nhỏ gọn.
- **Dịch chuẩn theo ngữ cảnh**: Tự động bọc từ cần dịch trong ngữ cảnh câu gốc trước khi gửi đến công cụ dịch, đảm bảo kết quả chính xác theo ngữ cảnh lập trình (ví dụ: dịch đúng từ `checkout` trong ngữ cảnh Git là *"kiểm tra"* thay vì dịch thô là *"thanh toán"*).
- **Nút trạng thái thông minh dưới Status Bar**:
  - Hiển thị **`Smart Translate: On`** (Màu xanh) khi hoạt động.
  - Hiển thị **`Smart Translate: Off`** (Màu cam) khi chưa kích hoạt cổng debug. Click vào nút này để IDE tự động khởi động lại với tham số phù hợp.
- **Phím tắt bật/tắt nhanh**: Nhấn **`Option + T`** trong giao diện IDE để bật hoặc tắt tính năng dịch bất cứ lúc nào.

---

### Hướng dẫn cài đặt

1. **Tải về Extension**:
   - Tải tệp tin `smart-chat-hover-translate-x.x.x.vsix` mới nhất từ mục **Releases** của kho lưu trữ GitHub này.
2. **Cài đặt vào Antigravity IDE**:
   - Mở Antigravity IDE.
   - Vào mục quản lý **Extensions** (`Cmd + Shift + X`).
   - Nhấp vào biểu tượng ba chấm **`...`** ở góc trên bên phải thanh quản lý.
   - Chọn **Install from VSIX...**
   - Chọn tệp tin `.vsix` vừa tải về.
3. **Kích hoạt**:
   - Quan sát góc dưới bên phải màn hình. Nếu hiển thị **`Smart Translate: Off`**, hãy nhấp vào và chọn **Yes** để khởi động lại IDE.
   - Sau khi khởi động lại, trạng thái sẽ chuyển thành **`Smart Translate: On`** và tính năng dịch đã sẵn sàng!

---

## Development

If you want to build and package the extension yourself:

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the `.vsix` package:
   ```bash
   npx @vscode/vsce package
   ```

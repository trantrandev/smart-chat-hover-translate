# Smart Chat Hover Translate

Smart context-aware hover-translation extension for the Antigravity IDE chat / Agent Manager UI.

[Tiếng Việt bên dưới](#tiếng-việt)

---

## English

### Key Features
- **Hover Translation**: Hover over English text inside the Antigravity Chat or Agent Manager to view the translated meaning instantly in a small, clean tooltip.
- **Context-Aware Accuracy**: The extension uses bracket-wrapping (`[target]`) on full sentence/paragraph structures before sending to Google Translate, ensuring grammatically correct, context-specific translations.
- **Dynamic Status Bar Item**:
  - `Smart Translate: Active` when active.
  - Shows `Waiting`, then a restart countdown when the debug port is not enabled.
- **Zero-Click Setup on macOS and Windows**: Installing the VSIX automatically configures startup support. No launcher, script, or confirmation is required.
- **Platform-Specific Helpers**: macOS uses a LaunchAgent helper. Windows uses the current user's Startup folder plus a hidden PowerShell helper. No administrator permission is required.
- **Visible Automatic Restart Countdown**: Before enabling translation port `9333`, the extension warns that Antigravity will restart and shows a 10-second countdown. No button click is required.
- **Shortcut Toggle**: Press `Option + T` (macOS) inside the IDE to toggle the translation tool on/off at any time.

---

### Installation Instructions

1. **Download the Extension**:
   - Download the latest `smart-chat-hover-translate-x.x.x.vsix` file from the **Releases** section of this repository.
2. **Install in Antigravity IDE**:
   - Open Antigravity IDE.
   - Open the **Extensions** panel (`Cmd + Shift + X` on macOS, `Ctrl + Shift + X` on Windows).
   - Click the triple-dot menu (`...`) in the top-right of the Extensions panel.
   - Select **Install from VSIX...**
   - Choose the downloaded `.vsix` file.
3. **Activate**:
   - Nothing else is required.
   - If Antigravity does not activate the newly installed VSIX immediately, the setup runs automatically on the next normal launch.
   - If port `9333` is not active, a notification explains that Antigravity will restart automatically after 10 seconds.
   - The status bar shows the live countdown and Antigravity restarts automatically.
   - Open Antigravity normally from its original icon.
   - The status bar shows **`Smart Translate: Active`** when hover translation is ready.

Before uninstalling the VSIX, run **`Smart Translate: Remove Automatic Startup`** from the Command Palette.

Platform notes:

- macOS: the extension installs a LaunchAgent and copies `auto-relaunch-monitor.sh`.
- Windows: the extension adds a hidden launcher to the current user's Startup folder and copies `auto-relaunch-monitor.ps1` into `%APPDATA%\Smart Chat Hover Translate`. It does not require administrator permission.

---

## Tiếng Việt

Bộ tiện ích mở rộng dịch thuật thông minh theo ngữ cảnh khi di chuột (hover) dành cho giao diện chat/Agent Manager của Antigravity IDE.

### Tính năng nổi bật
- **Dịch khi di chuột**: Di chuột qua các cụm từ tiếng Anh trong khung Chat hoặc Agent Manager của Antigravity để xem nghĩa tiếng Việt ngay trên tooltip nhỏ gọn.
- **Dịch chuẩn theo ngữ cảnh**: Tự động bọc từ cần dịch trong ngữ cảnh câu gốc trước khi gửi đến công cụ dịch, đảm bảo kết quả chính xác theo ngữ cảnh lập trình (ví dụ: dịch đúng từ `checkout` trong ngữ cảnh Git là *"kiểm tra"* thay vì dịch thô là *"thanh toán"*).
- **Nút trạng thái thông minh dưới Status Bar**:
  - Hiển thị **`Smart Translate: Active`** khi hoạt động.
  - Hiển thị **`Waiting`**, sau đó đếm ngược khi cổng dịch chưa bật.
- **Tự thiết lập hoàn toàn trên macOS và Windows**: Cài VSIX xong là dùng; không cần launcher, chạy script hoặc bấm xác nhận.
- **Helper tách riêng theo hệ điều hành**: macOS dùng LaunchAgent. Windows dùng Startup folder của người dùng và PowerShell helper chạy ẩn, không cần quyền Admin.
- **Thông báo trước khi tự restart**: Trước khi bật cổng dịch `9333`, extension thông báo rõ và đếm ngược 10 giây. Người dùng không cần bấm gì.
- **Phím tắt bật/tắt nhanh**: Nhấn **`Option + T`** trong giao diện IDE để bật hoặc tắt tính năng dịch bất cứ lúc nào.

---

### Hướng dẫn cài đặt

1. **Tải về Extension**:
   - Tải tệp tin `smart-chat-hover-translate-x.x.x.vsix` mới nhất từ mục **Releases** của kho lưu trữ GitHub này.
2. **Cài đặt vào Antigravity IDE**:
   - Mở Antigravity IDE.
   - Vào mục quản lý **Extensions** (`Cmd + Shift + X` trên macOS, `Ctrl + Shift + X` trên Windows).
   - Nhấp vào biểu tượng ba chấm **`...`** ở góc trên bên phải thanh quản lý.
   - Chọn **Install from VSIX...**
   - Chọn tệp tin `.vsix` vừa tải về.
3. **Kích hoạt**:
   - Không cần làm thêm thao tác nào.
   - Nếu Antigravity chưa kích hoạt VSIX ngay trong phiên hiện tại, thiết lập sẽ tự chạy ở lần mở bình thường tiếp theo.
   - Nếu cổng `9333` chưa bật, extension thông báo Antigravity sẽ tự khởi động lại sau 10 giây.
   - Status bar hiển thị đếm ngược và Antigravity tự khởi động lại.
   - Mở Antigravity bằng icon gốc như bình thường.
   - Trạng thái **`Smart Translate: Active`** nghĩa là tính năng dịch đã sẵn sàng.

Trước khi gỡ VSIX, mở Command Palette và chạy **`Smart Translate: Remove Automatic Startup`** để gỡ helper hoàn toàn.

Ghi chú theo hệ điều hành:

- macOS: extension tự cài LaunchAgent và copy `auto-relaunch-monitor.sh`.
- Windows: extension tự thêm launcher chạy ẩn vào Startup folder của người dùng và copy `auto-relaunch-monitor.ps1` vào `%APPDATA%\Smart Chat Hover Translate`, không cần quyền Admin.

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

## Troubleshooting

### Windows: check restart log

```powershell
Get-Content "$env:TEMP\ag-envi-hover-fallback-relaunch.log" -Tail 20

```

### Windows: check translation port

```powershell
Invoke-WebRequest "http://127.0.0.1:9333/json/version" -UseBasicParsing
```

### Remove automatic startup helper

Before uninstalling the VSIX, run this command from Command Palette:

`Smart Translate: Remove Automatic Startup`

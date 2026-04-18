# 🚀 Auto Post Tool — Facebook Automation

Tool đăng bài tự động lên **Facebook Profile, Group và Fanpage**.

- **Backend:** Node.js, Express.js, MongoDB, BullMQ (Redis)
- **Frontend:** Next.js 14, Tailwind CSS
- **Automation:** Playwright (Group & Profile), Facebook Graph API (Page)

---

## 📋 Mục lục

1. [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
2. [Cài đặt](#-cài-đặt)
3. [Cấu hình môi trường](#-cấu-hình-môi-trường)
4. [Khởi chạy](#-khởi-chạy)
5. [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
   - [Bước 1: Lấy Cookies Facebook](#bước-1-lấy-cookies-facebook)
   - [Bước 2: Lấy Group ID](#bước-2-lấy-group-id)
   - [Bước 3: Tạo tài khoản](#bước-3-tạo-tài-khoản-trong-hệ-thống)
   - [Bước 4: Tạo bài viết](#bước-4-tạo-bài-viết-trên-dashboard)
6. [Cấu trúc dự án](#-cấu-trúc-dự-án)
7. [API Endpoints](#-api-endpoints)
8. [Hệ thống lập lịch](#-hệ-thống-lập-lịch--hàng-đợi)
9. [Lưu ý quan trọng](#-lưu-ý-quan-trọng)
10. [Xử lý lỗi thường gặp](#-xử-lý-lỗi-thường-gặp)

---

## 💻 Yêu cầu hệ thống

| Phần mềm | Phiên bản | Ghi chú |
|---|---|---|
| **Node.js** | >= 18.x | [Tải tại đây](https://nodejs.org/) |
| **MongoDB** | >= 6.x | Dùng [MongoDB Atlas](https://www.mongodb.com/atlas) (online) hoặc cài local |
| **Redis** | >= 5.x | Windows: [Tải tại đây](https://github.com/tporadowski/redis/releases) |
| **Google Chrome** | Mới nhất | Playwright cần Chromium |

---

## 📦 Cài đặt

### 1. Clone dự án

```bash
git clone <repo-url>
cd tool-auto-post
```

### 2. Cài đặt Backend

```bash
npm install
```

### 3. Cài đặt Playwright (trình duyệt tự động)

```bash
npx playwright install chromium
```

### 4. Cài đặt Frontend

```bash
cd client
npm install
cd ..
```

### 5. Cài đặt Redis (Windows)

1. Tải file `.msi` từ: https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.msi
2. Cài đặt → Tích chọn **"Add to PATH"** → Nhấn Install
3. Kiểm tra: mở CMD gõ `redis-cli ping` → nếu hiện `PONG` là thành công

---

## ⚙️ Cấu hình môi trường

Tạo file `.env` ở thư mục gốc (hoặc copy từ `.env.example`):

```env
# Server
PORT=5000

# MongoDB (thay bằng connection string của bạn)
MONGODB_URI=mongodb+srv://username:password@cluster.xxx.mongodb.net/auto-post-tool

# Mã hóa cookies & token (32 ký tự bất kỳ)
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Cloudinary — Lưu trữ ảnh (đăng ký tại https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

> 💡 **ENCRYPTION_KEY** phải đủ 32 ký tự. Dùng để mã hóa cookies và access_token trong database.

---

## 🚀 Khởi chạy

Bạn cần mở **3 terminal** cùng lúc:

### Terminal 1 — Redis

```bash
redis-cli ping
# Nếu hiện PONG thì Redis đã chạy sẵn (service tự khởi động)
# Nếu không, chạy: redis-server
```

### Terminal 2 — Backend (port 5000)

```bash
cd tool-auto-post
npm run dev
```

Khi thấy `🚀 Server is running on http://localhost:5000` là thành công.

### Terminal 3 — Frontend (port 3000)

```bash
cd tool-auto-post/client
npm run dev
```

Mở trình duyệt tại: **http://localhost:3000**

---

## 📖 Hướng dẫn sử dụng

### Bước 1: Lấy Cookies Facebook

Cookies là cách tool đăng nhập vào Facebook mà **không cần nhập mật khẩu**.

1. Cài extension [**EditThisCookie**](https://chromewebstore.google.com/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg) cho Chrome
2. Đăng nhập Facebook trên Chrome
3. Ở trang `facebook.com`, nhấn vào icon **EditThisCookie** (🍪) trên toolbar
4. Nhấn nút **Export** (icon xuất ra) → cookies sẽ được copy vào clipboard
5. Paste ra Notepad và giữ lại cho bước tiếp theo

> ⚠️ **Lưu ý:** Cookies có thời hạn. Nếu bạn đổi mật khẩu hoặc đăng xuất Facebook, cookies sẽ hết hạn và cần export lại.

### Bước 2: Lấy Group ID

1. Vào Group của bạn trên Facebook
2. Nhìn URL trên thanh địa chỉ:
   ```
   https://www.facebook.com/groups/123456789012345
                                    └──────────────────┘
                                     Đây là Group ID
   ```
3. Copy phần số sau `/groups/`

> Nếu URL dạng tên (`/groups/my-group-name`), vào **Giới thiệu nhóm** để tìm ID.

### Bước 3: Tạo tài khoản trong hệ thống

Sử dụng **Postman** hoặc **curl** để gửi request tạo account:

**URL:** `POST http://localhost:5000/api/accounts`

**Body (JSON):**

```json
{
  "name": "Tài khoản chính",
  "platform": "facebook",
  "account_type": "profile",
  "cookies": [
    // <-- PASTE toàn bộ JSON cookies từ EditThisCookie vào đây
  ]
}
```

**Ví dụ đầy đủ:**

```json
{
  "name": "Tài khoản chính",
  "platform": "facebook",
  "account_type": "profile",
  "cookies": [
    {
      "domain": ".facebook.com",
      "name": "c_user",
      "value": "100012345678901",
      "path": "/",
      "httpOnly": false,
      "secure": true,
      "sameSite": "no_restriction"
    },
    {
      "domain": ".facebook.com",
      "name": "xs",
      "value": "abc123...",
      "path": "/",
      "httpOnly": true,
      "secure": true,
      "sameSite": "no_restriction"
    }
  ]
}
```

> 💡 Nếu muốn dùng **Proxy** (fake IP), thêm field:
> ```json
> "proxy": "http://username:password@ip:port"
> ```

### Bước 4: Tạo bài viết trên Dashboard

1. Mở **http://localhost:3000**
2. Điền form:
   - **Nội dung bài viết:** Gõ nội dung muốn đăng
   - **Hình ảnh / Video:** Nhấn chọn ảnh (nếu cần)
   - **Tài khoản đăng:** Chọn tài khoản vừa tạo
   - **Đăng lên:** Chọn `Group`
   - **Group IDs:** Nhập 1 hoặc nhiều ID (cách nhau bằng **dấu cách** hoặc **xuống dòng**)
   - **Thời gian đăng:** Để trống = đăng ngay, hoặc chọn thời gian cụ thể
3. Nhấn **🚀 Tạo bài viết**

### Theo dõi kết quả

Sau khi tạo, bài viết hiện trong bảng **Danh sách bài viết**:

| Trạng thái | Ý nghĩa |
|---|---|
| 🟡 Đang chờ | Bài nằm trong hàng đợi, chờ đến giờ đăng |
| 🔵 Đang xử lý | Playwright/API đang đăng bài |
| 🟢 Thành công | Bài đã được đăng thành công |
| 🔴 Thất bại | Đăng lỗi (hover vào "ⓘ Xem lỗi" để xem chi tiết) |

> 🕐 Hệ thống quét bài viết **mỗi 1 phút**. Nếu bạn tạo bài và để trống thời gian, bài sẽ được xử lý trong vòng 1 phút.

---

## 🗂️ Cấu trúc dự án

```
tool-auto-post/
├── server.js                    # Entry point
├── .env                         # Biến môi trường
├── package.json
│
├── src/
│   ├── app.js                   # Express app setup
│   ├── config/
│   │   ├── index.js             # Config loader
│   │   ├── db.js                # MongoDB connection
│   │   └── cloudinary.js        # Cloudinary setup
│   ├── models/
│   │   ├── Account.js           # Tài khoản (cookies, proxy, token)
│   │   ├── Group.js             # Nhóm Facebook
│   │   └── Post.js              # Bài viết
│   ├── controllers/
│   │   ├── account.controller.js
│   │   ├── group.controller.js
│   │   ├── post.controller.js
│   │   └── upload.controller.js
│   ├── routes/
│   │   ├── account.routes.js
│   │   ├── group.routes.js
│   │   ├── post.routes.js
│   │   └── upload.routes.js
│   ├── services/
│   │   ├── facebook-api.service.js        # Graph API (đăng Page)
│   │   └── facebook-automation.service.js # Playwright (đăng Group/Profile)
│   ├── middlewares/
│   │   ├── errorHandler.js
│   │   └── upload.js            # Multer + Cloudinary
│   ├── queues/
│   │   ├── post.queue.js        # BullMQ Queue
│   │   └── post.worker.js       # Worker xử lý jobs
│   ├── schedulers/
│   │   └── post.scheduler.js    # Cron quét DB mỗi phút
│   └── utils/
│       └── encryption.js        # AES-256 encrypt/decrypt
│
└── client/                      # Next.js 14 Frontend
    ├── app/
    │   ├── layout.tsx           # Root layout
    │   ├── page.tsx             # Dashboard page
    │   └── globals.css
    ├── components/
    │   ├── CreatePostForm.jsx   # Form tạo bài viết
    │   ├── PostsTable.jsx       # Bảng danh sách bài
    │   └── ImagePreview.jsx     # Preview ảnh
    └── lib/
        └── api.js               # Fetch API helper
```

---

## 🔌 API Endpoints

### Accounts

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/accounts` | Lấy danh sách tài khoản |
| `POST` | `/api/accounts` | Tạo tài khoản mới |
| `GET` | `/api/accounts/:id` | Xem chi tiết tài khoản |
| `PUT` | `/api/accounts/:id` | Cập nhật tài khoản |
| `DELETE` | `/api/accounts/:id` | Xóa tài khoản |

### Posts

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/posts` | Lấy danh sách bài viết |
| `POST` | `/api/posts` | Tạo bài viết mới |
| `GET` | `/api/posts/:id` | Xem chi tiết bài viết |
| `PUT` | `/api/posts/:id` | Cập nhật bài viết |
| `DELETE` | `/api/posts/:id` | Xóa bài viết |

### Groups

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/groups` | Lấy danh sách nhóm |
| `POST` | `/api/groups` | Thêm nhóm mới |
| `DELETE` | `/api/groups/:id` | Xóa nhóm |

### Upload

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/upload` | Upload ảnh/video lên Cloudinary |

---

## ⏰ Hệ thống lập lịch & hàng đợi

```
┌──────────────┐     mỗi 1 phút    ┌────────────────┐
│  node-cron   │ ─────────────────► │  Quét MongoDB  │
│  (Scheduler) │                    │  pending posts │
└──────────────┘                    └───────┬────────┘
                                            │
                                  status → processing
                                            │
                                    ┌───────▼────────┐
                                    │    BullMQ       │
                                    │   Post Queue    │
                                    │    (Redis)      │
                                    └───────┬────────┘
                                            │
                                    ┌───────▼────────┐
                                    │    Worker       │
                                    └───────┬────────┘
                                            │
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                  target=page         target=group        target=profile
                        │                   │                   │
                  Graph API            Playwright           Playwright
                  (Nhanh)          (Mở trình duyệt)    (Mở trình duyệt)
```

### Cơ chế Retry

- Nếu đăng **thất bại**, hệ thống tự động **thử lại tối đa 3 lần**
- Mỗi lần cách nhau **15 phút**
- Sau 3 lần thất bại → đánh dấu `status: failed`

---

## ⚠️ Lưu ý quan trọng

### Bảo mật
- Cookies và access_token được **mã hóa AES-256** trước khi lưu vào database
- **Không chia sẻ** file `.env` hoặc cookies với bất kỳ ai
- Thêm `.env` vào `.gitignore`

### Anti-checkpoint (tránh bị Facebook khóa)
- Tool sử dụng **Random User-Agent** mỗi lần mở trình duyệt
- Gõ nội dung có **delay 20-100ms/ký tự** giống con người
- Có delay ngẫu nhiên giữa các bước
- Hỗ trợ **Proxy** để thay đổi IP
- Worker xử lý **1 job tại 1 thời điểm** (tránh đăng quá nhanh)

### Khuyến nghị
- **Không đăng quá nhiều bài** trong thời gian ngắn (dễ bị checkpoint)
- Sử dụng **Proxy** (đặc biệt khi đăng nhiều group)
- Nên test với **group riêng** của bạn trước
- Playwright chạy ở chế độ `headless: false` (mở trình duyệt thật) để dễ debug. Khi chạy production, có thể đổi thành `true`

---

## 🔧 Xử lý lỗi thường gặp

### ❌ `Redis connection refused`
Redis chưa chạy. Kiểm tra:
```bash
redis-cli ping
```

### ❌ `Cookies hết hạn hoặc bị checkpoint`
Cookies đã hết hạn. Cần:
1. Đăng nhập lại Facebook trên Chrome
2. Export cookies mới bằng EditThisCookie
3. Cập nhật lại account qua API: `PUT /api/accounts/:id`

### ❌ `Không tìm thấy ô "Viết gì đó..."`
- Bạn có thể chưa tham gia Group đó
- Facebook đã thay đổi UI → cần cập nhật selectors trong `facebook-automation.service.js`

### ❌ `ECONNRESET` khi cài đặt
Lỗi mạng. Thử lại với:
```bash
npm install --fetch-timeout=120000 --fetch-retries=5
```

### ❌ Ảnh không upload được
Kiểm tra cấu hình Cloudinary trong `.env` có đúng không. Truy cập https://console.cloudinary.com/settings để lấy thông tin.

---

## 📄 License

MIT

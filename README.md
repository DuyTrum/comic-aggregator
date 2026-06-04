# ⚡ ComicAggregator (ComAggref)
*Trình đọc truyện tranh đa nguồn dạng Desktop Hybrid sử dụng Angular, Spring Boot, PostgreSQL và NeutralinoJS.*

---

ComicAggregator là một ứng dụng Desktop Hybrid hiện đại, gom tất cả các nguồn truyện tranh lớn (như MangaDex, TruyenQQ, FoxTruyen) về một mối duy nhất. Ứng dụng loại bỏ 100% các loại quảng cáo độc hại từ nguồn gốc, hỗ trợ tải ảnh qua proxy cục bộ vượt chặn hotlink và tối ưu hóa bộ nhớ đệm hình ảnh trên ổ cứng nhằm mang lại trải nghiệm đọc truyện tuyệt vời nhất.

## 🚀 Tính năng nổi bật

### 📖 Trải nghiệm đọc truyện cao cấp
* **Đa nguồn truyện**: Tích hợp sẵn MangaDex (quốc tế), TruyenQQ (Việt Nam), và FoxTruyen (Việt Nam).
* **Lọc sạch quảng cáo**: Loại bỏ hoàn toàn pop-up, redirect, mã script quảng cáo gây đơ máy từ các nguồn gốc.
* **Đồng bộ thời gian thực**: Đăng ký tài khoản, lưu trữ danh mục truyện yêu thích (Thư viện) và ghi nhớ chương truyện/vị trí cuộn trang hiện tại (Lịch sử đọc) khi đọc.
* **Chế độ đọc linh hoạt**: Hỗ trợ cuộn dọc liên tục (Webtoon) hoặc lật trang (Manga).

### 🛡️ Cơ chế Scraping & Sandbox an toàn
* **Dynamic Scrapers (Extensions)**: Các nguồn truyện được thiết kế dưới dạng module kịch bản JS độc lập (`foxtruyen.js`, `truyenqq.js`).
* **Node.js VM Sandbox**: Các script cào được backend Spring Boot thực thi bên trong môi trường ảo cách ly (`node:vm`), chặn đứng các lệnh can thiệp hệ điều hành từ xa nhằm đảm bảo an toàn tuyệt đối cho hệ thống máy chủ.

### 💾 Giải pháp Proxy & Cache hình ảnh thông minh
* **Giả lập Referer**: Backend làm trung gian tải ảnh, tự động nạp HTTP Referer/User-Agent tương ứng để vượt bộ lọc chặn tải ảnh trực tiếp của nguồn truyện.
* **SHA-256 Caching**: Mã hóa URL ảnh thành tên file cục bộ để lưu đệm trên ổ cứng. Giảm tốc độ tải trang xuống **< 0.3s** ở những lần đọc kế tiếp.

### ⚙️ Bảng quản trị (Admin Panel) toàn diện
* **Quản lý tài khoản**: Danh sách thành viên, thăng/bãi chức vai trò hệ thống (`USER` / `ADMIN`), hoặc xóa tài khoản.
* **Trình sửa Code Scraper trực tiếp**: Xem và chỉnh sửa trực tiếp mã nguồn JavaScript cào dữ liệu của từng Extension. Hỗ trợ cơ chế biên dịch thử nghiệm báo lỗi cú pháp trước khi lưu đĩa để bảo vệ hệ thống.
* **Quản trị Bộ nhớ đệm (Cache)**: Thống kê tổng quan số lượng tệp ảnh đệm, tổng dung lượng MB sử dụng và nút dọn dẹp giải phóng bộ nhớ lập tức.

---

## 🛠️ Công nghệ sử dụng

* **Frontend**: Angular 17+ (Standalone Components, Signals, RxJS, CSS Variables).
* **Backend**: Spring Boot, Spring Security (JWT stateless authorization), Spring Data JPA, Hibernate.
* **Database**: PostgreSQL.
* **Desktop Wrapper**: NeutralinoJS (Engine Desktop siêu nhẹ, tiêu tốn < 50MB RAM).
* **Scraping Engine**: Node.js, Axios, Cheerio.

---

## 📁 Cấu trúc thư mục

```text
ComAggref/
├── backend/                  # Mã nguồn Spring Boot REST API
│   ├── extensions/           # Thư mục chứa các script cào JS nguồn truyện
│   ├── scraper/              # Node.js runner điều phối VM sandbox
│   └── src/                  # Mã nguồn Java (Controllers, Services, Models, Repos)
├── frontend/                 # Mã nguồn Angular 17+
│   └── src/app/              # Component giao diện, dịch vụ Angular
├── desktop/
│   └── comic-aggregator/     # Cấu hình NeutralinoJS Desktop Wrapper
├── build-desktop.bat         # Kịch bản tự động build & chạy app kèm backend ẩn
├── start-desktop.bat         # Kịch bản khởi động nhanh app (không build lại)
├── start.bat                 # Kịch bản chạy song song 2 server dev (port 4200 & 8080)
├── stop-all.bat              # Dọn dẹp nhanh các tiến trình chạy ẩn
└── README.md
```

---

## 💻 Hướng dẫn thiết lập & Chạy dự án

### 📋 Yêu cầu hệ thống
1. **Node.js** (v18+)
2. **Java JDK 17** trở lên.
3. **PostgreSQL** đang chạy trên máy cục bộ.

### Cấu hình Cơ sở dữ liệu
Mở tệp tin `backend/src/main/resources/application.properties` và cập nhật thông tin kết nối PostgreSQL của bạn:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/comic_aggregator
spring.datasource.username=postgres
spring.datasource.password=<mật_khẩu_của_bạn>
```

### Cách khởi chạy nhanh (Khuyên dùng)

* **Cách 1: Chạy song song máy chủ phát triển (Development Mode)**
  Click đúp file [start.bat](file:///d:/Angular/ComAggref/start.bat). File này sẽ mở 2 cửa sổ cmd chạy backend Spring Boot (cổng `8080`) và frontend Angular (cổng `4200`). Bạn truy cập qua trình duyệt tại địa chỉ `http://localhost:4200`.

* **Cách 2: Build và Đóng gói Desktop App (Desktop Mode)**
  Click đúp file [build-desktop.bat](file:///d:/Angular/ComAggref/build-desktop.bat). File này sẽ tự động biên dịch Angular, chép tài nguyên vào thư mục Neutralino, đóng gói jar Spring Boot, kích hoạt backend ẩn bằng `javaw` và mở giao diện ứng dụng Desktop lên trực tiếp.

* **Cách 3: Tắt toàn bộ tiến trình ẩn**
  Khi không dùng nữa, click đúp file [stop-all.bat](file:///d:/Angular/ComAggref/stop-all.bat) để dọn sạch các cổng kết nối và tiến trình Java/Desktop chạy ngầm.

---

## 🔑 Tài khoản Quản trị mặc định

Hệ thống tự động khởi tạo (seed) tài khoản quản trị mặc định trong lần đầu tiên chạy:
* **Tên tài khoản**: `admin`
* **Mật khẩu**: `admin123`
* **Vai trò**: `ADMIN`

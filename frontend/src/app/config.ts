import { isDevMode } from '@angular/core';

// Tự động sử dụng localhost ở môi trường phát triển (development)
// và sử dụng URL Koyeb/Render của bạn ở môi trường production.
// Bạn chỉ cần thay thế URL production dưới đây sau khi deploy xong backend.
export const API_BASE_URL = isDevMode()
  ? 'http://localhost:8080'
  : 'https://comic-aggregator.onrender.com/'; // Sẽ thay thế bằng link Koyeb/Render của bạn

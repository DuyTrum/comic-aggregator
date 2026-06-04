import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { ComicService } from '../../services/comic.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  activeTab: 'users' | 'extensions' | 'editor' | 'cache' = 'users';

  // Cache state
  cacheStats: { fileCount: number; sizeMb: number } | null = null;
  isLoadingCache = false;
  isClearingCache = false;
  cacheMessage = '';
  cacheError = '';
  
  // Users state
  users: any[] = [];
  isLoadingUsers = false;
  userMessage = '';
  userError = '';

  // Extensions state
  extensions: any[] = [];
  isLoadingExtensions = false;
  newExtensionUrl = '';
  isAddingExtension = false;
  extensionError = '';

  // Code Editor state
  selectedExtensionId = '';
  selectedExtensionCode = '';
  isSavingCode = false;
  editorMessage = '';
  editorError = '';

  constructor(
    private adminService: AdminService,
    private comicService: ComicService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Double check guard block
    if (!this.authService.isAuthenticated() || !this.authService.isAdmin()) {
      this.router.navigate(['/']);
      return;
    }
    this.fetchUsers();
    this.fetchExtensions();
  }

  switchTab(tab: 'users' | 'extensions' | 'editor' | 'cache') {
    this.activeTab = tab;
    this.resetMessages();
    if (tab === 'users') this.fetchUsers();
    if (tab === 'extensions') this.fetchExtensions();
    if (tab === 'cache') this.fetchCacheStats();
  }

  resetMessages() {
    this.userMessage = '';
    this.userError = '';
    this.extensionError = '';
    this.editorMessage = '';
    this.editorError = '';
    this.cacheMessage = '';
    this.cacheError = '';
  }

  // User Management
  fetchUsers() {
    this.isLoadingUsers = true;
    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.isLoadingUsers = false;
      },
      error: (err) => {
        this.userError = 'Không thể tải danh sách người dùng. ' + (err.error?.error || '');
        this.isLoadingUsers = false;
      }
    });
  }

  toggleUserRole(user: any) {
    const targetRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const actionText = targetRole === 'ADMIN' ? 'thăng chức thành ADMIN' : 'bãi nhiệm xuống USER';
    
    if (user.username === 'admin') {
      alert('Không thể bãi nhiệm tài khoản admin hệ thống mặc định!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn ${actionText} người dùng "${user.username}"?`)) {
      return;
    }

    this.resetMessages();
    this.adminService.updateUserRole(user.id, targetRole).subscribe({
      next: (updatedUser) => {
        user.role = updatedUser.role;
        this.userMessage = `Đã cập nhật vai trò của "${user.username}" thành ${user.role} thành công!`;
      },
      error: (err) => {
        this.userError = 'Cập nhật thất bại: ' + (err.error?.error || '');
      }
    });
  }

  deleteUser(user: any) {
    if (user.username === 'admin') {
      alert('Không thể xóa tài khoản admin hệ thống mặc định!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN người dùng "${user.username}"? Hành động này không thể hoàn tác.`)) {
      return;
    }

    this.resetMessages();
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.userMessage = `Đã xóa người dùng "${user.username}" khỏi hệ thống.`;
      },
      error: (err) => {
        this.userError = 'Xóa người dùng thất bại: ' + (err.error?.error || '');
      }
    });
  }

  // Extension Management
  fetchExtensions() {
    this.isLoadingExtensions = true;
    this.comicService.getExtensions().subscribe({
      next: (data) => {
        this.extensions = data;
        this.isLoadingExtensions = false;
        // Auto-select first extension if none is selected for editor
        if (this.extensions.length > 0 && !this.selectedExtensionId) {
          this.selectedExtensionId = this.extensions[0].id;
          this.onExtensionSelect();
        }
      },
      error: () => {
        this.isLoadingExtensions = false;
      }
    });
  }

  addExtension() {
    if (!this.newExtensionUrl.trim()) return;
    this.isAddingExtension = true;
    this.resetMessages();

    this.comicService.loadExtension(this.newExtensionUrl).subscribe({
      next: (newExt) => {
        this.isAddingExtension = false;
        this.newExtensionUrl = '';
        this.fetchExtensions();
        alert(`Tải thành công Extension: ${newExt.name} (v${newExt.version})`);
      },
      error: (err) => {
        this.isAddingExtension = false;
        this.extensionError = err.error?.error || 'Không thể tải extension từ URL này.';
      }
    });
  }

  deleteExtension(ext: any) {
    if (ext.name === 'MangaDex') {
      alert('Không thể xóa extension mặc định MangaDex!');
      return;
    }
    
    if (!confirm(`Bạn có chắc chắn muốn xóa Extension "${ext.name}"?`)) {
      return;
    }

    this.resetMessages();
    this.comicService.deleteExtension(ext.id).subscribe({
      next: () => {
        this.extensions = this.extensions.filter(e => e.id !== ext.id);
        if (this.selectedExtensionId === ext.id) {
          this.selectedExtensionId = this.extensions.length > 0 ? this.extensions[0].id : '';
          this.onExtensionSelect();
        }
        alert(`Đã xóa Extension: ${ext.name}`);
      },
      error: (err) => {
        alert(err.error?.error || 'Lỗi khi xóa extension.');
      }
    });
  }

  // Code Editor
  onExtensionSelect() {
    this.resetMessages();
    const ext = this.extensions.find(e => e.id === this.selectedExtensionId);
    if (ext) {
      this.selectedExtensionCode = ext.jsCode || '';
    } else {
      this.selectedExtensionCode = '';
    }
  }

  saveExtensionCode() {
    if (!this.selectedExtensionId) return;
    this.isSavingCode = true;
    this.resetMessages();

    this.adminService.updateExtensionCode(this.selectedExtensionId, this.selectedExtensionCode).subscribe({
      next: (updatedExt) => {
        this.isSavingCode = false;
        this.editorMessage = `Lưu code cho Extension "${updatedExt.name}" thành công!`;
        // Update local object code
        const extIndex = this.extensions.findIndex(e => e.id === updatedExt.id);
        if (extIndex > -1) {
          this.extensions[extIndex].jsCode = updatedExt.jsCode;
        }
      },
      error: (err) => {
        this.isSavingCode = false;
        this.editorError = err.error?.error || 'Lưu code thất bại. Vui lòng kiểm tra lại cú pháp JavaScript.';
      }
    });
  }

  // Cache management
  fetchCacheStats() {
    this.isLoadingCache = true;
    this.adminService.getCacheStats().subscribe({
      next: (data) => {
        this.cacheStats = data;
        this.isLoadingCache = false;
      },
      error: (err) => {
        this.cacheError = 'Không thể tải thông tin bộ nhớ đệm: ' + (err.error?.error || '');
        this.isLoadingCache = false;
      }
    });
  }

  clearCache() {
    if (!confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ cache hình ảnh? Trình duyệt sẽ phải tải lại ảnh từ server gốc ở lần đọc tiếp theo.')) {
      return;
    }
    
    this.isClearingCache = true;
    this.resetMessages();
    this.adminService.clearCache().subscribe({
      next: (data) => {
        this.isClearingCache = false;
        this.cacheMessage = `Thành công! Đã giải phóng ${data.sizeClearedMb} MB (${data.filesDeleted} file ảnh).`;
        this.fetchCacheStats();
      },
      error: (err) => {
        this.isClearingCache = false;
        this.cacheError = 'Xóa cache thất bại: ' + (err.error?.error || '');
      }
    });
  }
}

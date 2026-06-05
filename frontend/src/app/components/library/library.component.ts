import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComicService } from '../../services/comic.service';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.css']
})
export class LibraryComponent implements OnInit {
  bookmarks: any[] = [];
  isLoading = true;
  isRefreshing = false;

  constructor(private comicService: ComicService) {}

  ngOnInit() {
    this.fetchBookmarks();
  }

  fetchBookmarks() {
    this.isLoading = true;
    this.comicService.getBookmarkedComics().subscribe({
      next: (data) => {
        this.bookmarks = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  checkUpdates() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.comicService.checkLibraryUpdates().subscribe({
      next: (data) => {
        this.bookmarks = data;
        this.isRefreshing = false;
      },
      error: () => {
        this.isRefreshing = false;
      }
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Chưa kiểm tra';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Chưa kiểm tra';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Handle timezone difference if server returns UTC and local is GMT+7
    // Calculate difference in minutes
    let diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) {
      // If server time is ahead (due to clock drift), clamp to 0
      diffMins = 0;
    }
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

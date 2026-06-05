import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HistoryService, ReadingHistory } from '../../services/history.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {

  constructor(
    public historyService: HistoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.historyService.loadHistory();
  }

  continueReading(item: ReadingHistory): void {
    // Navigate to viewer with last read chapter
    this.router.navigate(['/read', item.comicId, item.lastChapterId]);
  }

  goToDetail(item: ReadingHistory): void {
    this.router.navigate(['/comic', item.comicId]);
  }

  deleteItem(item: ReadingHistory): void {
    if (confirm(`Xóa "${item.comicTitle}" khỏi lịch sử?`)) {
      const id = item.id || item.comicId;
      this.historyService.deleteHistory(id).subscribe(() => {
        this.loadHistory();
      });
    }
  }

  clearAll(): void {
    if (confirm('Xóa toàn bộ lịch sử đọc truyện?')) {
      this.historyService.clearHistory().subscribe(() => {
        this.loadHistory();
      });
    }
  }

  formatDate(date: Date): string {
    const now = new Date();
    const readDate = new Date(date);
    const diffMs = now.getTime() - readDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return readDate.toLocaleDateString('vi-VN');
  }
}

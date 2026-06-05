import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ComicService } from '../../services/comic.service';

export interface DownloadedComic {
  comicId: string;
  comicTitle: string;
  comicCover: string;
  source: string;
  chapters: {
    chapterId: string;
    chapterTitle: string;
    downloadedAt: Date;
  }[];
}

@Component({
  selector: 'app-downloads',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './downloads.component.html',
  styleUrls: ['./downloads.component.css']
})
export class DownloadsComponent implements OnInit {
  groupedDownloads: DownloadedComic[] = [];
  isLoading = false;

  constructor(
    private comicService: ComicService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDownloads();
  }

  loadDownloads(): void {
    this.isLoading = true;
    this.comicService.getDownloadedList().subscribe({
      next: (data) => {
        const groups = new Map<string, DownloadedComic>();
        data.forEach(item => {
          if (item.status !== 'COMPLETED') return; // Show only completed downloads

          if (!groups.has(item.comicId)) {
            groups.set(item.comicId, {
              comicId: item.comicId,
              comicTitle: item.comicTitle || 'Truyện không rõ tên',
              comicCover: item.comicCover || 'assets/default-cover.png',
              source: item.source,
              chapters: []
            });
          }
          groups.get(item.comicId)!.chapters.push({
            chapterId: item.chapterId,
            chapterTitle: item.chapterTitle,
            downloadedAt: new Date(item.downloadedAt)
          });
        });

        // Sort chapters chronologically within each comic
        groups.forEach(g => {
          g.chapters.sort((a, b) => {
            const numA = this.parseChapterNumber(a.chapterTitle);
            const numB = this.parseChapterNumber(b.chapterTitle);
            return numA - numB;
          });
        });

        this.groupedDownloads = Array.from(groups.values());
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load downloads', err);
        this.isLoading = false;
      }
    });
  }

  private parseChapterNumber(title: string): number {
    const match = title.match(/(?:chapter|chương|chap|\b)\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  readChapter(comicId: string, chapterId: string): void {
    this.router.navigate(['/read', comicId, chapterId]);
  }

  goToDetail(comicId: string): void {
    this.router.navigate(['/comic', comicId]);
  }

  deleteChapter(chapterId: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Bạn có chắc muốn xóa chương này khỏi máy tính không?')) {
      this.comicService.deleteDownloadedChapter(chapterId).subscribe(() => {
        this.loadDownloads();
      });
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

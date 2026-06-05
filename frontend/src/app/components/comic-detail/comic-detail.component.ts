import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ComicService, Comic, Chapter, ReadingProgress } from '../../services/comic.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-comic-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './comic-detail.component.html',
  styleUrls: ['./comic-detail.component.css']
})
export class ComicDetailComponent implements OnInit, OnDestroy {
  comic!: Comic;
  chapters: Chapter[] = [];
  isBookmarked = false;
  lastReadProgress: ReadingProgress | null = null;
  isLoading = true;
  downloadedChaptersMap = new Map<string, any>();
  private activePolls = new Map<string, any>();

  constructor(
    private route: ActivatedRoute,
    private comicService: ComicService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadComicData(id);
      }
    });
  }

  ngOnDestroy() {
    this.activePolls.forEach(interval => clearInterval(interval));
    this.activePolls.clear();
  }

  private parseChapterNumber(title: string): number {
    const match = title.match(/(?:chapter|chương|chap|\b)\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  loadComicData(id: string) {
    this.isLoading = true;
    
    // Load Comic detail
    this.comicService.getComicDetail(id).subscribe(comicData => {
      this.comic = comicData;

      // Load Chapters
      this.comicService.getChapters(id).subscribe(chaptersData => {
        // Sort chapters descending (newest first) for clean details view listing
        this.chapters = chaptersData.sort((a, b) => {
          const numA = this.parseChapterNumber(a.title);
          const numB = this.parseChapterNumber(b.title);
          return numB - numA;
        });

        // Load downloaded status
        this.comicService.getDownloadedChapters(id).subscribe({
          next: (downloads) => {
            downloads.forEach(d => {
              this.downloadedChaptersMap.set(d.chapterId, d);
              if (d.status === 'DOWNLOADING' || d.status === 'PENDING') {
                this.startPolling(d.chapterId);
              }
            });
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
          }
        });
      });

      // Load Bookmark status and reading history if authenticated
      if (this.authService.isAuthenticated()) {
        this.comicService.getBookmarkedComics().subscribe(bookmarks => {
          this.isBookmarked = bookmarks.some(b => b.comicIdOnSource === id);
        });

        this.comicService.getReadingHistory().subscribe(histories => {
          this.lastReadProgress = histories.find(h => h.comicId === id) || null;
        });
      } else {
        this.lastReadProgress = null;
      }
    });
  }

  toggleBookmark() {
    if (!this.authService.isAuthenticated()) {
      alert('Vui lòng đăng nhập để lưu vào thư viện!');
      return;
    }

    this.comicService.toggleBookmark(this.comic).subscribe(() => {
      this.isBookmarked = !this.isBookmarked;
    });
  }

  startPolling(chapterId: string) {
    if (this.activePolls.has(chapterId)) return;

    const interval = setInterval(() => {
      this.comicService.getDownloadStatus(chapterId).subscribe({
        next: (statusData) => {
          if (!statusData || statusData.status === 'NOT_DOWNLOADED') {
            this.downloadedChaptersMap.delete(chapterId);
            this.stopPolling(chapterId);
          } else {
            this.downloadedChaptersMap.set(chapterId, statusData);
            if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
              this.stopPolling(chapterId);
            }
          }
        },
        error: () => {
          this.stopPolling(chapterId);
        }
      });
    }, 2000);

    this.activePolls.set(chapterId, interval);
  }

  stopPolling(chapterId: string) {
    const interval = this.activePolls.get(chapterId);
    if (interval) {
      clearInterval(interval);
      this.activePolls.delete(chapterId);
    }
  }

  downloadChapter(chapter: Chapter, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (!this.comic) return;

    const payload = {
      comicId: this.comic.id,
      comicTitle: this.comic.title,
      comicCover: this.comic.coverUrl,
      source: this.comic.source,
      chapterId: chapter.id,
      chapterTitle: chapter.title
    };

    // Set initial local state to PENDING
    this.downloadedChaptersMap.set(chapter.id, {
      status: 'PENDING',
      downloadedPages: 0,
      totalPages: 0
    });

    this.comicService.downloadChapter(payload).subscribe({
      next: (res) => {
        this.downloadedChaptersMap.set(chapter.id, res);
        this.startPolling(chapter.id);
      },
      error: (err) => {
        console.error('Failed to trigger download', err);
        this.downloadedChaptersMap.delete(chapter.id);
      }
    });
  }

  deleteDownload(chapterId: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (confirm('Bạn có chắc chắn muốn xóa chương này khỏi máy tính không?')) {
      this.comicService.deleteDownloadedChapter(chapterId).subscribe({
        next: () => {
          this.downloadedChaptersMap.delete(chapterId);
          this.stopPolling(chapterId);
        },
        error: (err) => {
          console.error('Failed to delete downloaded chapter', err);
        }
      });
    }
  }

  getDownloadPercent(chapterId: string): number {
    const d = this.downloadedChaptersMap.get(chapterId);
    if (!d || !d.totalPages) return 0;
    return Math.round((d.downloadedPages / d.totalPages) * 100);
  }
}

import { Component, OnInit } from '@angular/core';
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
export class ComicDetailComponent implements OnInit {
  comic!: Comic;
  chapters: Chapter[] = [];
  isBookmarked = false;
  lastReadProgress: ReadingProgress | null = null;
  isLoading = true;

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
        this.isLoading = false;
      });

      // Load Bookmark status if authenticated
      if (this.authService.isAuthenticated()) {
        this.comicService.getBookmarkedComics().subscribe(bookmarks => {
          this.isBookmarked = bookmarks.some(b => b.comicIdOnSource === id);
        });

        // Load reading history
        this.comicService.getReadingHistory().subscribe(histories => {
          this.lastReadProgress = histories.find(h => h.comicId === id) || null;
        });
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
}

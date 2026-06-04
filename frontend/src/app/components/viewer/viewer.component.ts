import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { ComicService, Chapter, Comic } from '../../services/comic.service';
import { AuthService } from '../../services/auth.service';
import { HistoryService } from '../../services/history.service';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css']
})
export class ViewerComponent implements OnInit, OnDestroy {
  comicId = '';
  chapterId = '';
  comic: Comic | null = null;
  currentChapter: Chapter | null = null;
  chapters: Chapter[] = [];
  pages: string[] = [];
  
  // Settings & Modes
  mode: 'webtoon' | 'manga' = 'webtoon';
  brightness = 100;
  showSettings = false;
  
  // Manga pagination state
  currentMangaPageIndex = 0;

  isLoading = true;
  private scrollSubject = new Subject<number>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private comicService: ComicService,
    public authService: AuthService,
    private historyService: HistoryService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const cId = params.get('comicId');
      const chId = params.get('chapterId');
      if (cId && chId) {
        this.comicId = cId;
        this.chapterId = chId;
        this.loadChapter();
      }
    });

    // Setup debounce progress sync (Wait 1.5 seconds after scrolling stops)
    this.scrollSubject.pipe(
      debounceTime(1500),
      takeUntil(this.destroy$)
    ).subscribe(scrollPos => {
      this.syncProgress(scrollPos);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private parseChapterNumber(title: string): number {
    const match = title.match(/(?:chapter|chương|chap|\b)\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  loadChapter() {
    this.isLoading = true;
    this.currentMangaPageIndex = 0;

    this.comicService.getComicDetail(this.comicId).subscribe(comicData => {
      this.comic = comicData;

      this.comicService.getChapters(this.comicId).subscribe(chaptersData => {
        // Sort chapters chronologically (ascending) for correct prev/next navigation
        this.chapters = chaptersData.sort((a, b) => {
          const numA = this.parseChapterNumber(a.title);
          const numB = this.parseChapterNumber(b.title);
          return numA - numB;
        });
        
        this.currentChapter = this.chapters.find(c => c.id === this.chapterId) || null;

        this.comicService.getPages(this.comicId, this.chapterId).subscribe(pagesData => {
          this.pages = pagesData.map(url => this.comicService.getImageProxyUrl(url));
          this.isLoading = false;

          // Save to reading history
          this.saveToHistory();

          // Restore scroll position after view renders
          if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
              this.restoreScrollPosition();
            }, 300);
          }
        });
      });
    });
  }

  // Handle Scroll event in Webtoon mode
  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (this.mode !== 'webtoon' || !isPlatformBrowser(this.platformId)) return;
    
    const scrollPos = window.scrollY || document.documentElement.scrollTop;
    this.scrollSubject.next(Math.round(scrollPos));
  }

  // Restore previous scroll position from DB history
  restoreScrollPosition() {
    if (!this.authService.isAuthenticated()) return;

    this.comicService.getReadingHistory().subscribe(history => {
      const match = history.find(h => h.comicId === this.comicId && h.chapterId === this.chapterId);
      if (match && match.scrollPosition > 0) {
        if (this.mode === 'webtoon') {
          let attempts = 0;
          const targetScroll = match.scrollPosition;
          
          const scrollInterval = setInterval(() => {
            window.scrollTo({ top: targetScroll, behavior: 'instant' as any });
            attempts++;
            
            const currentScroll = window.scrollY || document.documentElement.scrollTop;
            if (Math.abs(currentScroll - targetScroll) < 5 || attempts > 15) {
              clearInterval(scrollInterval);
            }
          }, 200);
        } else if (this.mode === 'manga') {
          this.currentMangaPageIndex = match.scrollPosition;
        }
      }
    });
  }

  saveToHistory() {
    if (!this.comic || !this.currentChapter) return;

    this.historyService.addHistory({
      comicId: this.comicId,
      comicTitle: this.comic.title,
      comicCover: this.comic.coverUrl,
      source: this.comic.source,
      lastChapterId: this.chapterId,
      lastChapterTitle: this.currentChapter.title,
      lastReadAt: new Date(),
      currentPage: this.mode === 'webtoon' ? 0 : this.currentMangaPageIndex
    }).subscribe();
  }

  syncProgress(scrollPos: number) {
    if (!this.authService.isAuthenticated()) return;

    const currentChapter = this.chapters.find(c => c.id === this.chapterId);
    if (!currentChapter) return;
    if (!this.comic) return;

    this.comicService.updateReadingHistory({
      comicId: this.comicId,
      source: this.comic.source,
      chapterId: this.chapterId,
      chapterTitle: currentChapter.title,
      scrollPosition: scrollPos
    }).subscribe();
  }

  // Manga Pagination controls
  nextMangaPage() {
    if (this.currentMangaPageIndex < this.pages.length - 1) {
      this.currentMangaPageIndex++;
      // Sync progress for manga page (we can save page index as scrollPosition key)
      this.syncProgress(this.currentMangaPageIndex);
    } else {
      this.goToNextChapter();
    }
  }

  prevMangaPage() {
    if (this.currentMangaPageIndex > 0) {
      this.currentMangaPageIndex--;
      this.syncProgress(this.currentMangaPageIndex);
    } else {
      this.goToPrevChapter();
    }
  }

  // Navigation between chapters
  getCurrentChapterIndex(): number {
    return this.chapters.findIndex(c => c.id === this.chapterId);
  }

  goToPrevChapter() {
    const currentIndex = this.getCurrentChapterIndex();
    if (currentIndex > 0) {
      const prevCh = this.chapters[currentIndex - 1]; // Chương trước là index thấp hơn
      this.router.navigate(['/read', this.comicId, prevCh.id]);
    }
  }

  goToNextChapter() {
    const currentIndex = this.getCurrentChapterIndex();
    if (currentIndex < this.chapters.length - 1) {
      const nextCh = this.chapters[currentIndex + 1]; // Chương sau là index cao hơn
      this.router.navigate(['/read', this.comicId, nextCh.id]);
    }
  }
}

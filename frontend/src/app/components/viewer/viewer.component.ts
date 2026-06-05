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
  pages: { url: string; chapterId: string; chapterTitle: string }[] = [];
  
  // Settings & Modes
  mode: 'webtoon' | 'manga' = 'webtoon';
  brightness = 100;
  showSettings = false;
  theme: 'black' | 'dark' | 'sepia' | 'light' = 'black';
  webtoonWidth = 800;
  alignment: 'center' | 'left' = 'center';
  
  // Manga pagination state
  currentMangaPageIndex = 0;

  isLoading = true;
  isPreloading = false;
  preloadedChapterIds = new Set<string>();
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
    // Load saved customizations from localStorage
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('reader_theme');
      if (savedTheme) this.theme = savedTheme as any;

      const savedWidth = localStorage.getItem('reader_webtoon_width');
      if (savedWidth) this.webtoonWidth = parseInt(savedWidth, 10);

      const savedAlign = localStorage.getItem('reader_alignment');
      if (savedAlign) this.alignment = savedAlign as any;
    }

    this.route.paramMap.subscribe(params => {
      const cId = params.get('comicId');
      const chId = params.get('chapterId');
      if (cId && chId) {
        // Only load if the comic changed, or if the chapter is NOT in preloadedChapterIds
        if (this.comicId !== cId || (this.chapterId !== chId && !this.preloadedChapterIds.has(chId))) {
          this.comicId = cId;
          this.chapterId = chId;
          this.loadChapter();
        }
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

    // Check if chapter is downloaded
    this.comicService.getDownloadStatus(this.chapterId).subscribe({
      next: (downloadData) => {
        if (downloadData && downloadData.status === 'COMPLETED') {
          // OFFLINE MODE: Load metadata and pages from downloaded local database/files
          this.comic = {
            id: downloadData.comicId,
            title: downloadData.comicTitle,
            coverUrl: downloadData.comicCover,
            source: downloadData.source,
            description: '',
            author: '',
            status: '',
            tags: []
          };
          this.currentChapter = {
            id: downloadData.chapterId,
            title: downloadData.chapterTitle,
            comicId: downloadData.comicId,
            source: downloadData.source
          };

          // Query other downloaded chapters of this comic for navigation
          this.comicService.getDownloadedChapters(downloadData.comicId).subscribe(downloadedChapters => {
            this.chapters = downloadedChapters.map(d => ({
              id: d.chapterId,
              title: d.chapterTitle,
              comicId: d.comicId,
              source: d.source
            })).sort((a, b) => {
              const numA = this.parseChapterNumber(a.title);
              const numB = this.parseChapterNumber(b.title);
              return numA - numB;
            });
            
            // Map pages to offline download endpoints
            const pagesList: { url: string; chapterId: string; chapterTitle: string }[] = [];
            for (let i = 0; i < downloadData.totalPages; i++) {
              pagesList.push({
                url: `http://localhost:8080/api/download/image/${this.chapterId}/${i}`,
                chapterId: this.chapterId,
                chapterTitle: this.currentChapter?.title || ''
              });
            }
            this.pages = pagesList;
            this.preloadedChapterIds.clear();
            this.preloadedChapterIds.add(this.chapterId);
            this.isLoading = false;

            // Restore and Save reading history in correct order if authenticated
            if (this.authService.isAuthenticated()) {
              this.restoreAndSaveHistory();
            }
          });
        } else {
          // ONLINE MODE: Fetch from scraper service
          this.loadOnlineChapter();
        }
      },
      error: () => {
        // Fallback to online mode
        this.loadOnlineChapter();
      }
    });
  }

  loadOnlineChapter() {
    this.isLoading = true;
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
          this.pages = pagesData.map(url => ({
            url: this.comicService.getImageProxyUrl(url),
            chapterId: this.chapterId,
            chapterTitle: this.currentChapter?.title || ''
          }));
          this.preloadedChapterIds.clear();
          this.preloadedChapterIds.add(this.chapterId);
          this.isLoading = false;

          // Restore and Save reading history in correct order if authenticated
          if (this.authService.isAuthenticated()) {
            this.restoreAndSaveHistory();
          }
        });
      });
    });
  }

  setMode(newMode: 'webtoon' | 'manga') {
    if (this.mode === newMode) return;
    this.mode = newMode;
    if (newMode === 'manga') {
      // Map current chapter to corresponding page index
      this.currentMangaPageIndex = this.pages.findIndex(p => p.chapterId === this.chapterId);
      if (this.currentMangaPageIndex < 0) this.currentMangaPageIndex = 0;
    } else {
      // In webtoon mode, scroll to the active chapter's start
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          const firstPage = document.querySelector(`.page-wrapper[data-chapter-id="${this.chapterId}"]`);
          if (firstPage) {
            firstPage.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    }
  }

  setTheme(newTheme: 'black' | 'dark' | 'sepia' | 'light') {
    this.theme = newTheme;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('reader_theme', newTheme);
    }
  }

  setWebtoonWidth(newWidth: number) {
    this.webtoonWidth = newWidth;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('reader_webtoon_width', newWidth.toString());
    }
  }

  setAlignment(newAlign: 'center' | 'left') {
    this.alignment = newAlign;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('reader_alignment', newAlign);
    }
  }

  preloadNextChapter() {
    const currentIndex = this.getCurrentChapterIndex();
    if (currentIndex < 0 || currentIndex >= this.chapters.length - 1) return;

    const nextChapter = this.chapters[currentIndex + 1];
    if (this.preloadedChapterIds.has(nextChapter.id) || this.isPreloading) return;

    this.isPreloading = true;

    // Check offline status
    this.comicService.getDownloadStatus(nextChapter.id).subscribe({
      next: (downloadData) => {
        if (downloadData && downloadData.status === 'COMPLETED') {
          const pagesList: { url: string; chapterId: string; chapterTitle: string }[] = [];
          for (let i = 0; i < downloadData.totalPages; i++) {
            pagesList.push({
              url: `http://localhost:8080/api/download/image/${nextChapter.id}/${i}`,
              chapterId: nextChapter.id,
              chapterTitle: nextChapter.title
            });
          }
          this.pages = [...this.pages, ...pagesList];
          this.preloadedChapterIds.add(nextChapter.id);
          this.isPreloading = false;
        } else {
          this.preloadOnlineNextChapter(nextChapter);
        }
      },
      error: () => {
        this.preloadOnlineNextChapter(nextChapter);
      }
    });
  }

  preloadOnlineNextChapter(nextChapter: Chapter) {
    this.comicService.getPages(this.comicId, nextChapter.id).subscribe({
      next: (pagesData) => {
        const pagesList = pagesData.map(url => ({
          url: this.comicService.getImageProxyUrl(url),
          chapterId: nextChapter.id,
          chapterTitle: nextChapter.title
        }));
        this.pages = [...this.pages, ...pagesList];
        this.preloadedChapterIds.add(nextChapter.id);
        this.isPreloading = false;
      },
      error: (err) => {
        console.error('Failed to preload next chapter online', err);
        this.isPreloading = false;
      }
    });
  }

  // Handle Scroll event in Webtoon mode
  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (this.mode !== 'webtoon' || !isPlatformBrowser(this.platformId) || this.isLoading) return;
    
    const scrollPos = window.scrollY || document.documentElement.scrollTop;
    this.scrollSubject.next(Math.round(scrollPos));

    // 1. Check if near bottom to preload next chapter
    const totalHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    if (totalHeight - (scrollPos + viewportHeight) < 1500) {
      this.preloadNextChapter();
    }

    // 2. Determine which chapter is active based on visible page-wrappers
    const wrappers = document.querySelectorAll('.page-wrapper');
    let activeChapterId = '';
    let activeChapterTitle = '';
    
    const viewportMiddle = window.innerHeight / 2;
    for (let i = 0; i < wrappers.length; i++) {
      const rect = wrappers[i].getBoundingClientRect();
      if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
        activeChapterId = wrappers[i].getAttribute('data-chapter-id') || '';
        activeChapterTitle = wrappers[i].getAttribute('data-chapter-title') || '';
        break;
      }
    }

    if (activeChapterId && activeChapterId !== this.chapterId) {
      this.chapterId = activeChapterId;
      this.currentChapter = this.chapters.find(c => c.id === activeChapterId) || null;

      // Update Browser URL without reloading
      const newUrl = `/read/${this.comicId}/${activeChapterId}`;
      window.history.replaceState(null, '', newUrl);

      // Update document title
      if (this.comic) {
        document.title = `${this.comic.title} - ${activeChapterTitle}`;
      }

      // Save history & Sync progress for the new chapter (use relative scroll pos)
      if (this.authService.isAuthenticated()) {
        const firstPage = document.querySelector(`.page-wrapper[data-chapter-id="${activeChapterId}"]`);
        let relativeScrollPos = Math.round(scrollPos);
        if (firstPage) {
          const docScrollTop = window.scrollY || document.documentElement.scrollTop;
          const chapterOffsetTop = firstPage.getBoundingClientRect().top + docScrollTop;
          relativeScrollPos = Math.max(0, Math.round(scrollPos - chapterOffsetTop));
        }
        this.saveToHistory(relativeScrollPos);
      }
    }
  }

  // Restore previous scroll position and save initial history entry
  restoreAndSaveHistory() {
    this.comicService.getReadingHistory().subscribe({
      next: (historyList) => {
        const match = historyList.find(h => h.comicId === this.comicId);
        let savedScrollPosition = 0;

        // If the saved history matches this chapter, restore the scroll/page position
        if (match && match.chapterId === this.chapterId) {
          savedScrollPosition = match.scrollPosition || 0;
        }

        // Apply saved position to current page index (for manga mode)
        if (this.mode === 'manga') {
          this.currentMangaPageIndex = savedScrollPosition;
          
          // Trigger preload immediately if the restored page is near the end of current chapter
          setTimeout(() => {
            const currentChapterPages = this.pages.filter(p => p.chapterId === this.chapterId);
            if (this.currentMangaPageIndex >= currentChapterPages.length - 2) {
              this.preloadNextChapter();
            }
          }, 500);
        }

        // Save/update history with the correct scrollPosition
        this.saveToHistory(savedScrollPosition);

        // For webtoon mode, scroll the window to the target position after view renders
        if (this.mode === 'webtoon' && savedScrollPosition > 0 && isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            let attempts = 0;
            const targetScroll = savedScrollPosition;
            
            const scrollInterval = setInterval(() => {
              window.scrollTo({ top: targetScroll, behavior: 'instant' as any });
              attempts++;
              
              const currentScroll = window.scrollY || document.documentElement.scrollTop;
              if (Math.abs(currentScroll - targetScroll) < 5 || attempts > 15) {
                clearInterval(scrollInterval);
              }
            }, 200);
          }, 300);
        }
      },
      error: (err) => {
        console.error('Failed to load history for restoring position', err);
        this.saveToHistory(0);
      }
    });
  }

  saveToHistory(savedScrollPosition: number = 0) {
    if (!this.comic || !this.currentChapter) return;

    this.historyService.addHistory({
      comicId: this.comicId,
      comicTitle: this.comic.title,
      comicCover: this.comic.coverUrl,
      source: this.comic.source,
      lastChapterId: this.chapterId,
      lastChapterTitle: this.currentChapter.title,
      lastReadAt: new Date(),
      currentPage: savedScrollPosition
    }).subscribe();
  }

  syncProgress(scrollPos: number) {
    if (!this.authService.isAuthenticated()) return;

    const currentChapter = this.chapters.find(c => c.id === this.chapterId);
    if (!currentChapter) return;
    if (!this.comic) return;

    // Calculate relative scroll position to the current chapter's start
    let relativeScrollPos = scrollPos;
    if (this.mode === 'webtoon' && isPlatformBrowser(this.platformId)) {
      const firstPage = document.querySelector(`.page-wrapper[data-chapter-id="${this.chapterId}"]`);
      if (firstPage) {
        const docScrollTop = window.scrollY || document.documentElement.scrollTop;
        const chapterOffsetTop = firstPage.getBoundingClientRect().top + docScrollTop;
        relativeScrollPos = Math.max(0, scrollPos - chapterOffsetTop);
      }
    }

    this.comicService.updateReadingHistory({
      comicId: this.comicId,
      source: this.comic.source,
      chapterId: this.chapterId,
      chapterTitle: currentChapter.title,
      scrollPosition: relativeScrollPos
    }).subscribe();
  }

  // Get index of page relative to its chapter
  getRelativeMangaPageIndex(absoluteIndex: number): number {
    const activePage = this.pages[absoluteIndex];
    if (!activePage) return 0;
    
    const firstIndex = this.pages.findIndex(p => p.chapterId === activePage.chapterId);
    return firstIndex >= 0 ? (absoluteIndex - firstIndex) : 0;
  }

  // Manga Pagination controls
  nextMangaPage() {
    if (this.currentMangaPageIndex < this.pages.length - 1) {
      this.currentMangaPageIndex++;

      // Check if we crossed into a new chapter
      const activePage = this.pages[this.currentMangaPageIndex];
      if (activePage && activePage.chapterId !== this.chapterId) {
        this.chapterId = activePage.chapterId;
        this.currentChapter = this.chapters.find(c => c.id === this.chapterId) || null;
        
        // Update URL
        const newUrl = `/read/${this.comicId}/${this.chapterId}`;
        window.history.replaceState(null, '', newUrl);

        if (this.comic) {
          document.title = `${this.comic.title} - ${activePage.chapterTitle}`;
        }
      }

      // Check if we need to preload the next chapter
      const currentChapterPages = this.pages.filter(p => p.chapterId === this.chapterId);
      const activeRelativeIndex = this.getRelativeMangaPageIndex(this.currentMangaPageIndex);
      if (activeRelativeIndex >= currentChapterPages.length - 2) {
        this.preloadNextChapter();
      }

      // Sync progress for manga page (pass relative page index)
      const relativeIndex = this.getRelativeMangaPageIndex(this.currentMangaPageIndex);
      this.syncProgress(relativeIndex);
    } else {
      this.goToNextChapter();
    }
  }

  prevMangaPage() {
    if (this.currentMangaPageIndex > 0) {
      this.currentMangaPageIndex--;

      // Check if we crossed back into a previous chapter
      const activePage = this.pages[this.currentMangaPageIndex];
      if (activePage && activePage.chapterId !== this.chapterId) {
        this.chapterId = activePage.chapterId;
        this.currentChapter = this.chapters.find(c => c.id === this.chapterId) || null;
        
        // Update URL
        const newUrl = `/read/${this.comicId}/${this.chapterId}`;
        window.history.replaceState(null, '', newUrl);

        if (this.comic) {
          document.title = `${this.comic.title} - ${activePage.chapterTitle}`;
        }
      }

      const relativeIndex = this.getRelativeMangaPageIndex(this.currentMangaPageIndex);
      this.syncProgress(relativeIndex);
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

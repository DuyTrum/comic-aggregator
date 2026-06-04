import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

export interface ReadingHistory {
  id?: string;
  userId?: string;
  comicId: string;
  comicTitle: string;
  comicCover: string;
  source: string;
  lastChapterId: string;
  lastChapterTitle: string;
  lastReadAt: Date;
  currentPage?: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private apiUrl = 'http://localhost:8080/api/history';
  
  // Local history cache
  history = signal<ReadingHistory[]>([]);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.loadHistory();
  }

  /**
   * Get all reading history from server
   */
  loadHistory(): void {
    if (!this.authService.isAuthenticated()) {
      this.loadLocalHistory();
      return;
    }

    this.http.get<any[]>(this.apiUrl, {
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        const mappedData: ReadingHistory[] = data.map(item => ({
          id: item.id,
          userId: item.userId,
          comicId: item.comicId,
          comicTitle: item.comicTitle || 'Truyện không rõ tên',
          comicCover: item.comicCover || 'assets/default-cover.png',
          source: item.source,
          lastChapterId: item.chapterId || item.lastChapterId,
          lastChapterTitle: item.chapterTitle || item.lastChapterTitle,
          lastReadAt: item.updatedAt ? new Date(item.updatedAt) : new Date(item.lastReadAt || Date.now()),
          currentPage: item.scrollPosition !== undefined ? item.scrollPosition : item.currentPage
        }));
        this.history.set(mappedData);
        this.saveLocalHistory(mappedData);
      },
      error: () => {
        // Fallback to local storage if API fails
        this.loadLocalHistory();
      }
    });
  }

  /**
   * Add or update reading history
   */
  addHistory(item: ReadingHistory): Observable<any> {
    item.lastReadAt = new Date();
    
    if (!this.authService.isAuthenticated()) {
      this.addLocalHistory(item);
      return new Observable(observer => {
        observer.next(item);
        observer.complete();
      });
    }

    return this.http.post<any>(this.apiUrl, item, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => {
        this.loadHistory(); // Refresh list
      })
    );
  }

  /**
   * Delete history item
   */
  deleteHistory(historyId: string): Observable<any> {
    if (!this.authService.isAuthenticated()) {
      this.deleteLocalHistory(historyId);
      return new Observable(observer => {
        observer.next(true);
        observer.complete();
      });
    }

    return this.http.delete(`${this.apiUrl}/${historyId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => {
        this.loadHistory(); // Refresh list
      })
    );
  }

  /**
   * Clear all history
   */
  clearHistory(): Observable<any> {
    if (!this.authService.isAuthenticated()) {
      this.clearLocalHistory();
      return new Observable(observer => {
        observer.next(true);
        observer.complete();
      });
    }

    return this.http.delete(this.apiUrl, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => {
        this.history.set([]);
        localStorage.removeItem('readingHistory');
      })
    );
  }

  /**
   * Get history for specific comic
   */
  getComicHistory(comicId: string, source: string): ReadingHistory | undefined {
    return this.history().find(h => h.comicId === comicId && h.source === source);
  }

  // === Local Storage Methods (for offline/non-authenticated users) ===

  private loadLocalHistory(): void {
    const stored = localStorage.getItem('readingHistory');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.history.set(parsed);
      } catch (e) {
        console.error('Failed to parse local history', e);
        this.history.set([]);
      }
    }
  }

  private saveLocalHistory(data: ReadingHistory[]): void {
    localStorage.setItem('readingHistory', JSON.stringify(data));
  }

  private addLocalHistory(item: ReadingHistory): void {
    const current = this.history();
    const existingIndex = current.findIndex(
      h => h.comicId === item.comicId && h.source === item.source
    );

    let updated: ReadingHistory[];
    if (existingIndex >= 0) {
      // Update existing
      updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], ...item };
    } else {
      // Add new
      updated = [item, ...current];
    }

    // Keep only last 100 items
    if (updated.length > 100) {
      updated = updated.slice(0, 100);
    }

    this.history.set(updated);
    this.saveLocalHistory(updated);
  }

  private deleteLocalHistory(comicId: string): void {
    const updated = this.history().filter(h => 
      !(h.comicId === comicId || h.id === comicId)
    );
    this.history.set(updated);
    this.saveLocalHistory(updated);
  }

  private clearLocalHistory(): void {
    this.history.set([]);
    localStorage.removeItem('readingHistory');
  }
}

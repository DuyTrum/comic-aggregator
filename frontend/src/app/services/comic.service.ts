import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError } from 'rxjs';
import { AuthService } from './auth.service';

export interface Comic {
  id: string;
  title: string;
  source: string;
  coverUrl: string;
  description: string;
  author: string;
  status: string;
  tags: string[];
}

export interface Chapter {
  id: string;
  title: string;
  comicId: string;
  source: string;
  publishDate?: string;
}

export interface ReadingProgress {
  comicId: string;
  source: string;
  chapterId: string;
  chapterTitle: string;
  scrollPosition: number;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComicService {
  private proxyUrl = 'http://localhost:8080/api/proxy';
  private libraryUrl = 'http://localhost:8080/api/library';
  private historyUrl = 'http://localhost:8080/api/history';
  private downloadUrl = 'http://localhost:8080/api/download';

  // Premium mock data for immediate UI rendering & verification
  private mockComics: Comic[] = [
    {
      id: 'solo-leveling',
      title: 'Solo Leveling',
      source: 'MangaSource',
      coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80',
      description: 'Trong một thế giới nơi thợ săn phải chiến đấu với quái vật hung hãn để bảo vệ nhân loại, Sung Jin-Woo - thợ săn yếu nhất thế giới - đã có được một sức mạnh kỳ lạ tựa như hệ thống trò chơi.',
      author: 'Chugong',
      status: 'Đang tiến hành',
      tags: ['Action', 'Fantasy', 'System', 'Adventure']
    },
    {
      id: 'one-piece',
      title: 'One Piece',
      source: 'MangaSource',
      coverUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
      description: 'Hành trình của cậu bé Monkey D. Luffy cùng các đồng đội trong băng hải tặc Mũ Rơm đi tìm kiếm kho báu huyền thoại One Piece và trở thành Vua Hải Tặc.',
      author: 'Oda Eiichiro',
      status: 'Đang tiến hành',
      tags: ['Action', 'Comedy', 'Shounen', 'Adventure']
    },
    {
      id: 'demon-slayer',
      title: 'Kimetsu no Yaiba',
      source: 'MangaSource',
      coverUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80',
      description: 'Tanjiro Kamado, một cậu bé hiền lành, phải tham gia tổ chức Sát Quỷ Đội sau khi gia đình cậu bị quỷ tàn sát dã man, đồng thời em gái Nezuko bị biến thành quỷ.',
      author: 'Gotoge Koyoharu',
      status: 'Đã hoàn thành',
      tags: ['Action', 'Historical', 'Demons', 'Drama']
    }
  ];

  private mockChapters: { [key: string]: Chapter[] } = {
    'solo-leveling': [
      { id: 'ch-01', title: 'Chương 1: Sự trỗi dậy của kẻ yếu nhất', comicId: 'solo-leveling', source: 'MangaSource' },
      { id: 'ch-02', title: 'Chương 2: Ngôi đền kép bí ẩn', comicId: 'solo-leveling', source: 'MangaSource' },
      { id: 'ch-03', title: 'Chương 3: Lựa chọn sinh tử', comicId: 'solo-leveling', source: 'MangaSource' }
    ],
    'one-piece': [
      { id: 'ch-01', title: 'Chương 1: Bình minh phiêu lưu', comicId: 'one-piece', source: 'MangaSource' },
      { id: 'ch-02', title: 'Chương 2: Cậu bé mũ rơm Luffy', comicId: 'one-piece', source: 'MangaSource' }
    ],
    'demon-slayer': [
      { id: 'ch-01', title: 'Chương 1: Sự tàn khốc của số phận', comicId: 'demon-slayer', source: 'MangaSource' },
      { id: 'ch-02', title: 'Chương 2: Người thầy Urokodaki', comicId: 'demon-slayer', source: 'MangaSource' }
    ]
  };

  private mockPages: { [key: string]: string[] } = {
    'solo-leveling-ch-01': [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
      'https://images.unsplash.com/photo-1618005198143-e528346d9a99?w=800&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80'
    ],
    'solo-leveling-ch-02': [
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'
    ]
  };

  currentSource = signal<string>('MangaDex');

  constructor(private http: HttpClient, private authService: AuthService) {}

  getExtensions(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:8080/api/extensions').pipe(
      catchError(() => of([{ name: 'MangaDex', version: '1.0.0' }]))
    );
  }

  loadExtension(url: string): Observable<any> {
    return this.http.post('http://localhost:8080/api/extensions/load', { url }, { headers: this.authService.getAuthHeaders() });
  }

  deleteExtension(id: string): Observable<any> {
    return this.http.delete(`http://localhost:8080/api/extensions/${id}`, { headers: this.authService.getAuthHeaders() });
  }

  // Proxy wrapper for images to avoid CORS
  getImageProxyUrl(originalUrl: string): string {
    if (originalUrl.startsWith('http://localhost') || originalUrl.startsWith('data:')) {
      return originalUrl;
    }
    return `http://localhost:8080/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  }

  // Browse list of comics
  getComics(keyword?: string): Observable<Comic[]> {
    return this.http.post<Comic[]>(`${this.proxyUrl}/browse`, {
      source: this.currentSource(),
      query: keyword
    }).pipe(
      tap(comics => {
        comics.forEach(c => {
          if (!c.id.includes('::')) {
            c.id = `${c.source}::${c.id}`;
          }
          if (c.coverUrl) {
            c.coverUrl = this.getImageProxyUrl(c.coverUrl);
          }
        });
      }),
      catchError(() => {
        const mock = keyword
          ? this.mockComics.filter(c => c.title.toLowerCase().includes(keyword.toLowerCase()))
          : this.mockComics;
        const copy = mock.map(c => ({ ...c }));
        copy.forEach(c => {
          if (!c.id.includes('::')) c.id = `${c.source}::${c.id}`;
        });
        return of(copy);
      })
    );
  }

  // Get detailed information of a comic
  getComicDetail(id: string): Observable<Comic> {
    const parts = id.split('::');
    const sourceName = parts.length > 1 ? parts[0] : this.currentSource();
    const realComicId = parts.length > 1 ? parts[1] : id;

    return this.http.post<Comic>(`${this.proxyUrl}/detail`, {
      source: sourceName,
      comicId: realComicId
    }).pipe(
      tap(comic => {
        if (!comic.id.includes('::')) {
          comic.id = `${comic.source}::${comic.id}`;
        }
        if (comic.coverUrl) {
          comic.coverUrl = this.getImageProxyUrl(comic.coverUrl);
        }
      }),
      catchError(() => {
        const comic = this.mockComics.find(c => c.id === realComicId) || this.mockComics[0];
        const copy = { ...comic };
        if (!copy.id.includes('::')) copy.id = `${copy.source}::${copy.id}`;
        return of(copy);
      })
    );
  }

  // Get chapters lists
  getChapters(comicId: string): Observable<Chapter[]> {
    const parts = comicId.split('::');
    const sourceName = parts.length > 1 ? parts[0] : this.currentSource();
    const realComicId = parts.length > 1 ? parts[1] : comicId;

    return this.http.post<Chapter[]>(`${this.proxyUrl}/chapters`, {
      source: sourceName,
      comicId: realComicId
    }).pipe(
      tap(chapters => {
        chapters.forEach(ch => {
          if (!ch.comicId.includes('::')) {
            ch.comicId = `${ch.source}::${ch.comicId}`;
          }
        });
      }),
      catchError(() => {
        const list = this.mockChapters[realComicId] || [];
        const copy = list.map(ch => ({
          ...ch,
          comicId: ch.comicId.includes('::') ? ch.comicId : `${ch.source}::${ch.comicId}`
        }));
        return of(copy);
      })
    );
  }

  // Get list of page URLs for a specific chapter
  getPages(comicId: string, chapterId: string): Observable<string[]> {
    const parts = comicId.split('::');
    const sourceName = parts.length > 1 ? parts[0] : this.currentSource();
    const realComicId = parts.length > 1 ? parts[1] : comicId;

    return this.http.post<string[]>(`${this.proxyUrl}/pages`, {
      source: sourceName,
      comicId: realComicId,
      chapterId: chapterId
    }).pipe(
      catchError(() => {
        const key = `${realComicId}-${chapterId}`;
        const pages = this.mockPages[key] || [
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
          'https://images.unsplash.com/photo-1618005198143-e528346d9a99?w=800&q=80'
        ];
        return of(pages);
      })
    );
  }

  // --- LIBRARY & HISTORY API CONNECTION (Requires JWT) ---

  getBookmarkedComics(): Observable<any[]> {
    if (!this.authService.isAuthenticated()) return of([]);
    return this.http.get<any[]>(this.libraryUrl, { headers: this.authService.getAuthHeaders() }).pipe(
      tap(bookmarks => {
        bookmarks.forEach(b => {
          if (b.coverUrl) {
            b.coverUrl = this.getImageProxyUrl(b.coverUrl);
          }
        });
      }),
      catchError((err) => {
        if (err && (err.status === 401 || err.status === 403)) {
          this.authService.logout();
        }
        const local = localStorage.getItem('local_bookmarks');
        const list = local ? JSON.parse(local) : [];
        list.forEach((b: any) => {
          if (b.coverUrl) {
            b.coverUrl = this.getImageProxyUrl(b.coverUrl);
          }
        });
        return of(list);
      })
    );
  }

  toggleBookmark(comic: Comic): Observable<any> {
    if (!this.authService.isAuthenticated()) return of(null);
    return this.http.post(this.libraryUrl, {
      comicIdOnSource: comic.id,
      sourceName: comic.source,
      comicTitle: comic.title,
      coverUrl: comic.coverUrl
    }, { headers: this.authService.getAuthHeaders() }).pipe(
      catchError(() => {
        const local = localStorage.getItem('local_bookmarks');
        let list: any[] = local ? JSON.parse(local) : [];
        const index = list.findIndex(b => b.comicIdOnSource === comic.id);
        if (index > -1) {
          list.splice(index, 1);
        } else {
          list.push({
            comicIdOnSource: comic.id,
            sourceName: comic.source,
            comicTitle: comic.title,
            coverUrl: comic.coverUrl
          });
        }
        localStorage.setItem('local_bookmarks', JSON.stringify(list));
        return of({ success: true });
      })
    );
  }

  getReadingHistory(): Observable<ReadingProgress[]> {
    if (!this.authService.isAuthenticated()) {
      return of([]);
    }
    return this.http.get<ReadingProgress[]>(this.historyUrl, { headers: this.authService.getAuthHeaders() }).pipe(
      catchError((err) => {
        if (err && (err.status === 401 || err.status === 403)) {
          this.authService.logout();
        }
        const local = localStorage.getItem('local_history');
        return of(local ? JSON.parse(local) : []);
      })
    );
  }

  updateReadingHistory(progress: ReadingProgress): Observable<any> {
    if (!this.authService.isAuthenticated()) {
      return of(null);
    }
    return this.http.post(this.historyUrl, progress, { headers: this.authService.getAuthHeaders() }).pipe(
      catchError(() => {
        const local = localStorage.getItem('local_history');
        let list: ReadingProgress[] = local ? JSON.parse(local) : [];
        const index = list.findIndex(h => h.comicId === progress.comicId);
        if (index > -1) {
          list[index] = progress;
        } else {
          list.push(progress);
        }
        localStorage.setItem('local_history', JSON.stringify(list));
        return of({ success: true });
      })
    );
  }

  downloadChapter(progress: any): Observable<any> {
    return this.http.post(`${this.downloadUrl}/chapter`, progress);
  }

  getDownloadStatus(chapterId: string): Observable<any> {
    return this.http.get(`${this.downloadUrl}/status/${chapterId}`);
  }

  getDownloadedChapters(comicId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.downloadUrl}/comic/${encodeURIComponent(comicId)}`);
  }

  getDownloadedList(): Observable<any[]> {
    return this.http.get<any[]>(`${this.downloadUrl}/list`);
  }

  deleteDownloadedChapter(chapterId: string): Observable<any> {
    return this.http.delete(`${this.downloadUrl}/${chapterId}`);
  }
}

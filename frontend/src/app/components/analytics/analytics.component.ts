import { Component, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HistoryService, ReadingHistory } from '../../services/history.service';
import { ComicService } from '../../services/comic.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnInit {
  totalBookmarks = 0;
  isLoading = true;

  constructor(
    public historyService: HistoryService,
    private comicService: ComicService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.historyService.loadHistory();
    this.fetchBookmarks();
  }

  fetchBookmarks() {
    this.comicService.getBookmarkedComics().subscribe({
      next: (data) => {
        this.totalBookmarks = data.length;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // Statistics Computations
  totalUniqueComics = computed(() => this.historyService.history().length);

  // Top Genres computation
  topGenres = computed(() => {
    const history = this.historyService.history();
    const genreCounts: { [key: string]: number } = {};
    
    history.forEach(item => {
      if (item.tags) {
        const tags = item.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        tags.forEach(tag => {
          genreCounts[tag] = (genreCounts[tag] || 0) + 1;
        });
      }
    });

    const totalComics = history.length;
    const sorted = Object.keys(genreCounts).map(genre => ({
      name: genre,
      count: genreCounts[genre],
      percentage: totalComics > 0 ? Math.round((genreCounts[genre] / totalComics) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    return sorted.slice(0, 5); // top 5
  });

  // Source Distribution computation
  sourceStats = computed(() => {
    const history = this.historyService.history();
    const counts: { [key: string]: number } = {};
    history.forEach(item => {
      counts[item.source] = (counts[item.source] || 0) + 1;
    });
    return Object.keys(counts).map(source => ({
      name: source,
      count: counts[source],
      percentage: history.length > 0 ? Math.round((counts[source] / history.length) * 100) : 0
    }));
  });

  // Recent 3 reads
  recentReads = computed(() => {
    return this.historyService.history().slice(0, 3);
  });
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ComicService, Comic } from '../../services/comic.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  comics: Comic[] = [];
  searchQuery = '';
  isLoading = false;

  // Extension management properties
  extensions: any[] = [];
  selectedSource = 'MangaDex';
  newExtensionUrl = '';
  isAddingExtension = false;
  extensionError = '';
  showExtensionPanel = false;

  // Filter panel properties
  showFilterPanel = false;
  selectedStatus = '';
  selectedSort = 'latest';
  selectedGenres: string[] = [];
  popularGenres = ['Action', 'Fantasy', 'Comedy', 'Adventure', 'Romance', 'Drama', 'Historical', 'Demons'];

  constructor(private comicService: ComicService) {}

  ngOnInit() {
    this.selectedSource = this.comicService.currentSource();
    this.fetchExtensions();
    this.fetchComics();
  }

  fetchExtensions() {
    this.comicService.getExtensions().subscribe(exts => {
      this.extensions = exts;
      // If the selected source is not in the list, fallback to MangaSource
      if (this.extensions.length > 0 && !this.extensions.some(e => e.name === this.selectedSource)) {
        this.selectedSource = this.extensions[0].name;
        this.comicService.currentSource.set(this.selectedSource);
      }
    });
  }

  fetchComics() {
    this.isLoading = true;
    const filters = {
      status: this.selectedStatus || undefined,
      genres: this.selectedGenres.length > 0 ? this.selectedGenres : undefined,
      sortBy: this.selectedSort
    };
    this.comicService.getComics(this.searchQuery, filters).subscribe({
      next: (data) => {
        this.comics = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.fetchComics();
  }

  onSourceChangeNgModel() {
    this.comicService.currentSource.set(this.selectedSource);
    // Reset filters when switching sources to avoid incorrect querying
    this.selectedStatus = '';
    this.selectedGenres = [];
    this.selectedSort = 'latest';
    this.fetchComics();
  }

  toggleFilterPanel() {
    this.showFilterPanel = !this.showFilterPanel;
  }

  toggleGenre(genre: string) {
    const index = this.selectedGenres.indexOf(genre);
    if (index > -1) {
      this.selectedGenres.splice(index, 1);
    } else {
      this.selectedGenres.push(genre);
    }
    this.fetchComics();
  }

  isGenreSelected(genre: string): boolean {
    return this.selectedGenres.includes(genre);
  }

  clearFilters() {
    this.selectedStatus = '';
    this.selectedSort = 'latest';
    this.selectedGenres = [];
    this.fetchComics();
  }

  toggleExtensionPanel() {
    this.showExtensionPanel = !this.showExtensionPanel;
  }

  addExtension() {
    if (!this.newExtensionUrl.trim()) return;
    this.isAddingExtension = true;
    this.extensionError = '';

    this.comicService.loadExtension(this.newExtensionUrl).subscribe({
      next: (newExt) => {
        this.isAddingExtension = false;
        this.newExtensionUrl = '';
        this.selectedSource = newExt.name;
        this.comicService.currentSource.set(newExt.name);
        alert(`Tải thành công Extension: ${newExt.name} (v${newExt.version})`);
        this.fetchExtensions();
        this.fetchComics();
      },
      error: (err) => {
        this.isAddingExtension = false;
        this.extensionError = err.error?.error || 'Không thể tải extension từ URL này.';
      }
    });
  }

  deleteExtension(ext: any) {
    if (ext.name === 'MangaDex') {
      alert('Không thể xóa extension mặc định MangaDex!');
      return;
    }
    
    if (!confirm(`Bạn có chắc chắn muốn xóa Extension ${ext.name}?`)) {
      return;
    }

    this.comicService.deleteExtension(ext.id).subscribe({
      next: () => {
        alert(`Đã xóa Extension: ${ext.name}`);
        this.fetchExtensions();
        if (this.selectedSource === ext.name) {
          this.selectedSource = 'MangaDex';
          this.comicService.currentSource.set('MangaDex');
          this.fetchComics();
        }
      },
      error: (err) => {
        alert(err.error?.error || 'Lỗi khi xóa extension.');
      }
    });
  }
}

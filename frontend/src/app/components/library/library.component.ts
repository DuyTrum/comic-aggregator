import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComicService } from '../../services/comic.service';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.css']
})
export class LibraryComponent implements OnInit {
  bookmarks: any[] = [];
  isLoading = true;

  constructor(private comicService: ComicService) {}

  ngOnInit() {
    this.fetchBookmarks();
  }

  fetchBookmarks() {
    this.isLoading = true;
    this.comicService.getBookmarkedComics().subscribe({
      next: (data) => {
        this.bookmarks = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
}

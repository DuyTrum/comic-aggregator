import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ComicService } from '../../services/comic.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public comicService: ComicService,
    private router: Router
  ) {}

  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      this.comicService.getBookmarkedComics().subscribe();
    }
  }

  isReaderPage(): boolean {
    return this.router.url.startsWith('/read/');
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}

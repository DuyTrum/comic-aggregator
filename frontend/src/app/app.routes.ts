import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ComicDetailComponent } from './components/comic-detail/comic-detail.component';
import { ViewerComponent } from './components/viewer/viewer.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { LibraryComponent } from './components/library/library.component';
import { HistoryComponent } from './components/history/history.component';
import { AdminComponent } from './components/admin/admin.component';
import { DownloadsComponent } from './components/downloads/downloads.component';

const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }
  router.navigate(['/']);
  return false;
};

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'comic/:id', component: ComicDetailComponent },
  { path: 'read/:comicId/:chapterId', component: ViewerComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'library', component: LibraryComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'downloads', component: DownloadsComponent },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];

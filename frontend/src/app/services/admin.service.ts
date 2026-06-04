import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private adminUrl = 'http://localhost:8080/api/admin';
  private extensionUrl = 'http://localhost:8080/api/extensions';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.adminUrl}/users`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateUserRole(userId: string, role: string): Observable<any> {
    return this.http.put<any>(
      `${this.adminUrl}/users/${userId}/role`,
      { role },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.adminUrl}/users/${userId}`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  updateExtensionCode(id: string, jsCode: string): Observable<any> {
    return this.http.put<any>(
      `${this.extensionUrl}/${id}`,
      { jsCode },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  getCacheStats(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/cache/stats`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  clearCache(): Observable<any> {
    return this.http.post<any>(`${this.adminUrl}/cache/clear`, {}, {
      headers: this.authService.getAuthHeaders()
    });
  }
}

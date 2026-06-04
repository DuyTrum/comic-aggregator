import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['../login/login.component.css'] // Share login css since layout is identical!
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  errorMsg = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    if (!this.username || !this.email || !this.password) return;
    this.isLoading = true;
    this.errorMsg = '';

    this.authService.register(this.username, this.email, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        alert('Đăng ký thành công! Vui lòng đăng nhập lại.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error || 'Đăng ký thất bại. Tên đăng nhập hoặc Email có thể đã được sử dụng.';
      }
    });
  }
}

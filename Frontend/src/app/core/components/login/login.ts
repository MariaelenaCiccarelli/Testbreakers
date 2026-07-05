import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth/auth-service';
import { AuthResponse } from '../../models/auth.model';
import { RestBackendService } from '../../services/rest-backend/rest-backend-service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  toastr = inject(ToastrService);
  router = inject(Router);
  restService = inject(RestBackendService);
  authService = inject(AuthService);
  submitted = false;
  loginForm = new FormGroup({
    handle: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required])
  })

  
  goToSignup(){ this.router.navigate(['/signup']); }

  handleLogin() {
    this.submitted = true;
    if(this.loginForm.invalid){
      this.toastr.error("The data you provided is invalid!", "Oops! Invalid data!");
    }else{
      this.restService.login({
        handle: this.loginForm.value.handle as string,
        password: this.loginForm.value.password as string,
      }).subscribe({
        next: (response: AuthResponse) => {
          this.authService.updateToken(response.token); //Passo solo la stringa .token
        },
        error: (err) => {
          this.toastr.error("Please, insert a valid handle and password", "Oops! Invalid credentials");
        },
        complete: () => {
          this.toastr.success(`Welcome ${this.loginForm.value.handle}!`);
          this.router.navigateByUrl("/");
        }
      })
    }
  }


}

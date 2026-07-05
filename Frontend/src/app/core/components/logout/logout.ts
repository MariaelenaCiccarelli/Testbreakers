import { Component, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth/auth-service';

@Component({
  selector: 'app-logout',
  imports: [],
  templateUrl: './logout.html',
  styleUrl: './logout.css',
})
export class Logout {

  authService = inject(AuthService);
  toastr = inject(ToastrService);
  router = inject(Router);

  ngOnInit() {
    if(! this.authService.isAuthenticated()){
      this.toastr.warning("You are not currently logged in!");
      this.router.navigateByUrl("/"); //go to homepage
    } else {
      this.toastr.warning(`Come back soon, ${this.authService.handle()}!`, "You have been logged out");
      this.authService.logout();
      this.router.navigateByUrl("/"); //go to homepage
    }
  }

}

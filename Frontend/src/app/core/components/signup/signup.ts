import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { RestBackendService } from '../../services/rest-backend/rest-backend-service';
import { SignupRequest, SignupResponse } from '../../models/signup.model';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  private restService = inject(RestBackendService);
  private toastr = inject(ToastrService);
  private router = inject(Router);

  submitted = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  
  // Memorizza l'avatar selezionato (es: 'avatar-01-blue.png')
  selectedAvatar = signal<string>(''); 

  // Tab di colore attiva per i filtri (inizialmente impostata su 'black')
  activeColorTab = signal<string>('black');

  // Signal dinamico che conterrà la lista ricevuta dal backend
  avatarPool = signal<any[]>([]);

  // Form di Registrazione react-driven
  signupForm = new FormGroup({
    handle: new FormControl('', [Validators.required, Validators.minLength(3)]),
    password: new FormControl('', [Validators.required, Validators.minLength(4)])
  });

  ngOnInit() {
    this.loadServerAvatars();
  }

  // Carica gli avatar dinamicamente interrogando la cartella del backend
  loadServerAvatars() {
    this.restService.getAvailableAvatars().subscribe({
      next: (res: any) => {
        if (res && res.avatars) {
          // Ora l'assegnazione passerà liscia come l'olio senza errori di compilazione!
          this.avatarPool.set(res.avatars);
        }
      },
      error: (err) => {
        this.toastr.error("Unable to load avatar pool from server.", "Error");
      }
    });
  }

  // Getter calcolato che filtra istantaneamente gli avatar in base alla tab di colore cliccata
  get filteredAvatars() {
    return this.avatarPool().filter(av => av.color === this.activeColorTab());
  }

  selectAvatar(fileName: string) {
    this.selectedAvatar.set(fileName);
  }

  setColorTab(color: string) {
    this.activeColorTab.set(color);
  }

  onSubmit() {
    this.submitted.set(true);

    if (this.signupForm.invalid) {
      this.toastr.warning('Please fill in all required fields.', 'Validation.');
      return;
    }

    if (!this.selectedAvatar()) {
      this.toastr.warning('Choose an Avatar.', 'Missing Avatar.');
      return;
    }

    this.isLoading.set(true);

    // Costruiamo l'oggetto rispettando fedelmente l'interfaccia SignupRequest
    const signupData: SignupRequest = {
      handle: this.signupForm.value.handle || '',
      password: this.signupForm.value.password || '',
      avatar: this.selectedAvatar()
    };

    this.restService.signup(signupData).subscribe({
      next: (res: SignupResponse) => {
        this.toastr.success('Registration complete! Enter your credentials to start a Match.', 'Congratulations!');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMessage = err.error?.error || 'Unable to complete registration.';
        this.toastr.error(errorMessage, 'Errore');
      }
    });
  }

}

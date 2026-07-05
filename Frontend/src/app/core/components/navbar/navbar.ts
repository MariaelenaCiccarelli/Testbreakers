import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth/auth-service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  private authService = inject(AuthService);

  isOpen = false

  toggle() {
    this.isOpen = !this.isOpen;
  }

  // Reattività nativa basata sullo stato globale dell'applicazione
  isLoggedIn = computed(() => this.authService.isAuthenticated());
  userHandle = computed(() => this.authService.handle());

  // Signal locale per memorizzare il nome del file dell'avatar estratto dal token
  userAvatar = computed(() => this.authService.avatar() || 'default-avatar.png');

  // Getter reattivo per calcolare l'URL assoluto completo dell'immagine
  get avatarUrl(): string {
    return `/uploads/${this.userAvatar()}`;
  }

  handleNavigationClick(){
    this.isOpen = false;
  }

}
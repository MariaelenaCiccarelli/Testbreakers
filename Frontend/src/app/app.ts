import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Navbar } from './core/components/navbar/navbar';
import { Footer } from './core/components/footer/footer';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, Navbar, Footer ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Frontend');
  hideNavbarAndFooter = false;

  constructor(private router: Router) {
    this.router.events.subscribe(() => {
      // Lista delle rotte senza navbar
      const silentRoutes = ['/match-arena', 'new-match', 'login'];
      this.hideNavbarAndFooter = silentRoutes.some(route => this.router.url.includes(route));
    });
  }
}

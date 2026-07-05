import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RestBackendService } from '../../services/rest-backend/rest-backend-service'; 
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth/auth-service';
import { jwtDecode } from 'jwt-decode';

// Definiamo un'interfaccia per tipizzare i record della classifica
export interface LeaderboardEntry {
  position: number;
  playerId: number;
  handle: string;
  avatar: string;
  wins: number;
  matchesDone: number;
  winRate: number;
  actualStreak?: number;
  bestStreak?: number;
}

@Component({
  selector: 'app-homepage',
  imports: [CommonModule, RouterLink],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage {

  router = inject(Router);
  
  private restService = inject(RestBackendService);
  private toastr = inject(ToastrService);
  private authService = inject(AuthService);


  // Stato dell'autenticazione ricavato dal servizio di login
  isLoggedIn = computed(() => this.authService.isAuthenticated());
  
  
  // Dati del giocatore loggato (conterrà handle, actualStreak, ecc.)
  currentPlayer = signal<any>(null);

  // Computed signal per estrarre la streak attuale velocemente
  actualStreak = computed(() => this.currentPlayer()?.streak ?? 0);


  ngOnInit() {
    this.checkAuthentication();
    this.loadLeaderboards();
  }
  
  checkAuthentication() {
    // Recuperiamo direttamente il token reale memorizzato nel localStorage (senza intermediari)
    const token = this.authService.getToken();
    
    // Usiamo il metodo del tuo servizio per verificare al volo che esista e non sia scaduto
    const isValid = this.authService.verifyToken(token);

    if (token && isValid) {
      try {
        // Decodifichiamo il JWT per estrarre handle e actualStreak in tempo reale
        const decoded: any = jwtDecode(token);
        
        this.restService.getCurrentStreak().subscribe({
          next: (res) => {
            this.currentPlayer.set({
              handle: decoded.handle,
              streak: res.actualStreak
            });
          },
          error: (err) => {
            this.currentPlayer.set({ handle: decoded.handle, streak: 0 });
          }
        });
      } catch (error) {
        this.currentPlayer.set(null);
      }
    } else {
      // Forza lo stato non autenticato se il token è marcio o assente
      this.currentPlayer.set(null);
    }
  }

  newMatch(){ this.router.navigate(['/new-match']); }
  goToSignup(){ this.router.navigate(['/signup']); }

  // Tab attivo per lo switch delle classifiche ('global' | 'coder' | 'tester')
  activeTab = signal<'global' | 'coder' | 'tester'>('global');

  // I tre Signal che conterranno le classifiche Top 10
  globalLeaderboard = signal<LeaderboardEntry[]>([]);
  coderLeaderboard = signal<LeaderboardEntry[]>([]);
  testerLeaderboard = signal<LeaderboardEntry[]>([]);

  // Stato di caricamento
  isLoading = signal<boolean>(true);

  loadLeaderboards() {
    this.isLoading.set(true);
    this.restService.getLeaderboards().subscribe({
      next: (res) => {
        this.globalLeaderboard.set(res.global);
        this.coderLeaderboard.set(res.coder);
        this.testerLeaderboard.set(res.tester);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.toastr.error("Error loading rankings.");
        this.isLoading.set(false);
      }
    });
  }

  // Helper per cambiare tab al click
  setTab(tab: 'global' | 'coder' | 'tester') {
    this.activeTab.set(tab);
  }

  // Helper computato per ottenere la classifica attualmente visibile
  get currentLeaderboard(): LeaderboardEntry[] {
    if (this.activeTab() === 'coder') return this.coderLeaderboard();
    if (this.activeTab() === 'tester') return this.testerLeaderboard();
    return this.globalLeaderboard();
  }

}

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RestBackendService } from '../../services/rest-backend/rest-backend-service';
import { AuthService } from '../../services/auth/auth-service';
import { ToastrService } from 'ngx-toastr'

@Component({
  selector: 'app-personal-area',
  imports: [CommonModule, RouterLink],
  templateUrl: './personal-area.html',
  styleUrl: './personal-area.css',
})
export class PersonalArea {
  private restService = inject(RestBackendService);
  private toastr = inject(ToastrService);
  private authService = inject(AuthService);

  // Signals per ospitare i dati che arrivano dal backend
  profileData = signal<any>(null);
  matchHistory = signal<any[]>([]);
  isLoading = signal<boolean>(true);

  // Controllo dello stato della modale del riepilogo codici
  selectedMatch = signal<any>(null);
  isModalOpen = signal<boolean>(false);

  // Stati e signals per il cambio avatar
  isAvatarModalOpen = signal<boolean>(false);
  isSavingAvatar = signal<boolean>(false);
  selectedAvatarFile = signal<string>('');
  activeColorTab = signal<string>('black');
  avatarPool = signal<any[]>([]);

  ngOnInit() {
    this.loadPersonalData();
  }

  loadPersonalData() {
    this.isLoading.set(true);
    this.restService.getPlayerInfos().subscribe({
      next: (res) => {
        this.profileData.set(res.profile);
        this.matchHistory.set(res.history);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.toastr.error("Unable to load profile data.");
        this.isLoading.set(false);
      }
    });
  }

  // Al click sulla riga del match, apriamo la modale iniettando l'oggetto match selezionato
  openMatchDetails(match: any) {
    this.selectedMatch.set(match);
    console.log(match);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.selectedMatch.set(null);
  }

  openAvatarModal() {
    this.selectedAvatarFile.set(this.profileData()?.avatar || '');
    this.isAvatarModalOpen.set(true);
    
    // Carichiamo il pool dal server solo al primo click per non sprecare banda
    if (this.avatarPool().length === 0) {
      this.restService.getAvailableAvatars().subscribe({
        next: (res: any) => {
          if (res && res.avatars) this.avatarPool.set(res.avatars);
        }
      });
    }
  }

  get filteredAvatars() {
    return this.avatarPool().filter(av => av.color === this.activeColorTab());
  }

  selectAvatar(fileName: string) {
    this.selectedAvatarFile.set(fileName);
  }

  setColorTab(color: string) {
    this.activeColorTab.set(color);
  }

  saveNewAvatar() {
    if (!this.selectedAvatarFile()) return;

    this.isSavingAvatar.set(true);
    this.restService.updateAvatar(this.selectedAvatarFile()).subscribe({
      next: (res) => {
        this.toastr.success("Avatar updated!", "Congratulation!");
        
        // 1. Aggiorniamo il token globale così la Navbar e la Home si aggiornano all'istante
        if (res.token) {
          this.authService.updateToken(res.token);
        }
        
        // 2. Aggiorniamo lo stato locale del profilo senza ricaricare tutta la pagina
        this.profileData.update(prev => ({ ...prev, avatar: res.avatar }));
        
        this.isSavingAvatar.set(false);
        this.isAvatarModalOpen.set(false);
      },
      error: (err) => {
        this.toastr.error("Unable to edit Avatar.");
        this.isSavingAvatar.set(false);
      }
    });
  }

}

import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { RestBackendService } from '../../services/rest-backend/rest-backend-service';
import { AuthService } from '../../services/auth/auth-service';
import { MatchService } from '../../services/match/match-service';


@Component({
  selector: 'app-new-match',
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './new-match.html',
  styleUrl: './new-match.css',
})

export class NewMatch {
  toastr = inject(ToastrService);
  router = inject(Router);
  restService = inject(RestBackendService);
  authService = inject(AuthService); // Per recuperare l'utente loggato
  matchService = inject(MatchService);

  submitted = false;
  isP1LoggedIn = false;

  // Inietta il ChangeDetectorRef per il caricamento immediato delle challenge nel component
  cdr = inject(ChangeDetectorRef);
  // Variabile per memorizzare la lista delle sfide disponibili
  challengesList: any[] = [];

  protected readonly Math = Math;

  newMatchForm = new FormGroup({
    p1Handle: new FormControl('', [Validators.required]),
    p1Password: new FormControl(''),
    p2Handle: new FormControl('', [Validators.required]),
    p2Password: new FormControl('', [Validators.required]),
    p2Role: new FormControl('', [Validators.required]),
    challengeId: new FormControl('random', [Validators.required])
  });

  ngOnInit() {

    // Recuperiamo la lista di tutte le sfide dal backend all'avvio del componente
    this.restService.getAllChallenges().subscribe({
      next: (res: any) => {
        this.challengesList = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error("Unable to load challenge list.", "Error");
      }
    });

    //Controlliamo se P1 è già loggato (da AuthService o localStorage)
    const currentPlayerHandle = this.authService.getHandle();

    if(currentPlayerHandle){
      this.isP1LoggedIn = true;
      
      //Pre-compiliamo l'handle di P1 e mettiamo un valore fittizio alla password
      this.newMatchForm.patchValue({
        p1Handle: currentPlayerHandle,
        p1Password: '********' //Solo visivo, verrà rimosso prima dell'invio
      });

      //Se loggato, la password non deve essere validata (ci pensa il token)
      this.newMatchForm.get('p1Password')?.clearValidators();

    }else{
      //Se NON loggato, la password di P1 è obbligatoria
      this.newMatchForm.get('p1Password')?.setValidators([Validators.required]);
    }
    this.newMatchForm.get('p1Password')?.updateValueAndValidity();
  }

  // Helper per recuperare la sfida attualmente selezionata nella select per mostrarne i dettagli
  getSelectedChallengeDetails() {
    const selectedId = this.newMatchForm.get('challengeId')?.value;
    if (!selectedId || selectedId === 'random') return null;
    return this.challengesList.find(c => c.challengeId == selectedId);
  }

  // Formatta i secondi della sfida in un formato leggibile (es. 1m 40s oppure 50s)
  formatChallengeTime(seconds: number | undefined): string {
    if (!seconds || seconds <= 0) return 'NO LIMIT';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (mins > 0) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins} MIN`;
    }
    return `${secs}s`;
  }

  newMatch(){
    this.submitted = true;
    if (this.newMatchForm.invalid) return;

    // Creiamo una copia pulita dei dati del form
    const payload: any = { ...this.newMatchForm.value };

    // SE PLAYER 1 È GIÀ LOGGATO, segnaliamo al backend di usare la sessione esistente
    if (this.isP1LoggedIn) {
      payload.p1IsAuthenticated = true;
      // Passiamo il token permanente attuale nell'oggetto così il backend lo valida
      payload.p1GlobalToken = this.authService.getToken();
    }

    this.restService.newMatch(payload).subscribe({
      next: (res) => {
        //Salviamo i token nel MatchService (e quindi nel SessionStorage)
        // Verifichiamo che i token esistano davvero prima di passarli
        if(res.matchTokens.player1 && res.matchTokens.player2){
          this.matchService.setMatchSession(
            res.matchTokens.player1, 
            res.matchTokens.player2
          );
          
          this.toastr.success(`Match created!`, `Congratulations!`);
          this.router.navigate(['/match-arena', res.match.matchId]);
        }else{
          this.toastr.error("Tokens not received from server.", "Error");
        }
      },
      error: (err) => {
        // Estraggo il messaggio dal backend. 
        // Se per qualche motivo il server è giù o non risponde col JSON, metto un fallback.
        const errorMessage = err.error?.error || "A connection error occurred.";
        
        // Titolo dinamico in base allo status code per dare un tocco pro
        let title = "Errore";
        if (err.status === 401) title = "Incorrect Credentials.";
        if (err.status === 404) title = "Player not found.";
        if (err.status === 400) title = "Invalid data.";

        // Mostro esattamente "Player 1 non trovato", "Credenziali Player 1 errate", ecc.
        this.toastr.error(errorMessage, title);
      }
    });
  }

  get p1DisplayName(): string {
    return this.newMatchForm.get('p1Handle')?.value || 'Player 1';
  }

  get p2DisplayName(): string {
    return this.newMatchForm.get('p2Handle')?.value || 'Player 2';
  }
}

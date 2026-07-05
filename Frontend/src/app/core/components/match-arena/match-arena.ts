import { Component, HostListener, inject, signal } from '@angular/core';
import { RestBackendService } from '../../services/rest-backend/rest-backend-service';
import { MatchService } from '../../services/match/match-service';
import { ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
//import vsGif from '../../assets/gifs/vs2.gif';

@Component({
  selector: 'app-match-arena',
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './match-arena.html',
  styleUrl: './match-arena.css',
})
export class MatchArena {
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private restService = inject(RestBackendService);
  private matchService = inject(MatchService);
  private router = inject(Router);
  //protected readonly vs2Gif = vsGif;

  challenge = signal<any>(null);
  turn = signal<'coder' | 'tester'>('tester'); //Inizia sempre il tester
  showInstructions = signal<boolean>(true);
  coderTimeLeft = signal<number>(0);
  testerTimeLeft = signal<number>(0);
  currentRound = signal<number>(1);
  coderAvatar = signal<string>('default-avatar.png');
  testerAvatar = signal<string>('default-avatar.png');
  showResults = signal<boolean>(false);
  lastResult = signal<any>(null); // Memorizzerà la risposta del backend
  viewingSolution = signal<boolean>(false);

  // Campi di supporto per la scomposizione strutturata degli editor contenteditable
  testerRows: Array<{ prefix: string; selector: string; suffix: string }> = [];
  coderHtmlProcessed: string = '';

  coderCode: string = '';
  testerCode: string = '';
  matchId: number = 0;

  private timerInterval: any;
  private startTime: number = 0;
  
  // BLOCCO VISIVO POPUP BROWSER (Per chiusura scheda X e Refresh F5)
  // Mostra il popup nativo. Se l'utente clicca su "Annulla", si ferma e non tocca il server.
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.showResults()) return;

    // Se l'utente conferma l'uscita (X o F5), salviamo questo flag temporaneo.
    // Ci servirà al riavvio solo in caso di Refresh per capire che dobbiamo andare in Home.
    sessionStorage.setItem(`match_${this.matchId}_interrupted`, 'true');
    $event.returnValue = true;
  }

  // GESTIONE CHIUSURA DEFINITIVA DELLA SCHEDA (Clic su X + "Esci")
  // Se l'utente chiude il browser, questo invia il segnale in background prima di morire.
  @HostListener('window:pagehide', ['$event'])
  onPageHide($event: any): void {
    if (this.showResults()) return;

    const session = this.matchService.getMatchSession();
    if (session) {
      const currentRole = this.turn();
      const token = session.p1.role === currentRole ? session.p1.token : session.p2.token;

      if (token && this.matchId) {
        // Chiamiamo direttamente l'helper del servizio!
        this.restService.sendKeepAliveAbandon(this.matchId, token);
      }
    }
  }

  // Helper per eseguire l'abbandono post-refresh e pulire la navigazione verso la Home
  private executeForceAbandonAndGoHome() {
    const session = this.matchService.getMatchSession();
    if (!session) {
      this.router.navigate(['/home']);
      return;
    }
    const currentRole = this.turn();
    const token = session.p1.role === currentRole ? session.p1.token : session.p2.token;

    this.restService.abandonMatch(this.matchId, token!).subscribe({
      next: () => {
        this.toastr.warning("Match abandoned due to page refresh.");
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.router.navigate(['/home']);
      },
      error: () => {
        this.router.navigate(['/home']);
      }
    });
  }

  // Pulsante manuale "Dichiara Resa" nell'HTML
  resignFromMatch() {
    const confirmResign = confirm("ATTENTION PLEASE: are you sure you want to abandon the Match?");
    
    if (confirmResign) {
      const session = this.matchService.getMatchSession();
      if (!session) return;

      const currentRole = this.turn();
      const token = session.p1.role === currentRole ? session.p1.token : session.p2.token;

      this.restService.abandonMatch(this.matchId, token!).subscribe({
        next: (res) => {
          this.toastr.warning("Challenge successfully abandoned.");
          if (this.timerInterval) clearInterval(this.timerInterval);
          this.router.navigate(['/home']);
        },
        error: (err) => {
          this.toastr.error("Unable to leave the Match.");
        }
      });
    } else {
      // Se l'utente clicca annulla sul confirm della freccia indietro, puliamo il flag
      sessionStorage.removeItem(`match_${this.matchId}_interrupted`);
    }
  }

  ngOnInit() {
    this.matchId = Number(this.route.snapshot.paramMap.get('id'));

    // GESTIONE REFRESH (F5 + "Ricarica")
    // Se la pagina rinasce e trova il flag di interruzione, significa che l'utente ha fatto F5.
    // Eseguiamo l'abbandono e lo rispediamo dritto alla Home, evitando il caricamento dell'arena (Niente 404!)
    if (sessionStorage.getItem(`match_${this.matchId}_interrupted`) === 'true') {
      sessionStorage.removeItem(`match_${this.matchId}_interrupted`);
      this.executeForceAbandonAndGoHome();
      return; // Interrompiamo l'init qui!
    }

    // Caricamento regolare se non è un refresh
    this.loadArena();

    // TRAPPOLA FRECCIA INDIETRO (Blocca e forza la finta resa)
    window.history.pushState(null, '', window.location.href);
    window.onpopstate = () => {
      if (this.showResults()) {
        window.onpopstate = null;
        this.router.navigate(['/home']);
        return;
      }
      window.history.pushState(null, '', window.location.href);
      this.toastr.info("Usa il pulsante 'Dichiara Resa' per abbandonare la partita in corso.", "Azione Bloccata");
      this.resignFromMatch();
    };
  }

  loadArena() {
    this.restService.getMatchChallenge(this.matchId!).subscribe({
      next: (res) => {
        if (res.challenge) this.challenge.set(res.challenge);
        this.turn.set(res.turn);
        this.coderTimeLeft.set(res.coderTimeLeft);
        this.testerTimeLeft.set(res.testerTimeLeft);

        // Recupero del codice: priorità al codice dinamico memorizzato nell'evoluzione del match, altrimenti usa i template originari
        this.testerCode = res.challenge.lastTesterCode || res.lastTesterCode || res.challenge.templateTest;
        this.coderCode = res.challenge.lastCoderCode || res.lastCoderCode || res.challenge.templateHTML;

        // Preparazione dell'editor
        this.prepareTesterEditor(this.testerCode);
        this.prepareCoderEditor(this.coderCode);

        // Recupero sicuro degli avatar direttamente dalla risposta dell'endpoint dell'arena
        this.coderAvatar.set(res.coderAvatar || 'default-avatar.png');
        this.testerAvatar.set(res.testerAvatar || 'default-avatar.png');

        if (!this.showInstructions()) this.startTimer();
      },
      error: (err) => {
        this.toastr.error("Error loading Match.");
        this.router.navigate(['/new-match']);
      }
    });
  }

  updateState(res: any) {
    if (res.turn) this.turn.set(res.turn);
    this.coderTimeLeft.set(res.coderTimeLeft);
    this.testerTimeLeft.set(res.testerTimeLeft);
    
    // Sincronizza gli editor con le modifiche convalidate dall'ultimo scontro
    if (res.lastTesterCode) this.testerCode = res.lastTesterCode;
    if (res.lastCoderCode) this.coderCode = res.lastCoderCode;

    // Rigenerazione delle strutture grafiche per il turno successivo
    this.prepareTesterEditor(this.testerCode);
    this.prepareCoderEditor(this.coderCode);
  }

  startTimer() {
    this.startTime = Date.now(); // RESET FONDAMENTALE del punto di inizio turno

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.turn() === 'coder') {
        this.coderTimeLeft.update(t => t > 0 ? t - 1 : 0);
        if (this.coderTimeLeft() <= 0) this.handleTimeOut(); // Opzionale: gestisci fine tempo
      } else {
        this.testerTimeLeft.update(t => t > 0 ? t - 1 : 0);
        if (this.testerTimeLeft() <= 0) this.handleTimeOut();
      }
    }, 1000);
  }

  handleTimeOut() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.submitTurn();
  }

  getTimeSpent(): number {
    const now = Date.now();
    const spent = Math.floor((now - this.startTime) / 1000);
    this.startTime = now; // Reset per il prossimo turno
    return spent;
  }
  
  // Formatta i secondi della sfida in un formato leggibile (es. 1m 40s oppure 50s) per il recap della challenge
  formatChallengeTime(seconds: number | undefined): string {
    if (!seconds || seconds <= 0) return 'NO LIMIT';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (mins > 0) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins} MIN`;
    }
    return `${secs}s`;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  submitTurn() {
    const currentRole = this.turn();
    const session = this.matchService.getMatchSession();
    if (!session) return;

    // Recupera il token corretto dell'utente attivo in base al turno di gioco
    const token = session.p1.role === currentRole ? session.p1.token : session.p2.token;
    
    let codeToSend = '';
    if (currentRole === 'tester') {
      // Leggiamo i selettori modificati direttamente dagli elementi del DOM reale
      const editableElements = document.querySelectorAll('.tester-editable-input');
      let editableIndex = 0;

      codeToSend = this.testerRows.map(row => {
        if (row.suffix) {
          const el = editableElements[editableIndex] as HTMLElement;
          editableIndex++;
          // Se l'elemento esiste prendiamo il suo testo interno scritto dall'utente, altrimenti teniamo il vecchio
          const userSelector = el ? el.innerText.trim() : row.selector;
          return `${row.prefix}${userSelector}${row.suffix}`;
        }
        return row.prefix;
      }).join('\n');
    } else {
      // Per il coder preleviamo l'innerText pulito del box che restituisce il codice sorgente come testo puro
      const coderEditorElem = document.getElementById('coder-contenteditable-editor');
      codeToSend = coderEditorElem ? coderEditorElem.innerText : this.coderCode;
    }

    const data = {
      code: codeToSend.trim(),
      timeSpent: this.getTimeSpent()
    };

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.restService.submitTurn(this.matchId, data, token!).subscribe({
      next: (res) => {
        this.lastResult.set(res);

        if (res.status === 'match_finished') {
          this.showResults.set(true);
          if (res.winner === currentRole) {
            this.toastr.success("VICTORY! " + res.message);
          } else {
            this.toastr.error("MATCH FINSHED! " + res.message);
          }
        } else if (res.status === 'success') {
          this.toastr.success(res.message);
          this.updateState(res);
          this.showResults.set(true); // Mostra popup cambio turno
        } else {
          // Il backend restituisce i codici precedenti corretti memorizzati nel DB.
          // Aggiorniamo le variabili locali con i valori ufficiali del server scartando le modifiche errate
          this.testerCode = res.lastTesterCode || this.testerCode;
          this.coderCode = res.lastCoderCode || this.coderCode;

          // Riassegniamo e forziamo il rinfresco visivo dei campi contenteditable per ripulire l'editor
          this.prepareTesterEditor(this.testerCode);
          this.prepareCoderEditor(this.coderCode);

          // Svuotiamo e sovrascriviamo l'HTML dell'editor direttamente nel DOM 
          const coderEditorElem = document.getElementById('coder-contenteditable-editor');
          if (coderEditorElem) {
            coderEditorElem.innerHTML = this.coderHtmlProcessed;
          }

          // Il backend restituisce i tempi aggiornati dopo la penalizzazione
          this.coderTimeLeft.set(res.coderTimeLeft);
          this.testerTimeLeft.set(res.testerTimeLeft);
          
          this.toastr.warning(res.message);
          this.startTimer(); // Riprende il tempo locale per riprovare
        }
      },
      error: (err) => {
        this.toastr.error(err.error?.error || "Error sending turn");
        // Il backend restituisce i codici precedenti corretti memorizzati nel DB.
          // Riassegniamo e forziamo il rinfresco visivo dei campi contenteditable per ripulire l'editor
          this.prepareTesterEditor(this.testerCode);
          this.prepareCoderEditor(this.coderCode);

          // Svuotiamo e sovrascriviamo l'HTML dell'editor direttamente nel DOM 
          const coderEditorElem = document.getElementById('coder-contenteditable-editor');
          if (coderEditorElem) {
            coderEditorElem.innerHTML = this.coderHtmlProcessed;
          }
        this.startTimer();
      }
    });
  }

  // Scompone il codice del test in righe editabili e righe bloccate per il Tester
  prepareTesterEditor(testCode: string) {
    const lines = testCode.split('\n');
    this.testerRows = lines.map(line => {
      // Intercetta la chiamata al locator del selettore CSS di Playwright
      if (line.includes('page.locator(')) {
        // La regex isola l'inizio della riga fino all'apice iniziale del selettore, il valore attuale, e la chiusura della parentesi
        const match = line.match(/(.*?page\.locator\(['"`](?:css=)?)(.*?)(['"`]\s*\).*?)/);
        if (match) {
          return {
            prefix: match[1],   // Codice bloccato antecedente (es: "  const input = page.locator('")
            selector: match[2], // Unica porzione modificabile dall'utente (il selettore vero e proprio)
            suffix: match[3]    // Codice bloccato successivo (es: "');")
          };
        }
      }
      // Se non contiene un locator, l'intera riga è considerata testo fisso non editabile
      return { prefix: line, selector: '', suffix: '' };
    });
  }

  // Prepara l'HTML come testo sorgente per l'editor del Coder salvaguardando gli ID
  prepareCoderEditor(htmlCode: string) {
    // Facciamo l'escape globale dei caratteri HTML per evitare che il browser compili la pagina
    let escaped = htmlCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Adesso cerchiamo la stringa testuale "id=&quot;valore&quot;" nell'HTML convertito e la sostituiamo con un vero blocco HTML protetto (un badge ambrato non modificabile)
    this.coderHtmlProcessed = escaped.replace(/id=["']?([^"'\s&]+)["']?/g, (match, idValue) => {
      // Puliamo l'id nel caso in cui l'escape ci abbia lasciato residui di entità html quotate (&quot;)
      const cleanId = idValue.replace(/&quot;/g, '').replace(/&amp;/g, '');
      
      // Ritorniamo un vero blocco span HTML che uscirà dall'escape grazie a [innerHTML], 
      // visualizzato come un blocchetto non editabile
      return `<span contenteditable="false" class="text-gray-500 font-mono text-sm select-none pointer-events-none">id="${cleanId}"</span>`;
    });
  }

  toggleSolutionView() {
    this.viewingSolution.update(v => !v);
  }

  goToNextRound() {
    const res = this.lastResult();
    this.showResults.set(false);

    if (res.status === 'match_finished') {
      this.router.navigate(['/home']);
    } else {
      // Se non è finito, ripartiamo col timer (sia per retry del coder che per cambio turno)
      this.coderTimeLeft.set(res.coderTimeLeft);
      this.startTimer();
    }
  }

  closeInstructions() {
    this.showInstructions.set(false);
    this.startTimer(); // Il tempo parte quando si chiude il popup
  }

  // Funzione per mandare a capo i requisiti numerati
  formatDescription(text: string | undefined): string[] {
    if (!text) return [];
    // Divide il testo ogni volta che trova un numero seguito da un punto (es: "1.")
    // Usiamo una regex per mantenere il numero nella riga successiva
    return text.split(/(?=\d\.)/);
  }

  // Gestisce la tabulazione da tastiera dentro le aree contenteditable
  handleTabKey(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault(); // Blocca il salto del focus sul bottone di submit

      const target = event.target as HTMLElement;
      
      // Guadagniamo l'accesso alla selezione del cursore del browser
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      
      // Definiamo quanti spazi inserire per la tabulazione (2 spazi è lo standard)
      const tabSpaces = "  "; 
      const textNode = document.createTextNode(tabSpaces);

      // Inseriamo gli spazi nell'esatta posizione del cursore
      range.insertNode(textNode);

      // Spostiamo il cursore subito dopo gli spazi appena inseriti, per continuare a scrivere fluidamente
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  get coderDisplayName(): string {
    const matchSession = this.matchService.getMatchSession();
    if (matchSession!.p1.role == 'coder') {
      if (matchSession!.p1.handle == null) {
        return "CODER";
      } else {
        return matchSession!.p1.handle;
      }
    } else {
      if (matchSession!.p2.handle == null) {
        return "CODER";
      } else {
        return matchSession!.p2.handle;
      }
    }
  }

  get testerDisplayName(): string {
    const matchSession = this.matchService.getMatchSession();
    if (matchSession!.p1.role == 'tester') {
      if (matchSession!.p1.handle == null) {
        return "TESTER";
      } else {
        return matchSession!.p1.handle;
      }
    } else {
      if (matchSession!.p2.handle == null) {
        return "TESTER";
      } else {
        return matchSession!.p2.handle;
      }
    }
  }

  // GETTER PER L'URL DELL'AVATAR DEL CODER (Resistente alle stringhe vuote o undefined)
  get coderAvatarUrl(): string {
    const matchSession = this.matchService.getMatchSession();
    let avatarName = 'default-avatar.png';

    if (matchSession) {
      if (matchSession.p1.role === 'coder') {
        avatarName = matchSession.p1.avatar || 'default-avatar.png';
      } else if (matchSession.p2.role === 'coder') {
        avatarName = matchSession.p2.avatar || 'default-avatar.png';
      }
    }

    return `/uploads/${avatarName}`;
  }

  get testerAvatarUrl(): string {
    const matchSession = this.matchService.getMatchSession();
    let avatarName = 'default-avatar.png';

    if (matchSession) {
      if (matchSession.p1.role === 'tester') {
        avatarName = matchSession.p1.avatar || 'default-avatar.png';
      } else if (matchSession.p2.role === 'tester') {
        avatarName = matchSession.p2.avatar || 'default-avatar.png';
      }
    }

    return `/uploads/${avatarName}`;
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    window.onpopstate = null;
    sessionStorage.removeItem(`match_${this.matchId}_interrupted`);
  }
}
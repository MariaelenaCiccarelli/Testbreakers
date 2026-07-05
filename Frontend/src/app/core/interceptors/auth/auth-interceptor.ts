import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatchService } from '../../services/match/match-service';
import { AuthService } from '../../services/auth/auth-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const matchService = inject(MatchService);
  const authService = inject(AuthService);

  // Se la richiesta ha già un header Authorization impostato manualmente, non toccarla
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  // Se la chiamata è interna alle rotte di gioco di un match
  if (req.url.includes('/matches') || req.url.includes('/match')) {
    const session = matchService.getMatchSession();
    
    if (session) {
      // Recuperiamo lo stato del match attuale per capire di chi è il turno
      // Mandiamo il token di P1 per le GET e lasciamo che le POST includano il proprio (o recuperiamo il token salvato).
      
      //Recupera il token salvato temporaneamente per la sessione corrente
      const matchToken = session.p1?.token; // O logica dinamica basata sul giocatore attivo

      if (matchToken) {
        req = req.clone({
          setHeaders: { Authorization: `Bearer ${matchToken}` }
        });
        return next(req);
      }
    }
  }

  // LOGICA STANDARD (Leaderboard, Profilo, Home, ecc.)
  // Se non siamo dentro un match, usiamo il token permanente di localStorage
  const globalToken = authService.getToken();
  if (globalToken && authService.verifyToken(globalToken)) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${globalToken}` }
    });
  }

  return next(req);
};
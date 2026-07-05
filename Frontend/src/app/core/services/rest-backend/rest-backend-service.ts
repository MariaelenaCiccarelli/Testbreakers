import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthRequest, AuthResponse } from '../../models/auth.model';
import { NewMatchRequest, NewMatchResponse } from '../../models/match.model';
import { SignupRequest, SignupResponse } from '../../models/signup.model';

@Injectable({
  providedIn: 'root',
})
export class RestBackendService {

  private url = '/api';

  constructor(private http: HttpClient) { }

  login(loginRequest: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.url}/auth`, loginRequest);
  }

  newMatch(newMatchRequest: NewMatchRequest): Observable<NewMatchResponse> {
    return this.http.post<NewMatchResponse>(`${this.url}/new-match`, newMatchRequest);
  }

  getAllChallenges(): Observable<any> {
    return this.http.get(`${this.url}/challenges`);
  }

  getMatchChallenge(matchId: number): Observable<any> {
    return this.http.get(`${this.url}/match-arena/${matchId}`);
  }

  submitTurn(matchId: number, data: { code: string, timeSpent: number }, token?: string): Observable<any> {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.url}/match-arena/${matchId}/submit-turn`, data, { headers });
  }

    //Invia una richiesta di abbandono "keepalive" a prova di chiusura browser
  sendKeepAliveAbandon(matchId: number | string, token: string): void {
    // Costruiamo il path relativo corretto: /api/matchId/abandon
    const targetUrl = `${this.url}/${matchId}/abandon`;
    
    fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
      keepalive: true
    }).catch(err => console.error("Errore nell'invio del keepalive:", err));
  }

  abandonMatch(matchId: number, token: string): Observable<any>{
    return this.http.post(`${this.url}/${matchId}/abandon`, {}, { headers: { Authorization: `Bearer ${token}` } });
  }

  getLeaderboards(): Observable<any> {
    return this.http.get(`${this.url}/leaderboards`);
  }

  getAvailableAvatars(): Observable<any> {
    return this.http.get<any>(`${this.url}/available-avatars`);
  }

  getPlayerInfos(): Observable<any> {
    return this.http.get<any>(`${this.url}/player-infos`);
  }

  signup(signupRequest: SignupRequest): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.url}/signup`, signupRequest);
  }

  updateAvatar(avatarFileName: string): Observable<any> {
    return this.http.put<any>(`${this.url}/update-avatar`, { avatar: avatarFileName });
  }

  getCurrentStreak(): Observable<{ actualStreak: number }> {
    return this.http.get<{ actualStreak: number }>(`${this.url}/player-streak`);
  }

}
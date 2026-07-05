import { Injectable, effect, computed, signal, WritableSignal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

import { MatchAuthState } from '../../models/match.model';

@Injectable({
  providedIn: 'root',
})
export class MatchService {
  
  //Stato iniziale: legge entrambi i token dal sessionStorage
  matchAuthState = signal<MatchAuthState>({
    p1: { handle: sessionStorage.getItem("handleP1"), token: sessionStorage.getItem("tokenP1"), role: sessionStorage.getItem("roleP1"), avatar: sessionStorage.getItem("avatarP1") },
    p2: { handle: sessionStorage.getItem("handleP2"), token: sessionStorage.getItem("tokenP2") , role: sessionStorage.getItem("roleP2"), avatar: sessionStorage.getItem("avatarP2") },
    isAuthenticated: this.verifyMatchToken(sessionStorage.getItem("tokenP1")) && this.verifyMatchToken(sessionStorage.getItem("tokenP2"), )
  });

  constructor() {
    effect(() => {
      const state = this.matchAuthState();
      
      //Sincronizzazione automatica con SessionStorage
      if(state.p1.token && state.p2.token){
        sessionStorage.setItem("tokenP1", state.p1.token);
        sessionStorage.setItem("handleP1", state.p1.handle!);
        sessionStorage.setItem("roleP1", state.p1.role!);
        sessionStorage.setItem("tokenP2", state.p2.token);
        sessionStorage.setItem("handleP2", state.p2.handle!);
        sessionStorage.setItem("roleP2", state.p2.role!);
      }else{
        sessionStorage.clear();
      }
    });
  }

  //Aggiorniamo tutto dopo la chiamata al backend
  setMatchSession(tokenP1: string, tokenP2: string) {
    const decoded1: any = jwtDecode(tokenP1);
    const decoded2: any = jwtDecode(tokenP2);
    console.log("Dati decodificati P1:", decoded1);
    console.log("Dati decodificati P2:", decoded2);

    this.matchAuthState.set({
      p1: { 
        handle: decoded1.handle, 
        token: tokenP1, 
        role: decoded1.role,
        avatar: decoded1.avatar
      },
      p2: { 
        handle: decoded2.handle, 
        token: tokenP2, 
        role: decoded2.role,
        avatar: decoded2.avatar
      },
      isAuthenticated: true
    });
  }

  getMatchSession() {
    const state = this.matchAuthState();
    if (!state.isAuthenticated) return null;
    
    return {
      p1: state.p1,
      p2: state.p2
    };
  }

  verifyMatchToken(token: string | null): boolean {
    if (!token) return false;
    try{
      const decoded = jwtDecode(token);
      return !!decoded.exp && Date.now() < decoded.exp * 1000;
    }catch{
      return false;
    }
  }

  logout() {
    this.matchAuthState.set({
      p1: { handle: null, token: null, role: null, avatar: null },
      p2: { handle: null, token: null, role: null, avatar: null },
      isAuthenticated: false
    });
  }

}
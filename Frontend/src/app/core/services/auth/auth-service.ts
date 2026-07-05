import { Injectable, WritableSignal, computed, effect, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { AuthState } from '../../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  authState: WritableSignal<any> = signal<any>({
    handle: this.getHandle(),
    avatar: this.getAvatar(),
    token: this.getToken(), 
    isAuthenticated: this.verifyToken(this.getToken()) 
  })

  handle = computed(() => this.authState().handle);
  avatar = computed(() => this.authState().avatar); //
  token = computed(() => this.authState().token);
  isAuthenticated = computed(() => this.authState().isAuthenticated);

  constructor(){
    effect( () => {
      const token = this.authState().token;
      const handle = this.authState().handle;
      const avatar = this.authState().avatar;

      if(token !== null){
        localStorage.setItem("token", token);
      }else{
        localStorage.removeItem("token");
      }
      if(handle !== null){
        localStorage.setItem("handle", handle);
      }else{
        localStorage.removeItem("handle");
      }
      if(avatar !== null){
        localStorage.setItem("avatar", avatar);
      }else{
        localStorage.removeItem("avatar");
      }
    });
  }

  getToken(){
    return localStorage.getItem("token");
  }

  getAvatar(){
    return localStorage.getItem("avatar") || 'default-avatar.png';
  }

  verifyToken(token: string | null): boolean {
    if(token !== null){
      try{
        const decodedToken = jwtDecode(token);
        const expiration = decodedToken.exp;
        if(expiration === undefined || Date.now() >= expiration * 1000){
          return false; 
        }else{
          return true; 
        }
      }catch(error){  
        return false;
      }
    }
    return false;
  }

  updateToken(token: string): void {
    const decodedToken: any = jwtDecode(token);
    const handle = decodedToken.handle;
    const avatar = decodedToken.avatar;
    
    this.authState.set({
      handle: handle,
      avatar: avatar,
      token: token,
      isAuthenticated: this.verifyToken(token)
    })
  }

  getHandle(){
    return localStorage.getItem("handle");
  }
  
  isPlayerAuthenticated(): boolean {
    return this.verifyToken(this.getToken());
  }

  logout(){
    this.authState.set({
      handle: null,
      avatar: null,
      token: null,
      isAuthenticated: false
    });
  }
}
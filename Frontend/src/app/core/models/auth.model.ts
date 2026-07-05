export interface AuthRequest {
  handle: string;
  password: string;
}

export interface AuthResponse {
  token: string;
};

export interface AuthState {
  handle: string | null,
  token: string | null,
  avatar: string | null,
  isAuthenticated: boolean
}
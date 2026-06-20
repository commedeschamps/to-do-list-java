export interface AuthCredentials {
  username: string;
  password: string;
}

export interface CurrentUser {
  id: number;
  username: string;
  displayName?: string | null;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

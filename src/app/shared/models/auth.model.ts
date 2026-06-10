export interface AuthCredentials {
  username: string;
  password: string;
}

export interface CurrentUser {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

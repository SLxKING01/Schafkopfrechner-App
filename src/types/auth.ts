import type { AuthError, Session, User } from '@supabase/supabase-js';

export type AuthUser = User;

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  username: string;
};

export type AuthResponse = {
  user: AuthUser | null;
  session: Session | null;
  error: AuthError | null;
};

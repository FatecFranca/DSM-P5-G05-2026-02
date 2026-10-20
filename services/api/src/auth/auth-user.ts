import type { Request } from 'express';
import type { Perfil } from '../generated/prisma/enums';

export interface AuthUser {
  id: string;
  instituicaoId: string;
  perfil: Perfil;
  sessaoId: string;
}

export interface AuthRequest extends Request {
  currentUser: AuthUser;
}

import type { Perfil } from '@/services/api';

export function homeForRole(role: Perfil): '/dashboard' | '/professor' | '/student' {
  if (role === 'ADMIN' || role === 'COORDENACAO') return '/dashboard';
  if (role === 'ALUNO') return '/student';
  return '/professor';
}

export function canUseAdmin(role: Perfil) {
  return role === 'ADMIN' || role === 'COORDENACAO';
}

export function canUseProfessor(role: Perfil) {
  return role === 'PROFESSOR' || role === 'TUTOR';
}

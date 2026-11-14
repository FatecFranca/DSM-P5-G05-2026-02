import type { Perfil } from '@/services/api';

export function homeForRole(role: Perfil): '/dashboard' | '/professor' | '/student' | '/secretaria' {
  if (role === 'COORDENACAO') return '/dashboard';
  if (role === 'SECRETARIA') return '/secretaria';
  if (role === 'ALUNO') return '/student';
  return '/professor';
}

export function canUseAdmin(role: Perfil) {
  return role === 'COORDENACAO';
}

export function canUseProfessor(role: Perfil) {
  return role === 'PROFESSOR' || role === 'TUTOR';
}

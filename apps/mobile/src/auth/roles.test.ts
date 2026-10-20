import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseAdmin, canUseProfessor, homeForRole } from './roles.ts';

test('redireciona cada perfil a uma navegação permitida', () => {
  assert.equal(homeForRole('ADMIN'), '/dashboard');
  assert.equal(homeForRole('COORDENACAO'), '/dashboard');
  assert.equal(homeForRole('PROFESSOR'), '/professor');
  assert.equal(homeForRole('TUTOR'), '/professor');
  assert.equal(homeForRole('ALUNO'), '/student');
  assert.equal(canUseAdmin('PROFESSOR'), false);
  assert.equal(canUseProfessor('ALUNO'), false);
});

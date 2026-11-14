import assert from 'node:assert/strict';
import test from 'node:test';
import { addPost, addReply, authorRole, canPost, channelPreview, channelsForViewer, chatUnread, conversationMessages, conversationTitle, conversationsForViewer, createInitialMessages, isGroup, lastChatMessage, lastRead, markRead, maxMessageLength, sendChat, toggleLike, totalUnread, unreadCount } from './messages.ts';

const now = Date.parse('2026-11-11T15:00:00Z');
const studentChannels = () => channelsForViewer('ALUNO');
const general = () => studentChannels()[0].id;

test('canais: o estudante vê a própria turma; a docência vê as turmas vinculadas', () => {
  const student = studentChannels();
  assert.equal(student[0].name, 'Geral');
  assert.ok(student.length >= 2, 'há um canal por disciplina além do Geral');
  assert.equal(new Set(student.map((channel) => channel.classId)).size, 1);
  assert.ok(new Set(channelsForViewer('PROFESSOR').map((channel) => channel.classId)).size > 1);
});

test('só o docente publica; a tutoria não publica nem responde', () => {
  const state = createInitialMessages(now);
  assert.equal(canPost('PROFESSOR'), true);
  assert.equal(canPost('ALUNO'), false);
  assert.throws(() => addPost(state, { id: 'x', viewer: 'ALUNO', channelId: general(), author: 'A', body: 'oi', important: false, now }), /Somente docentes/);
  assert.throws(() => addReply(state, { id: 'x', viewer: 'TUTOR', postId: 'p1', author: 'T', body: 'oi', now }), /tutoria/);
});

test('publicar e responder validam texto, canal e publicação', () => {
  const state = createInitialMessages(now);
  assert.throws(() => addPost(state, { id: 'x', viewer: 'PROFESSOR', channelId: general(), author: 'P', body: '   ', important: false, now }), /Escreva uma mensagem/);
  assert.throws(() => addPost(state, { id: 'x', viewer: 'PROFESSOR', channelId: general(), author: 'P', body: 'a'.repeat(maxMessageLength + 1), important: false, now }), /até 2000/);
  assert.throws(() => addPost(state, { id: 'x', viewer: 'PROFESSOR', channelId: 'canal-inexistente', author: 'P', body: 'oi', important: false, now }), /fora das suas turmas/);
  assert.throws(() => addReply(state, { id: 'x', viewer: 'ALUNO', postId: 'nao-existe', author: 'A', body: 'oi', now }), /não encontrada/);
  const posted = addPost(state, { id: 'novo', viewer: 'PROFESSOR', channelId: general(), author: 'P', body: '  Aviso novo  ', important: true, now });
  assert.equal(posted.posts.at(-1)?.body, 'Aviso novo');
  assert.equal(posted.posts.at(-1)?.important, true);
  assert.equal(state.posts.length + 1, posted.posts.length, 'o estado anterior não é alterado');
  const replied = addReply(posted, { id: 'resp', viewer: 'ALUNO', postId: 'novo', author: 'Aluna', body: 'Obrigada!', now });
  assert.equal(replied.posts.find((post) => post.id === 'novo')?.replies[0].role, 'ESTUDANTE');
});

test('não lidos: conta o que outros escreveram, nunca o que a própria pessoa escreveu', () => {
  let state = createInitialMessages(now);
  const before = totalUnread(state, 'ALUNO');
  assert.ok(before > 0, 'a demonstração começa com novidades para o estudante');
  // A resposta do próprio estudante não vira "não lida" para ele...
  state = addReply(state, { id: 'r-own', viewer: 'ALUNO', postId: 'p1', author: 'Aluna', body: 'Entendi.', now });
  assert.equal(totalUnread(state, 'ALUNO'), before);
  // ...mas é novidade para o docente.
  const prof = totalUnread(state, 'PROFESSOR');
  assert.ok(prof > 0);
  // Abrir o canal zera só aquele canal e só para aquele perfil.
  const next = markRead(state, 'ALUNO', general(), now + 1000);
  assert.equal(unreadCount(next, 'ALUNO', general()), 0);
  assert.equal(unreadCount(next, 'PROFESSOR', general()), unreadCount(state, 'PROFESSOR', general()));
  assert.ok(totalUnread(next, 'ALUNO') < before);
  assert.equal(lastRead(next, 'ALUNO', general()), new Date(now + 1000).toISOString());
  assert.equal(lastRead(state, 'ALUNO', general()), null);
});

test('publicação nova depois da leitura volta a contar como não lida', () => {
  let state = markRead(createInitialMessages(now), 'ALUNO', general(), now);
  assert.equal(unreadCount(state, 'ALUNO', general()), 0);
  state = addPost(state, { id: 'depois', viewer: 'PROFESSOR', channelId: general(), author: 'P', body: 'Novidade', important: false, now: now + 60_000 });
  assert.equal(unreadCount(state, 'ALUNO', general()), 1);
  assert.equal(authorRole('PROFESSOR'), 'DOCENTE');
});

test('conversas: cada perfil vê só as suas, da mais recente para a mais antiga, e a tutoria não conversa', () => {
  const state = createInitialMessages(now);
  const student = conversationsForViewer(state, 'ALUNO');
  const teacher = conversationsForViewer(state, 'PROFESSOR');
  const stamp = (id: string) => Date.parse(lastChatMessage(state, id)!.createdAt);
  assert.deepEqual(student.map((item) => item.id), ['conv-professora', 'conv-colega', 'conv-seminario'].sort((a, b) => stamp(b) - stamp(a)));
  assert.ok(teacher.some((item) => item.id === 'conv-falta'), 'a conversa de justificativa é só do docente');
  assert.ok(!student.some((item) => item.id === 'conv-falta'), 'o estudante não vê a conversa do docente com um colega');
  assert.deepEqual(conversationsForViewer(state, 'TUTOR'), []);
});

test('título da conversa: o outro participante em 1:1 e o título no grupo', () => {
  const state = createInitialMessages(now);
  const one = state.conversations.find((item) => item.id === 'conv-professora')!;
  const group = state.conversations.find((item) => item.id === 'conv-seminario')!;
  assert.match(conversationTitle(one, 'ALUNO'), /Helena/);
  assert.notEqual(conversationTitle(one, 'PROFESSOR'), conversationTitle(one, 'ALUNO'));
  assert.equal(conversationTitle(group, 'ALUNO'), 'Grupo do seminário');
  assert.equal(isGroup(group), true);
  assert.equal(isGroup(one), false);
});

test('não lidas da conversa: só o que outros escreveram, e abrir zera só aquela conversa', () => {
  let state = createInitialMessages(now);
  const before = chatUnread(state, 'ALUNO', 'conv-professora');
  assert.ok(before > 0);
  state = sendChat(state, { id: 'mine', viewer: 'ALUNO', conversationId: 'conv-professora', author: 'A', body: 'Obrigada!', now });
  assert.equal(chatUnread(state, 'ALUNO', 'conv-professora'), before, 'a própria mensagem não conta');
  assert.ok(chatUnread(state, 'PROFESSOR', 'conv-professora') > 0, 'mas é novidade para o docente');
  const next = markRead(state, 'ALUNO', 'conv-professora', now + 1000);
  assert.equal(chatUnread(next, 'ALUNO', 'conv-professora'), 0);
  assert.equal(chatUnread(next, 'ALUNO', 'conv-colega'), chatUnread(state, 'ALUNO', 'conv-colega'));
  assert.ok(totalUnread(next, 'ALUNO') < totalUnread(state, 'ALUNO'), 'o total soma canais e conversas');
});

test('envio na conversa: só participante, texto ou anexo, e limite de tamanho', () => {
  const state = createInitialMessages(now);
  const base = { id: 'x', viewer: 'ALUNO' as const, conversationId: 'conv-professora', author: 'A', now };
  assert.throws(() => sendChat(state, { ...base, body: '   ' }), /Escreva uma mensagem/);
  assert.throws(() => sendChat(state, { ...base, conversationId: 'conv-falta', body: 'oi' }), /Conversa não encontrada/, 'o estudante não escreve em conversa alheia');
  assert.throws(() => sendChat(state, { ...base, body: 'a'.repeat(maxMessageLength + 1) }), /até 2000/);
  assert.throws(() => sendChat(state, { ...base, viewer: 'TUTOR', body: 'oi' }), /tutoria/);
  const withFile = sendChat(state, { ...base, body: '', attachment: 'trabalho.pdf' });
  assert.equal(withFile.chat.at(-1)?.attachment, 'trabalho.pdf', 'anexo sem texto é permitido');
  assert.equal(conversationMessages(withFile, 'conv-professora').at(-1)?.id, 'x');
  assert.equal(state.chat.length + 1, withFile.chat.length, 'o estado anterior não muda');
});

test('curtir alterna por perfil, em mensagem, publicação e resposta', () => {
  let state = createInitialMessages(now);
  state = toggleLike(state, 'ALUNO', { kind: 'chat', id: 'c4' });
  assert.deepEqual(state.chat.find((item) => item.id === 'c4')?.likes, ['ALUNO']);
  state = toggleLike(state, 'PROFESSOR', { kind: 'chat', id: 'c4' });
  assert.equal(state.chat.find((item) => item.id === 'c4')?.likes.length, 2);
  state = toggleLike(state, 'ALUNO', { kind: 'chat', id: 'c4' });
  assert.deepEqual(state.chat.find((item) => item.id === 'c4')?.likes, ['PROFESSOR'], 'curtir de novo desfaz só o do próprio perfil');
  state = toggleLike(state, 'ALUNO', { kind: 'post', id: 'p1' });
  assert.ok(state.posts.find((item) => item.id === 'p1')!.likes.includes('ALUNO'));
  state = toggleLike(state, 'ALUNO', { kind: 'reply', id: 'r1' });
  assert.ok(state.posts.find((item) => item.id === 'p1')!.replies.find((item) => item.id === 'r1')!.likes.includes('ALUNO'));
  assert.throws(() => toggleLike(state, 'ALUNO', { kind: 'chat', id: 'nao-existe' }), /não encontrada/);
  assert.throws(() => toggleLike(state, 'TUTOR', { kind: 'post', id: 'p1' }), /tutoria/);
});

test('prévia do canal usa a atividade mais recente, publicação ou resposta, e o anexo quando não há texto', () => {
  let state = createInitialMessages(now);
  const general = channelsForViewer('ALUNO')[0].id;
  assert.match(channelPreview(state, general)!.text, /Vale, peso 3/, 'a última resposta vence a publicação mais antiga');
  state = addReply(state, { id: 'anexo', viewer: 'ALUNO', postId: 'p1', author: 'A', body: '', attachment: 'duvida.pdf', now });
  assert.equal(channelPreview(state, general)!.text, 'Anexo: duvida.pdf');
  assert.equal(channelPreview(state, 'canal-vazio'), null);
  const posted = addPost(state, { id: 'pa', viewer: 'PROFESSOR', channelId: general, author: 'P', body: 'Com anexo', important: false, attachment: 'edital.pdf', now: now + 1000 });
  assert.equal(posted.posts.at(-1)?.attachment, 'edital.pdf');
});

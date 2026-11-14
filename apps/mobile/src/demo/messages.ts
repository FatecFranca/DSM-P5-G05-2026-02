// Mensagens da turma, SOMENTE na demonstração: dados fictícios em memória. A API não tem mensagens,
// e o app não mistura dados demonstrativos numa sessão real. Lógica pura, testável.
//
// Duas formas de conversar, como no Teams: CONVERSAS (1:1 e em grupo, balões) e CANAIS (publicações
// do docente por disciplina, com respostas numa thread).
import { demoStudentId, demoStudentSubjects, demoSubjects, demoTeacherClassIds } from './academic.ts';
import { demoClasses, demoStudents } from './data.ts';

export type MessageRole = 'DOCENTE' | 'ESTUDANTE';
export type ViewerRole = 'ALUNO' | 'PROFESSOR' | 'TUTOR';

export interface Channel { id: string; name: string; classId: string; course: string; className: string; subjectId: string | null }
export interface Reply { id: string; author: string; role: MessageRole; body: string; createdAt: string; attachment: string | null; likes: string[] }
export interface Post { id: string; channelId: string; author: string; role: MessageRole; body: string; createdAt: string; important: boolean; attachment: string | null; likes: string[]; replies: Reply[] }

export interface Participant { key: string; name: string; role: MessageRole }
export interface Conversation { id: string; title: string | null; participants: Participant[] }
export interface ChatMessage { id: string; conversationId: string; authorKey: string; author: string; body: string; createdAt: string; attachment: string | null; likes: string[] }

export interface MessagesState { posts: Post[]; conversations: Conversation[]; chat: ChatMessage[]; readAt: Record<string, string> }

export const demoTeacherName = 'Profa. Helena Duarte';
export const maxMessageLength = 2000;

const demoStudent = demoStudents.find((student) => student.id === demoStudentId)!;

/** Chave de quem está lendo: é a mesma usada em participantes e curtidas. */
export const viewerKey = (viewer: ViewerRole) => viewer;
export const authorRole = (viewer: ViewerRole): MessageRole => viewer === 'ALUNO' ? 'ESTUDANTE' : 'DOCENTE';
/** Só o docente publica nos canais. A tutoria acompanha em leitura, como no resto da demonstração. */
export const canPost = (viewer: ViewerRole) => viewer === 'PROFESSOR';
export const canReply = (viewer: ViewerRole) => viewer !== 'TUTOR';
export const canChat = (viewer: ViewerRole) => viewer !== 'TUTOR';

// ---------------------------------------------------------------- canais

/** Um canal "Geral" por turma e um por disciplina, como os canais de uma equipe. */
export function channelsForClass(classId: string): Channel[] {
  const klass = demoClasses.find((item) => item.id === classId);
  const course = klass?.course ?? '';
  const className = klass?.name ?? '';
  return [
    { id: `${classId}:geral`, name: 'Geral', classId, course, className, subjectId: null },
    ...demoSubjects.filter((subject) => subject.classId === classId).map((subject) => ({ id: `${classId}:${subject.id}`, name: subject.title, classId, course, className, subjectId: subject.id })),
  ];
}

/** O estudante vê a própria turma; docência e tutoria veem as turmas vinculadas. */
export function channelsForViewer(viewer: ViewerRole): Channel[] {
  const classIds = viewer === 'ALUNO' ? [demoStudent.classId] : demoTeacherClassIds;
  return classIds.flatMap(channelsForClass);
}

// ---------------------------------------------------------------- dados iniciais

const hoursAgo = (now: number, hours: number) => new Date(now - hours * 3_600_000).toISOString();

export function createInitialMessages(now: number): MessagesState {
  const classId = demoStudent.classId;
  const mates = demoStudents.filter((student) => student.classId === classId && student.id !== demoStudentId);
  const otherClass = demoTeacherClassIds.find((id) => id !== classId);
  const mate = (index: number): Participant => ({ key: `aluno:${mates[index]?.id ?? index}`, name: mates[index]?.name ?? `Colega ${index + 1}`, role: 'ESTUDANTE' });
  const me: Participant = { key: 'ALUNO', name: demoStudent.name, role: 'ESTUDANTE' };
  const teacher: Participant = { key: 'PROFESSOR', name: demoTeacherName, role: 'DOCENTE' };

  // ---- canais
  const post = (id: string, channelId: string, body: string, hours: number, options: { important?: boolean; attachment?: string; likes?: string[]; replies?: Reply[] } = {}): Post =>
    ({ id, channelId, author: demoTeacherName, role: 'DOCENTE', body, createdAt: hoursAgo(now, hours), important: options.important ?? false, attachment: options.attachment ?? null, likes: options.likes ?? [], replies: options.replies ?? [] });
  const reply = (id: string, who: Participant, body: string, hours: number, likes: string[] = []): Reply =>
    ({ id, author: who.name, role: who.role, body, createdAt: hoursAgo(now, hours), attachment: null, likes });
  const algoritmos = demoStudentSubjects.find((subject) => subject.id === 'algoritmos')?.id;
  const banco = demoStudentSubjects.find((subject) => subject.id === 'banco-dados')?.id;

  // ---- conversas
  const line = (id: string, conversationId: string, who: Participant, body: string, hours: number, options: { attachment?: string; likes?: string[] } = {}): ChatMessage =>
    ({ id, conversationId, authorKey: who.key, author: who.name, body, createdAt: hoursAgo(now, hours), attachment: options.attachment ?? null, likes: options.likes ?? [] });

  return {
    readAt: {},
    posts: [
      post('p1', `${classId}:geral`, 'Bem-vindos ao semestre. O calendário de avaliações já está no painel de cada disciplina. Dúvidas sobre prazos podem ser respondidas aqui, para todo mundo ver.', 72, {
        important: true, likes: [mate(0).key, mate(1).key],
        replies: [reply('r1', mate(0), 'Professora, a Avaliação 2 vale peso 3 mesmo?', 70), reply('r2', teacher, 'Vale, peso 3, como está na disciplina.', 69, [mate(0).key])],
      }),
      ...(algoritmos ? [post('p2', `${classId}:${algoritmos}`, 'A lista de exercícios 1 já está disponível. Resolvam as questões 1 a 10 antes da aula de quinta.', 20, { attachment: 'lista-exercicios-1.pdf' })] : []),
      ...(banco ? [post('p3', `${classId}:${banco}`, 'Para o estudo de caso, modelem primeiro as entidades e só depois as relações. Tragam o diagrama rascunhado na próxima aula.', 5, { replies: [reply('r3', mate(1), 'Pode ser feito à mão e fotografado?', 3)] })] : []),
      ...(otherClass ? [post('p4', `${otherClass}:geral`, 'Os seminários serão na próxima semana. Montem os grupos até sexta e avisem aqui os integrantes.', 30, { important: true })] : []),
    ],
    conversations: [
      { id: 'conv-professora', title: null, participants: [me, teacher] },
      { id: 'conv-colega', title: null, participants: [me, mate(0)] },
      { id: 'conv-seminario', title: 'Grupo do seminário', participants: [me, mate(0), mate(1)] },
      { id: 'conv-falta', title: null, participants: [teacher, mate(2)] },
    ],
    chat: [
      line('c1', 'conv-professora', me, 'Professora, posso entregar a lista 1 até sexta? Tenho uma prova amanhã em outra matéria.', 30),
      line('c2', 'conv-professora', teacher, 'Pode entregar até sexta, sem penalidade. Combinado?', 28),
      line('c3', 'conv-professora', me, 'Combinado, obrigada!', 27),
      line('c4', 'conv-professora', teacher, 'Aproveite para rever a questão 7 antes de enviar.', 2),
      line('c5', 'conv-colega', mate(0), 'Bora estudar para a Avaliação 2 amanhã na biblioteca?', 6),
      line('c6', 'conv-colega', mate(0), 'Levo as minhas anotações da aula 2.', 5),
      line('c7', 'conv-seminario', mate(1), 'Subi os slides na pasta do grupo.', 20, { attachment: 'slides-seminario.pdf', likes: [me.key] }),
      line('c8', 'conv-seminario', me, 'Vi! Ajusto a introdução hoje.', 18),
      line('c9', 'conv-seminario', mate(0), 'Perfeito.', 17),
      line('c10', 'conv-falta', mate(2), 'Professora, tive consulta médica na terça. Como justifico a falta?', 4),
    ],
  };
}

// ---------------------------------------------------------------- leitura / não lidos

const readKey = (viewer: ViewerRole, id: string) => `${viewer}:${id}`;

/** Quando este canal ou conversa foi aberto pela última vez por este perfil (ou `null` se nunca). */
export const lastRead = (state: MessagesState, viewer: ViewerRole, id: string) => state.readAt[readKey(viewer, id)] ?? null;

function isNewSince(since: string | null, iso: string) {
  return since === null || Date.parse(iso) > Date.parse(since);
}

/** Novas publicações e respostas de OUTROS papéis desde a última leitura do canal. O que a própria pessoa escreveu nunca conta. */
export function unreadCount(state: MessagesState, viewer: ViewerRole, channelId: string): number {
  const since = lastRead(state, viewer, channelId);
  const mine = authorRole(viewer);
  return state.posts.filter((post) => post.channelId === channelId).reduce((sum, post) =>
    sum + (post.role !== mine && isNewSince(since, post.createdAt) ? 1 : 0) + post.replies.filter((entry) => entry.role !== mine && isNewSince(since, entry.createdAt)).length, 0);
}

/** Mensagens de outras pessoas na conversa desde a última leitura. */
export function chatUnread(state: MessagesState, viewer: ViewerRole, conversationId: string): number {
  const since = lastRead(state, viewer, conversationId);
  return state.chat.filter((message) => message.conversationId === conversationId && message.authorKey !== viewerKey(viewer) && isNewSince(since, message.createdAt)).length;
}

export function markRead(state: MessagesState, viewer: ViewerRole, id: string, now: number): MessagesState {
  return { ...state, readAt: { ...state.readAt, [readKey(viewer, id)]: new Date(now).toISOString() } };
}

// ---------------------------------------------------------------- conversas

export const participates = (conversation: Conversation, viewer: ViewerRole) => conversation.participants.some((person) => person.key === viewerKey(viewer));

export function conversationMessages(state: MessagesState, conversationId: string): ChatMessage[] {
  return state.chat.filter((message) => message.conversationId === conversationId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export const lastChatMessage = (state: MessagesState, conversationId: string): ChatMessage | null => conversationMessages(state, conversationId).at(-1) ?? null;

/** Conversas do perfil, da mais recente para a mais antiga. A tutoria não conversa. */
export function conversationsForViewer(state: MessagesState, viewer: ViewerRole): Conversation[] {
  if (!canChat(viewer)) return [];
  const stamp = (conversation: Conversation) => Date.parse(lastChatMessage(state, conversation.id)?.createdAt ?? '1970-01-01T00:00:00Z');
  return state.conversations.filter((conversation) => participates(conversation, viewer)).sort((a, b) => stamp(b) - stamp(a));
}

/** Em conversa de duas pessoas, o nome é o do outro; em grupo, o título. */
export function conversationTitle(conversation: Conversation, viewer: ViewerRole): string {
  if (conversation.title) return conversation.title;
  return conversation.participants.find((person) => person.key !== viewerKey(viewer))?.name ?? 'Conversa';
}

export const isGroup = (conversation: Conversation) => conversation.participants.length > 2;

// ---------------------------------------------------------------- canais: prévia

/** Última atividade do canal (publicação ou resposta), para a prévia na lista. */
export function channelPreview(state: MessagesState, channelId: string): { author: string; text: string; createdAt: string } | null {
  const entries = state.posts.filter((post) => post.channelId === channelId).flatMap((post) => [
    { author: post.author, body: post.body, attachment: post.attachment, createdAt: post.createdAt },
    ...post.replies.map((entry) => ({ author: entry.author, body: entry.body, attachment: entry.attachment, createdAt: entry.createdAt })),
  ]);
  const last = entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return last ? { author: last.author, text: last.body || (last.attachment ? `Anexo: ${last.attachment}` : ''), createdAt: last.createdAt } : null;
}

export const totalUnread = (state: MessagesState, viewer: ViewerRole) =>
  channelsForViewer(viewer).reduce((sum, channel) => sum + unreadCount(state, viewer, channel.id), 0)
  + conversationsForViewer(state, viewer).reduce((sum, conversation) => sum + chatUnread(state, viewer, conversation.id), 0);

// ---------------------------------------------------------------- escrita

function cleanBody(body: string, attachment: string | null, bodyRequired: boolean) {
  const text = body.trim();
  if (!text && (bodyRequired || !attachment)) throw new Error('Escreva uma mensagem antes de enviar.');
  if (text.length > maxMessageLength) throw new Error(`A mensagem deve ter até ${maxMessageLength} caracteres.`);
  return text;
}

export function addPost(state: MessagesState, input: { id: string; viewer: ViewerRole; channelId: string; author: string; body: string; important: boolean; attachment?: string | null; now: number }): MessagesState {
  if (!canPost(input.viewer)) throw new Error('Somente docentes publicam nos canais.');
  if (!channelsForViewer(input.viewer).some((channel) => channel.id === input.channelId)) throw new Error('Canal fora das suas turmas.');
  const post: Post = { id: input.id, channelId: input.channelId, author: input.author, role: 'DOCENTE', body: cleanBody(input.body, input.attachment ?? null, true), createdAt: new Date(input.now).toISOString(), important: input.important, attachment: input.attachment ?? null, likes: [], replies: [] };
  return { ...state, posts: [...state.posts, post] };
}

export function addReply(state: MessagesState, input: { id: string; viewer: ViewerRole; postId: string; author: string; body: string; attachment?: string | null; now: number }): MessagesState {
  if (!canReply(input.viewer)) throw new Error('A tutoria acompanha em leitura e não responde.');
  const post = state.posts.find((item) => item.id === input.postId);
  if (!post) throw new Error('Publicação não encontrada.');
  if (!channelsForViewer(input.viewer).some((channel) => channel.id === post.channelId)) throw new Error('Canal fora das suas turmas.');
  const entry: Reply = { id: input.id, author: input.author, role: authorRole(input.viewer), body: cleanBody(input.body, input.attachment ?? null, false), createdAt: new Date(input.now).toISOString(), attachment: input.attachment ?? null, likes: [] };
  return { ...state, posts: state.posts.map((item) => item.id === post.id ? { ...item, replies: [...item.replies, entry] } : item) };
}

/** Mensagem numa conversa. Só participantes escrevem; texto vazio só passa com anexo. */
export function sendChat(state: MessagesState, input: { id: string; viewer: ViewerRole; conversationId: string; author: string; body: string; attachment?: string | null; now: number }): MessagesState {
  if (!canChat(input.viewer)) throw new Error('A tutoria acompanha em leitura e não conversa.');
  const conversation = state.conversations.find((item) => item.id === input.conversationId);
  if (!conversation || !participates(conversation, input.viewer)) throw new Error('Conversa não encontrada.');
  const message: ChatMessage = { id: input.id, conversationId: conversation.id, authorKey: viewerKey(input.viewer), author: input.author, body: cleanBody(input.body, input.attachment ?? null, false), createdAt: new Date(input.now).toISOString(), attachment: input.attachment ?? null, likes: [] };
  return { ...state, chat: [...state.chat, message] };
}

export type LikeTarget = { kind: 'chat' | 'post' | 'reply'; id: string };

const flip = (likes: string[], key: string) => likes.includes(key) ? likes.filter((item) => item !== key) : [...likes, key];

/** Curtir ou descurtir. Cada perfil conta uma vez; a tutoria só lê. */
export function toggleLike(state: MessagesState, viewer: ViewerRole, target: LikeTarget): MessagesState {
  if (!canChat(viewer)) throw new Error('A tutoria acompanha em leitura e não reage.');
  const key = viewerKey(viewer);
  if (target.kind === 'chat') {
    if (!state.chat.some((message) => message.id === target.id)) throw new Error('Mensagem não encontrada.');
    return { ...state, chat: state.chat.map((message) => message.id === target.id ? { ...message, likes: flip(message.likes, key) } : message) };
  }
  const found = state.posts.some((post) => target.kind === 'post' ? post.id === target.id : post.replies.some((entry) => entry.id === target.id));
  if (!found) throw new Error('Mensagem não encontrada.');
  return { ...state, posts: state.posts.map((post) => target.kind === 'post'
    ? (post.id === target.id ? { ...post, likes: flip(post.likes, key) } : post)
    : { ...post, replies: post.replies.map((entry) => entry.id === target.id ? { ...entry, likes: flip(entry.likes, key) } : entry) }) };
}

import type { MlSchema } from '@/services/ml';

export const ML_FORM_GROUPS = [
  {
    title: 'Ingresso e curso',
    fields: [
      ['estado_civil', 'Estado civil'],
      ['modo_candidatura', 'Forma de ingresso'],
      ['ordem_candidatura', 'Ordem de preferência do curso'],
      ['curso', 'Curso na classificação do dataset'],
      ['periodo_aula', 'Turno das aulas'],
      ['qualif_anterior', 'Formação antes deste curso'],
      ['nota_qual_anterior', 'Nota da formação anterior (0 a 200)'],
      ['nota_admissao', 'Nota de ingresso (0 a 200)'],
      ['idade_matricula', 'Idade quando entrou no curso'],
    ],
  },
  {
    title: 'Perfil e situação familiar',
    fields: [
      ['nacionalidade', 'Nacionalidade'],
      ['qualif_mae', 'Escolaridade da mãe'],
      ['qualif_pai', 'Escolaridade do pai'],
      ['ocupacao_mae', 'Ocupação da mãe'],
      ['ocupacao_pai', 'Ocupação do pai'],
      ['deslocado', 'Estudante deslocado?'],
      ['necessidades_especiais', 'Necessidades educacionais especiais?'],
      ['devedor', 'Possui dívida?'],
      ['mensalidade_em_dia', 'Mensalidade em dia?'],
      ['genero', 'Gênero conforme a classificação do dataset'],
      ['bolsista', 'Recebe bolsa?'],
      ['internacional', 'Estudante internacional?'],
    ],
  },
  {
    title: '1º semestre',
    fields: [
      ['ucs_1sem_creditadas', 'Disciplinas aproveitadas'],
      ['ucs_1sem_matriculadas', 'Disciplinas matriculadas'],
      ['ucs_1sem_avaliacoes', 'Avaliações realizadas no total'],
      ['ucs_1sem_aprovadas', 'Disciplinas aprovadas'],
      ['ucs_1sem_nota', 'Média final das disciplinas (0 a 20)'],
      ['ucs_1sem_sem_aval', 'Disciplinas sem avaliação'],
    ],
  },
  {
    title: '2º semestre',
    fields: [
      ['ucs_2sem_creditadas', 'Disciplinas aproveitadas'],
      ['ucs_2sem_matriculadas', 'Disciplinas matriculadas'],
      ['ucs_2sem_avaliacoes', 'Avaliações realizadas no total'],
      ['ucs_2sem_aprovadas', 'Disciplinas aprovadas'],
      ['ucs_2sem_nota', 'Média final das disciplinas (0 a 20)'],
      ['ucs_2sem_sem_aval', 'Disciplinas sem avaliação'],
    ],
  },
  {
    title: 'Contexto econômico do período',
    fields: [
      ['desemprego', 'Taxa de desemprego (%)'],
      ['inflacao', 'Taxa de inflação (%)'],
      ['pib', 'Variação do PIB (%)'],
    ],
  },
] as const;

// Rótulos dos códigos originais do dataset UCI 697; o schema da API limita as opções válidas.
const EDUCATION_LABELS: Record<number, string> = {
  1: 'Ensino médio', 2: 'Bacharelado', 3: 'Graduação', 4: 'Mestrado', 5: 'Doutorado',
  6: 'Frequência no ensino superior', 9: '12º ano incompleto', 10: '11º ano incompleto',
  11: '7º ano (antigo)', 12: 'Outra formação de 11º ano', 14: '10º ano',
  18: 'Curso geral de comércio', 19: 'Ensino básico, 3º ciclo', 22: 'Curso técnico profissional',
  26: '7º ano', 27: '2º ciclo do ensino secundário', 29: '9º ano incompleto',
  30: '8º ano', 34: 'Desconhecida', 35: 'Não sabe ler ou escrever',
  36: 'Lê sem concluir o 4º ano', 37: 'Ensino básico, 1º ciclo',
  38: 'Ensino básico, 2º ciclo', 39: 'Especialização tecnológica',
  40: 'Graduação, 1º ciclo', 41: 'Estudos superiores especializados',
  42: 'Curso técnico superior profissional', 43: 'Mestrado, 2º ciclo',
  44: 'Doutorado, 3º ciclo',
};

const OCCUPATION_LABELS: Record<number, string> = {
  0: 'Estudante', 1: 'Direção e gestão', 2: 'Profissões científicas e intelectuais',
  3: 'Profissões técnicas de nível médio', 4: 'Trabalho administrativo',
  5: 'Serviços pessoais, segurança e vendas', 6: 'Agricultura, pesca e florestas',
  7: 'Indústria, construção e artesanato', 8: 'Operação de máquinas e montagem',
  9: 'Trabalho não qualificado', 10: 'Forças Armadas', 90: 'Outra situação',
  99: 'Sem ocupação informada no dataset', 122: 'Profissional de saúde',
  123: 'Professor(a)', 131: 'Técnico(a) de ciência ou engenharia',
  132: 'Técnico(a) de saúde', 134: 'Técnico(a) de serviços jurídicos, sociais ou culturais',
  141: 'Escritório, secretaria ou processamento de dados',
  143: 'Contabilidade, finanças ou registros', 144: 'Outro apoio administrativo',
  151: 'Serviços pessoais', 152: 'Vendas', 153: 'Cuidados pessoais',
  171: 'Construção civil', 175: 'Alimentos, madeira, vestuário ou artesanato',
  192: 'Trabalho não qualificado na agricultura ou pesca',
  193: 'Trabalho não qualificado na indústria ou transporte',
  194: 'Auxiliar no preparo de refeições',
};

const CATEGORY_LABELS: Record<string, Record<number, string>> = {
  estado_civil: { 1: 'Solteiro(a)', 2: 'Casado(a)', 3: 'Viúvo(a)', 4: 'Divorciado(a)', 5: 'União de fato', 6: 'Separado(a) legalmente' },
  periodo_aula: { 0: 'Noturno', 1: 'Diurno' },
  modo_candidatura: { 1: '1ª fase geral', 2: 'Regra portuguesa 612/93', 5: '1ª fase, Açores', 7: 'Titular de outro curso superior', 10: 'Regra portuguesa 854-B/99', 15: 'Ingresso internacional', 16: '1ª fase, Madeira', 17: '2ª fase geral', 18: '3ª fase geral', 26: 'Plano de estudos diferente', 27: 'Outra instituição', 39: 'Ingresso após 23 anos', 42: 'Transferência', 43: 'Mudança de curso', 44: 'Diploma de especialização tecnológica', 51: 'Mudança de instituição ou curso', 53: 'Diploma de ciclo curto', 57: 'Mudança de instituição ou curso internacional' },
  curso: { 33: 'Tecnologias de biocombustíveis', 171: 'Animação e multimídia', 8014: 'Serviço Social (noturno)', 9003: 'Agronomia', 9070: 'Design de comunicação', 9085: 'Enfermagem veterinária', 9119: 'Engenharia informática', 9130: 'Equinicultura', 9147: 'Gestão', 9238: 'Serviço Social', 9254: 'Turismo', 9500: 'Enfermagem', 9556: 'Higiene oral', 9670: 'Publicidade e marketing', 9773: 'Jornalismo e comunicação', 9853: 'Educação básica', 9991: 'Gestão (noturno)' },
  qualif_anterior: { 1: 'Ensino médio', 2: 'Bacharelado', 3: 'Graduação', 4: 'Mestrado', 5: 'Doutorado', 6: 'Frequência no ensino superior', 9: '12º ano incompleto', 10: '11º ano incompleto', 12: 'Outra formação de 11º ano', 14: '10º ano', 15: '10º ano incompleto', 19: 'Ensino básico, 3º ciclo', 38: 'Ensino básico, 2º ciclo', 39: 'Especialização tecnológica', 40: 'Graduação, 1º ciclo', 42: 'Curso técnico superior profissional', 43: 'Mestrado, 2º ciclo' },
  nacionalidade: { 1: 'Portuguesa', 2: 'Alemã', 6: 'Espanhola', 11: 'Italiana', 13: 'Neerlandesa', 17: 'Lituana', 21: 'Angolana', 22: 'Cabo-verdiana', 24: 'Guineense', 25: 'Moçambicana', 26: 'São-tomense', 41: 'Brasileira', 62: 'Romena', 100: 'Moldava', 101: 'Mexicana', 103: 'Ucraniana', 105: 'Russa', 109: 'Colombiana' },
  qualif_mae: EDUCATION_LABELS,
  qualif_pai: { ...EDUCATION_LABELS, 13: 'Ensino secundário complementar, 2º ano', 20: 'Ensino secundário complementar', 25: 'Ensino secundário complementar incompleto', 31: 'Administração e comércio', 33: 'Contabilidade e administração' },
  ocupacao_mae: { ...OCCUPATION_LABELS, 125: 'Tecnologia da informação e comunicação', 173: 'Impressão, precisão, joalheria ou artesanato', 191: 'Limpeza' },
  ocupacao_pai: { ...OCCUPATION_LABELS, 101: 'Oficial das Forças Armadas', 102: 'Sargento das Forças Armadas', 103: 'Outra função nas Forças Armadas', 112: 'Direção administrativa ou comercial', 114: 'Direção de hotelaria, comércio ou serviços', 121: 'Ciências físicas, matemática ou engenharia', 124: 'Finanças, contabilidade ou relações comerciais', 135: 'Técnico(a) de tecnologia da informação', 154: 'Proteção e segurança', 161: 'Agricultura ou pecuária comercial', 163: 'Agricultura, pesca ou caça de subsistência', 172: 'Metalurgia', 174: 'Eletricidade ou eletrônica', 181: 'Operação de instalações fixas', 182: 'Montagem', 183: 'Condução de veículos ou equipamentos móveis', 195: 'Vendas ambulantes ou serviços de rua' },
  genero: { 0: 'Feminino', 1: 'Masculino' },
};

const YES_NO = new Set(['deslocado', 'necessidades_especiais', 'devedor', 'mensalidade_em_dia', 'bolsista', 'internacional']);

export function mlOptions(name: string, schema: MlSchema): { id: string; label: string }[] | null {
  const values = schema.categories[name];
  if (!values) return null;
  return values.map((value) => ({
    id: String(value),
    label: YES_NO.has(name) ? (value === 1 ? 'Sim' : 'Não') :
      CATEGORY_LABELS[name]?.[value] ?? `Categoria ${value} do dataset`,
  }));
}

export function mlInputHint(name: string): string {
  if (name === 'ordem_candidatura') return '0 = primeira opção; 9 = última opção';
  if (name === 'idade_matricula') return 'Idade em anos completos';
  if (name === 'nota_admissao' || name === 'nota_qual_anterior') return 'Número de 0 a 200';
  if (name.endsWith('_nota')) return 'Média de 0 a 20; deixe vazio se não souber';
  if (name === 'desemprego' || name === 'inflacao' || name === 'pib') return 'Ex.: 10,8; sem o símbolo %';
  if (name.startsWith('ucs_')) return 'Número inteiro; deixe vazio se não souber';
  return 'Número inteiro, 0 quando a contagem é realmente zero';
}

const SEMESTER_HELP: Record<string, string> = {
  creditadas: 'Matérias dispensadas por aproveitamento ou equivalência. Informe 0 somente se o histórico confirmar que não houve nenhuma.',
  matriculadas: 'Matérias em que o aluno se matriculou neste semestre, mesmo que não tenha sido aprovado.',
  avaliacoes: 'Quantidade total de provas, trabalhos ou outras avaliações registradas nas matérias do semestre. Não é a quantidade de matérias.',
  aprovadas: 'Matérias concluídas com aprovação neste semestre.',
  nota: 'Média das notas finais das matérias, na escala original portuguesa de 0 a 20. Não insira diretamente uma nota da Fatec de 0 a 10.',
  sem_aval: 'Matérias matriculadas que terminaram o semestre sem nenhuma avaliação registrada.',
};

export function mlFieldHelp(name: string): string | null {
  const match = /^ucs_[12]sem_(.+)$/.exec(name);
  return match ? SEMESTER_HELP[match[1]] ?? null : null;
}

export function mlSemesterChoiceLabel(name: string, value: string): string {
  if (!value.trim()) return 'Selecionar valor';
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number)) return 'Selecionar valor';
  const formatted = String(number).replace('.', ',');
  if (name.endsWith('_nota')) return `${formatted} de 20`;
  if (name.endsWith('_avaliacoes')) return `${formatted} ${number === 1 ? 'avaliação' : 'avaliações'}`;
  return `${formatted} ${number === 1 ? 'disciplina' : 'disciplinas'}`;
}

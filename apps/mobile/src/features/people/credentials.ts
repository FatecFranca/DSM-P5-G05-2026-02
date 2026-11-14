// Cadastro de pessoas: tipos das respostas da API e a planilha de senhas temporárias que a coordenação
// guarda ou entrega. Sem e-mail no sistema, esta é a única forma de a pessoa receber a senha inicial.

export interface ImportSummary {
  linhas: number;
  usuariosNovos: number;
  usuariosExistentes: number;
  matriculasNovas: number;
  matriculasExistentes: number;
}

export interface Credential {
  linha: number;
  nome: string;
  email: string;
  registro: string | null;
  senhaTemporaria: string;
}

export interface PeopleImportResult {
  simulacao: boolean;
  resumo: ImportSummary;
  credenciais: Credential[];
}

export interface ProblemList {
  headline: string;
  items: { where: string; text: string }[];
}

/**
 * A API devolve os problemas da planilha como linhas "Linha N: ..." depois de uma frase-resumo. Separa
 * a frase do resto para a tela mostrar a lista, com a linha da planilha em destaque.
 */
export function splitProblems(message: string): ProblemList {
  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean);
  const isRow = (line: string) => /^Linha \d+: /.test(line);
  const headline = lines.length && !isRow(lines[0]) ? lines[0] : '';
  const items = (headline ? lines.slice(1) : lines).map((line) => {
    const match = /^(Linha \d+): (.*)$/.exec(line);
    return match ? { where: match[1], text: match[2] } : { where: '', text: line };
  });
  return { headline, items };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Linhas de resumo para a conferência (antes de gravar) e para o resultado. */
export function summaryLines(summary: ImportSummary, enrollments: boolean): string[] {
  const lines = [
    plural(summary.usuariosNovos, 'conta nova', 'contas novas'),
    plural(summary.usuariosExistentes, 'pessoa já cadastrada (mantém a senha)', 'pessoas já cadastradas (mantêm a senha)'),
  ];
  if (enrollments) {
    lines.push(
      plural(summary.matriculasNovas, 'matrícula nova', 'matrículas novas'),
      plural(summary.matriculasExistentes, 'matrícula já existente', 'matrículas já existentes'),
    );
  }
  return lines;
}

/** Texto que começa com = + - @ vira fórmula no Excel: o apóstrofo o mantém como texto. */
const neutralize = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const cell = (value: string) => {
  const text = neutralize(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV com ponto e vírgula e BOM, que o Excel em português abre com acentos corretos. */
export function credentialsCsv(items: Credential[]): string {
  const rows = [
    ['Nome', 'E-mail', 'Registro', 'Senha temporária'],
    ...items.map((item) => [item.nome, item.email, item.registro ?? '', item.senhaTemporaria]),
  ];
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}

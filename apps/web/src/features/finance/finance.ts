export interface Enrollment { id: string; registro: string; aluno: { nome: string }; turma: { id: string; curso: string; duracaoSemestres: number } }
export interface Invoice { id: string; competencia: string; semestre: number | null; vencimento: string; valorCentavos: number; pagoCentavos: number; situacao: 'ABERTA' | 'VENCIDA' | 'QUITADA' }
export interface Semester { semestre: number; situacao: string; devidoCentavos: number; pagoCentavos: number; saldoCentavos: number }
export interface Plan { inicioCompetencia: string; fimCompetencia: string | null; proximaCompetencia: string; valorCentavos: number; diaVencimento: number; ativo: boolean }
export interface Scholarship { inicio: string; fim: string | null; ativa: boolean; vigente: boolean }
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function parseMoney(input: string): number {
  const match = /^(\d{1,7})(?:[,.](\d{1,2}))?$/.exec(input.trim());
  if (!match) throw new Error('Informe reais sem separador de milhar e com até duas casas decimais.');
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (cents < 1 || cents > 100_000_000) throw new Error('Informe um valor entre R$ 0,01 e R$ 1.000.000,00.');
  return cents;
}
export function paymentBody(amount: string, reference: string, balance: number) {
  const valorCentavos = parseMoney(amount);
  if (valorCentavos > balance) throw new Error('O pagamento não pode ultrapassar o saldo da fatura.');
  const referencia = reference.trim();
  if (referencia.length < 8 || referencia.length > 100) throw new Error('A referência do comprovante deve ter entre 8 e 100 caracteres.');
  return { valorCentavos, referencia };
}

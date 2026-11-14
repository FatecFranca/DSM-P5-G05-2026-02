export function parseMoneyToCents(input: string): number {
  const value = input.trim();
  const match = /^(\d{1,7})(?:[,.](\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Informe o valor em reais com até duas casas decimais.');
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (cents < 1 || cents > 100_000_000) throw new Error('Valor fora do limite permitido.');
  return cents;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

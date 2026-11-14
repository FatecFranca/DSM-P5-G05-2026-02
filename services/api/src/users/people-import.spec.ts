import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  PEOPLE_IMPORT_LIMIT,
  createPeopleTemplate,
  parsePeopleWorkbook,
} from './people-import';

type Cell = string | number | { text: string; hyperlink: string } | null;

/** Monta um XLSX em memória: primeira linha = cabeçalho. */
async function sheet(rows: Cell[][], name = 'Importacao') {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(name);
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const STUDENT_HEADER = [
  'Registro (matrícula)',
  'Nome do aluno',
  'E-mail do aluno',
  'Turma',
  'Curso da turma',
  'Período da turma',
];

describe('cadastro de pessoas por planilha', () => {
  it('lê alunos pelo título das colunas', async () => {
    const buffer = await sheet([
      STUDENT_HEADER,
      ['2026001', 'Ana Lima', 'Ana@Escola.edu', 'ADS 1', 'ADS', '2026/2'],
      ['2026002', 'Beto Souza', 'beto@escola.edu', 'ADS 1', 'ADS', '2026/2'],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      linha: 2,
      nome: 'Ana Lima',
      email: 'ana@escola.edu',
      registro: '2026001',
      turma: { nome: 'ADS 1', curso: 'ADS', periodo: '2026/2' },
    });
  });

  it('aceita a planilha do importador de previsões: colunas extras são ignoradas', async () => {
    const buffer = await sheet([
      [
        ...STUDENT_HEADER,
        'Disciplina',
        'E-mail do professor',
        'Versão do perfil',
        'Estado civil',
        'Forma de ingresso',
      ],
      [
        'EXEMPLO-2026-001',
        'Aluno Exemplo 01',
        'aluno01@example.invalid',
        'Turma demonstrativa',
        'Curso demonstrativo',
        '2026/2',
        'Fundamentos de programação (demonstração)',
        'professor.demo@sgei.example',
        0,
        'Solteiro(a)',
        '1ª fase: seleção geral',
      ],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('aluno01@example.invalid');
  });

  it('ignora acentos, maiúsculas e a ordem das colunas no cabeçalho', async () => {
    const buffer = await sheet([
      [
        'E-MAIL DO ALUNO',
        'periodo da turma',
        'NOME DO ALUNO',
        'registro (matricula)',
        'curso da turma',
        'turma',
      ],
      ['a@escola.edu', '2026/2', 'Ana Lima', 'R1', 'ADS', 'ADS 1'],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ nome: 'Ana Lima', registro: 'R1' });
  });

  it('lê e-mail em hiperlink (o Excel transforma e-mails em link) e matrícula numérica', async () => {
    const buffer = await sheet([
      STUDENT_HEADER,
      [
        12345,
        'Ana Lima',
        { text: 'ana@escola.edu', hyperlink: 'mailto:ana@escola.edu' },
        'ADS 1',
        'ADS',
        '2026/2',
      ],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      email: 'ana@escola.edu',
      registro: '12345',
    });
  });

  it('turma vazia cria só a conta, sem exigir registro', async () => {
    const buffer = await sheet([
      STUDENT_HEADER,
      [null, 'Ana Lima', 'ana@escola.edu', null, null, null],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([]);
    expect(rows[0].turma).toBeUndefined();
    expect(rows[0].registro).toBeUndefined();
  });

  it('aponta cada problema com o número da linha', async () => {
    const buffer = await sheet([
      STUDENT_HEADER,
      ['R1', 'A', 'a@escola.edu', 'T', 'C', '2026/2'],
      ['R2', 'Beto Souza', 'nao-e-email', 'T', 'C', '2026/2'],
      ['R3', 'Caio Lima', 'caio@escola.edu', 'T', null, '2026/2'],
      [null, 'Duda Lima', 'duda@escola.edu', 'T', 'C', '2026/2'],
      ['R1', 'Eva Lima', 'eva@escola.edu', 'T', 'C', '2026/2'],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(rows).toHaveLength(0);
    expect(errors).toEqual([
      expect.stringMatching(/^Linha 2: nome/),
      expect.stringMatching(/^Linha 3: e-mail inválido/),
      expect.stringMatching(/^Linha 4: informe turma, curso e período juntos/),
      expect.stringMatching(/^Linha 5: registro \(matrícula\) é obrigatório/),
      expect.stringMatching(/^Linha 6: registro repetido/),
    ]);
  });

  it('recusa o mesmo e-mail com nomes diferentes e a mesma pessoa duas vezes na turma', async () => {
    const buffer = await sheet([
      STUDENT_HEADER,
      ['R1', 'Ana Lima', 'ana@escola.edu', 'T', 'C', '2026/2'],
      ['R2', 'Outra Pessoa', 'ana@escola.edu', 'T2', 'C', '2026/2'],
      ['R3', 'Ana Lima', 'ana@escola.edu', 'T', 'C', '2026/2'],
    ]);
    const { errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([
      expect.stringMatching(
        /^Linha 3: o mesmo e-mail aparece com nomes diferentes/,
      ),
      expect.stringMatching(/^Linha 4: pessoa repetida na mesma turma/),
    ]);
  });

  it('a mesma pessoa pode estar em turmas diferentes', async () => {
    const buffer = await sheet([
      STUDENT_HEADER,
      ['R1', 'Ana Lima', 'ana@escola.edu', 'T1', 'C', '2026/2'],
      ['R2', 'ana  lima', 'ana@escola.edu', 'T2', 'C', '2026/2'],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'ALUNO');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('lê professores pelo nome e e-mail', async () => {
    const buffer = await sheet([
      ['Nome do professor', 'E-mail do professor'],
      ['Marina Souza', 'marina@escola.edu'],
    ]);
    const { rows, errors } = await parsePeopleWorkbook(buffer, 'PROFESSOR');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        linha: 2,
        nome: 'Marina Souza',
        email: 'marina@escola.edu',
        registro: undefined,
        turma: undefined,
      },
    ]);
  });

  it('informa as colunas obrigatórias que faltam', async () => {
    const buffer = await sheet([
      ['Nome do aluno', 'Turma'],
      ['Ana', 'T'],
    ]);
    await expect(parsePeopleWorkbook(buffer, 'ALUNO')).rejects.toThrow(
      /E-mail do aluno, Registro \(matrícula\)/,
    );
  });

  it('recusa arquivo que não é XLSX e planilha sem linhas', async () => {
    await expect(
      parsePeopleWorkbook(Buffer.from('a;b\n1;2'), 'ALUNO'),
    ).rejects.toThrow(BadRequestException);
    const empty = await sheet([STUDENT_HEADER]);
    await expect(parsePeopleWorkbook(empty, 'ALUNO')).rejects.toThrow(
      /nenhuma linha/,
    );
  });

  it(`aceita até ${PEOPLE_IMPORT_LIMIT} linhas e recusa mais que isso`, async () => {
    const row = (index: number): Cell[] => [
      `R${index}`,
      `Pessoa ${index}`,
      `p${index}@escola.edu`,
      'T',
      'C',
      '2026/2',
    ];
    const ok = await sheet([
      STUDENT_HEADER,
      ...Array.from({ length: PEOPLE_IMPORT_LIMIT }, (_, i) => row(i)),
    ]);
    expect((await parsePeopleWorkbook(ok, 'ALUNO')).rows).toHaveLength(
      PEOPLE_IMPORT_LIMIT,
    );
    const tooMany = await sheet([
      STUDENT_HEADER,
      ...Array.from({ length: PEOPLE_IMPORT_LIMIT + 1 }, (_, i) => row(i)),
    ]);
    await expect(parsePeopleWorkbook(tooMany, 'ALUNO')).rejects.toThrow(
      /até 200 linhas/,
    );
  });

  it('o modelo gerado é lido de volta e não traz linha de exemplo para importar', async () => {
    for (const perfil of ['ALUNO', 'PROFESSOR'] as const) {
      const template = await createPeopleTemplate(perfil);
      await expect(parsePeopleWorkbook(template, perfil)).rejects.toThrow(
        /nenhuma linha/,
      );
    }
  });
});

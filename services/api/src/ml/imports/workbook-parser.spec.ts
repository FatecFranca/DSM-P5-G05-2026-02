import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  fatecDemoProfile,
  FATEC_DEMO_REGISTRATIONS,
} from '../fatec-demo-profile';
import { createImportTemplate, parseImportWorkbook } from './workbook-parser';
import { ML_FEATURES } from '../ml.types';
import { ML_CATEGORIES } from '../input-categories';
import { CATEGORY_LABELS, FEATURE_LABELS } from './feature-labels';

async function populatedTemplate(change?: (workbook: Workbook) => void) {
  const workbook = new Workbook();
  const file = await createImportTemplate();
  await workbook.xlsx.load(
    file as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const registro = FATEC_DEMO_REGISTRATIONS[0];
  workbook
    .getWorksheet('Importacao')!
    .addRow([
      registro,
      'Aluno Exemplo',
      'aluno@exemplo.edu.br',
      'Turma A',
      'Curso Teste',
      '2026-1',
      'Matemática',
      'professor@exemplo.edu.br',
      0,
      ...ML_FEATURES.map((name) => fatecDemoProfile(registro)[name]),
    ]);
  change?.(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('planilha de importação ML', () => {
  it('oferece descrições para todas as categorias aprendidas pelo modelo', () => {
    for (const [feature, codes] of Object.entries(ML_CATEGORIES)) {
      const labels = codes.map((code) => CATEGORY_LABELS[feature][code]);
      expect(
        labels.every((label) => typeof label === 'string' && label.length > 0),
      ).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('converte opções textuais da planilha para os códigos originais', async () => {
    expect((await createImportTemplate()).length).toBeLessThan(1024 * 1024);
    const file = await populatedTemplate((workbook) => {
      const sheet = workbook.getWorksheet('Importacao')!;
      for (const [index, name] of ML_FEATURES.entries()) {
        if (ML_CATEGORIES[name]) {
          const code = fatecDemoProfile(FATEC_DEMO_REGISTRATIONS[0])[name];
          sheet.getCell(2, index + 10).value = CATEGORY_LABELS[name][code];
        }
      }
    });
    const rows = await parseImportWorkbook(file);
    expect(rows[0].features).toEqual(
      fatecDemoProfile(FATEC_DEMO_REGISTRATIONS[0]),
    );
    const template = new Workbook();
    await template.xlsx.load(
      (await createImportTemplate()) as unknown as Parameters<
        typeof template.xlsx.load
      >[0],
    );
    expect(template.getWorksheet('Importacao')!.getCell('J1').value).toBe(
      FEATURE_LABELS.estado_civil,
    );
    expect(
      template.getWorksheet('Importacao')!.getCell('J2').dataValidation.type,
    ).toBe('list');
    expect(
      template.definedNames.getRanges('Lista_estado_civil').ranges,
    ).toContain('Opcoes!$A$2:$A$7');
    expect(template.getWorksheet('Opcoes')!.getCell('A2').value).toBe(
      'Solteiro(a)',
    );
  });

  it('mantém a importação de planilhas antigas com cabeçalhos técnicos', async () => {
    const file = await populatedTemplate((workbook) => {
      const legacy = [
        'registro',
        'alunoNome',
        'alunoEmail',
        'turmaNome',
        'turmaCurso',
        'turmaPeriodo',
        'disciplinaNome',
        'professorEmail',
        'versaoPerfil',
        ...ML_FEATURES,
      ];
      legacy.forEach((name, index) => {
        workbook.getWorksheet('Importacao')!.getCell(1, index + 1).value = name;
      });
    });
    expect(await parseImportWorkbook(file)).toHaveLength(1);
  });

  it('identifica a coluna textual com opção desconhecida', async () => {
    const file = await populatedTemplate((workbook) => {
      workbook.getWorksheet('Importacao')!.getCell('J2').value =
        'Estado inexistente';
    });
    await expect(parseImportWorkbook(file)).rejects.toThrow('Estado civil');
  });

  it('lê o template distribuído e os 36 atributos originais', async () => {
    const rows = await parseImportWorkbook(await populatedTemplate());
    expect(rows).toHaveLength(1);
    expect(rows[0].registro).toBe(FATEC_DEMO_REGISTRATIONS[0]);
    expect(rows[0].features.nota_admissao).toBeGreaterThan(100);
    expect(Object.keys(rows[0].features)).toHaveLength(36);
  });

  it('rejeita código que o .pkl não aprendeu', async () => {
    const file = await populatedTemplate((workbook) => {
      workbook.getWorksheet('Importacao')!.getCell('K2').value = 26;
    });
    await expect(parseImportWorkbook(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita fórmula, mesmo que haja resultado calculado', async () => {
    const file = await populatedTemplate((workbook) => {
      workbook.getWorksheet('Importacao')!.getCell('O2').value = {
        formula: '1+1',
        result: 2,
      };
    });
    await expect(parseImportWorkbook(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita matrícula duplicada', async () => {
    const file = await populatedTemplate((workbook) => {
      workbook.getWorksheet('Importacao')!.duplicateRow(2, 1, true);
    });
    await expect(parseImportWorkbook(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

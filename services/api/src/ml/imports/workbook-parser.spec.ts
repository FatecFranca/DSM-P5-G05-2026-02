import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  fatecDemoProfile,
  FATEC_DEMO_REGISTRATIONS,
} from '../fatec-demo-profile';
import { parseImportWorkbook } from './workbook-parser';
import { ML_FEATURES } from '../ml.types';

async function populatedTemplate(change?: (workbook: Workbook) => void) {
  const workbook = new Workbook();
  const file = await readFile(
    join(process.cwd(), 'assets', 'modelo-importacao-ml.xlsx'),
  );
  await workbook.xlsx.load(
    file as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const registro = FATEC_DEMO_REGISTRATIONS[0];
  workbook
    .getWorksheet('Importacao')!
    .addRow([
      registro,
      1,
      ...ML_FEATURES.map((name) => fatecDemoProfile(registro)[name]),
    ]);
  change?.(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('planilha de importação ML', () => {
  it('lê o template distribuído e os 36 atributos originais', async () => {
    const rows = await parseImportWorkbook(await populatedTemplate());
    expect(rows).toHaveLength(1);
    expect(rows[0].registro).toBe(FATEC_DEMO_REGISTRATIONS[0]);
    expect(rows[0].features.nota_admissao).toBeGreaterThan(100);
    expect(Object.keys(rows[0].features)).toHaveLength(36);
  });

  it('rejeita código que o .pkl não aprendeu', async () => {
    const file = await populatedTemplate((workbook) => {
      workbook.getWorksheet('Importacao')!.getCell('D2').value = 26;
    });
    await expect(parseImportWorkbook(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita fórmula, mesmo que haja resultado calculado', async () => {
    const file = await populatedTemplate((workbook) => {
      workbook.getWorksheet('Importacao')!.getCell('H2').value = {
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

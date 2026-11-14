import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  parseMacroWorkbook,
  parseSemesterWorkbook,
  sourceTemplate,
} from './source-workbook';

async function filled(
  kind: 'semestres' | 'macro',
  values: (string | number)[],
) {
  const template = await sourceTemplate(kind);
  const workbook = new Workbook();
  await workbook.xlsx.load(
    template as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  workbook.getWorksheet('Importacao')!.addRow(values);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('planilhas de fontes oficiais', () => {
  it('lê resumo semestral completo e rejeita duplicações', async () => {
    const buffer = await filled('semestres', [
      'REG-1',
      1,
      5,
      6,
      6,
      5,
      14,
      1,
      'SISTEMA-123',
    ]);
    expect(await parseSemesterWorkbook(buffer)).toEqual([
      {
        linha: 2,
        registro: 'REG-1',
        semestre: 1,
        creditadas: 5,
        matriculadas: 6,
        avaliacoes: 6,
        aprovadas: 5,
        nota: 14,
        semAvaliacao: 1,
        fonteRef: 'SISTEMA-123',
      },
    ]);
    const workbook = new Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    workbook
      .getWorksheet('Importacao')!
      .addRow(['REG-1', 1, 5, 6, 6, 5, 14, 1, 'SISTEMA-123']);
    await expect(
      parseSemesterWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige origem HTTPS e números na escala dos indicadores', async () => {
    const good = await filled('macro', [
      'PT',
      2026,
      6.4,
      2.1,
      1.5,
      'https://example.org/fonte',
    ]);
    expect(await parseMacroWorkbook(good)).toEqual([
      {
        linha: 2,
        pais: 'PT',
        ano: 2026,
        desemprego: 6.4,
        inflacao: 2.1,
        pib: 1.5,
        fonteUrl: 'https://example.org/fonte',
      },
    ]);
    await expect(
      parseMacroWorkbook(
        await filled('macro', ['PT', 2026, 6, 2, 1, 'http://example.org']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      parseMacroWorkbook(
        await filled('macro', ['PT', 2026, 120, 2, 1, 'https://example.org']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita arquivos sem formato XLSX', async () => {
    await expect(
      parseSemesterWorkbook(Buffer.from('texto')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

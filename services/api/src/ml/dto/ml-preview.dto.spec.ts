import { validateSync } from 'class-validator';
import { ML_FEATURES, type MlFeatures } from '../ml.types';
import { MlPreviewDto } from './ml-preview.dto';

describe('MlPreviewDto', () => {
  const complete = Object.fromEntries(
    ML_FEATURES.map((feature) => [feature, 1]),
  ) as MlFeatures;

  function errors(features: unknown) {
    return validateSync(Object.assign(new MlPreviewDto(), { features }));
  }

  it('aceita somente os 36 atributos numéricos finitos', () => {
    expect(errors(complete)).toHaveLength(0);
    const incomplete = Object.fromEntries(
      Object.entries(complete).filter(([name]) => name !== 'pib'),
    );
    expect(errors(incomplete)).not.toHaveLength(0);
    expect(errors({ ...complete, extra: 1 })).not.toHaveLength(0);
    expect(errors({ ...complete, pib: '1' })).not.toHaveLength(0);
    expect(errors({ ...complete, pib: Infinity })).not.toHaveLength(0);
  });

  it('valida o formato explicitamente sem aceitar null ou valores desconhecidos', () => {
    for (const inputFormat of ['original', 'preprocessed', undefined]) {
      expect(
        validateSync(
          Object.assign(new MlPreviewDto(), {
            features: complete,
            inputFormat,
          }),
        ),
      ).toHaveLength(0);
    }
    for (const inputFormat of [null, 'raw', 1]) {
      expect(
        validateSync(
          Object.assign(new MlPreviewDto(), {
            features: complete,
            inputFormat,
          }),
        ),
      ).not.toHaveLength(0);
    }
  });
});

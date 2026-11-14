import { IsIn, ValidateIf, ValidateBy } from 'class-validator';
import { ML_FEATURES, type MlFeatures, type MlInputFormat } from '../ml.types';

export class MlPreviewDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['preprocessed', 'original'])
  inputFormat?: MlInputFormat;

  @ValidateBy({
    name: 'mlFeatures',
    validator: {
      validate(value: unknown): boolean {
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return false;
        }
        const features = value as Record<string, unknown>;
        const keys = Object.keys(features);
        return (
          keys.length === ML_FEATURES.length &&
          ML_FEATURES.every(
            (name) =>
              typeof features[name] === 'number' &&
              Number.isFinite(features[name]),
          ) &&
          keys.every((name) =>
            ML_FEATURES.includes(name as (typeof ML_FEATURES)[number]),
          )
        );
      },
      defaultMessage(): string {
        return 'features deve conter exatamente os 36 atributos numéricos finitos do modelo';
      },
    },
  })
  features!: MlFeatures;
}

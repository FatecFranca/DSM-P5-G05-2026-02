import { IsInt, Min, ValidateBy } from 'class-validator';
import { validProfile } from '../profile-validation';

export class MlProfileDto {
  @IsInt()
  @Min(0)
  versao!: number;

  @ValidateBy({
    name: 'partialMlFeatures',
    validator: {
      validate(value: unknown) {
        return validProfile(value);
      },
      defaultMessage: () =>
        'Atributos inválidos: confira códigos, contagens inteiras e escalas das notas; omita os dados ausentes',
    },
  })
  features!: Record<string, number>;
}

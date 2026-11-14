import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import { validProfile } from '../profile-validation';

export const INGRESS_FEATURES = [
  'estado_civil',
  'modo_candidatura',
  'ordem_candidatura',
  'curso',
  'qualif_anterior',
  'nota_qual_anterior',
  'nacionalidade',
  'qualif_mae',
  'qualif_pai',
  'ocupacao_mae',
  'ocupacao_pai',
  'nota_admissao',
  'deslocado',
  'necessidades_especiais',
  'genero',
  'internacional',
] as const;

export class IngressSourceDto {
  @IsInt() @Min(0) @Max(1000) versao!: number;
  @IsString() @MaxLength(200) @Matches(/\S/) fonteRef!: string;

  @ValidateBy({
    name: 'ingressFeatures',
    validator: {
      validate(value: unknown): boolean {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          return false;
        const features = value as Record<string, unknown>;
        const keys = Object.keys(features);
        return (
          keys.length > 0 &&
          keys.every((key) =>
            INGRESS_FEATURES.includes(key as (typeof INGRESS_FEATURES)[number]),
          ) &&
          validProfile(features)
        );
      },
      defaultMessage: () => 'Atributos de ingresso inválidos',
    },
  })
  features!: Partial<Record<(typeof INGRESS_FEATURES)[number], number>>;
}

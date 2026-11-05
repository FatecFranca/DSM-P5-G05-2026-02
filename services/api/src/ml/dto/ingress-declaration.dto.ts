import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum EstadoCivilDeclarado {
  SOLTEIRO = 'SOLTEIRO',
  CASADO = 'CASADO',
  UNIAO = 'UNIAO',
  DIVORCIADO = 'DIVORCIADO',
  VIUVO = 'VIUVO',
  OUTRO = 'OUTRO',
}

export enum GeneroDeclarado {
  FEMININO = 'FEMININO',
  MASCULINO = 'MASCULINO',
  OUTRO = 'OUTRO',
  NAO_INFORMAR = 'NAO_INFORMAR',
}

export class IngressDeclarationFieldsDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(EstadoCivilDeclarado)
  estadoCivil?: EstadoCivilDeclarado;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(/^[A-Z]{2}$/)
  nacionalidade?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/)
  qualificacaoAnterior?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/)
  qualificacaoMae?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/)
  qualificacaoPai?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/)
  ocupacaoMae?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/)
  ocupacaoPai?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  deslocado?: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  necessidadesEspeciais?: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(GeneroDeclarado)
  genero?: GeneroDeclarado;
}

export class IngressDeclarationDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  versao!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => IngressDeclarationFieldsDto)
  dados!: IngressDeclarationFieldsDto;
}

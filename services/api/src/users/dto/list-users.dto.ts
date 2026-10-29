import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Perfil } from '../../generated/prisma/enums';

export class ListUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamanho?: number;

  @IsOptional() @IsUUID() instituicaoId?: string;
  @IsOptional() @IsEnum(Perfil) perfil?: Perfil;
  @IsOptional() @IsString() @MaxLength(160) busca?: string;
}

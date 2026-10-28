import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Perfil } from '../../generated/prisma/enums';

export class ListUsersDto {
  @IsOptional() @IsUUID() instituicaoId?: string;
  @IsOptional() @IsEnum(Perfil) perfil?: Perfil;
  @IsOptional() @IsString() @MaxLength(160) busca?: string;
}

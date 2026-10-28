import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Perfil } from '../../generated/prisma/enums';

export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  instituicaoId?: string;
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  senha!: string;

  @IsEnum(Perfil)
  perfil!: Perfil;
}

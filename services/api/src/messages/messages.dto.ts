import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_GROUP_SIZE, MAX_TEXT } from './messages.policy';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CriarConversaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_SIZE - 1)
  @IsUUID(undefined, { each: true })
  participanteIds!: string[];

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) titulo?: string;
}

export class EnviarMensagemDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXT + 500) texto?: string;
  @IsOptional() @IsUUID() arquivoId?: string;
}

export class NovaPublicacaoDto {
  @IsString() @MaxLength(MAX_TEXT + 500) texto!: string;
  @IsOptional() @IsBoolean() importante?: boolean;
  @IsOptional() @IsUUID() arquivoId?: string;
}

export class PaginaQuery {
  /** Cursor: id do item mais antigo já carregado; devolve os anteriores a ele. */
  @IsOptional() @IsUUID() antes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 50;
}

export class CurtidaDto {
  @IsIn(['MENSAGEM', 'PUBLICACAO', 'RESPOSTA'])
  tipo!: 'MENSAGEM' | 'PUBLICACAO' | 'RESPOSTA';

  @IsUUID() id!: string;
}

export class ContatosQuery {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) q?: string;
}

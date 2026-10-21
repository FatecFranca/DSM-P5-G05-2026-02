import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoAtividade, SituacaoPresenca } from '../generated/prisma/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class TurmaDto {
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(120) nome!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(120) curso!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(40) periodo!: string;
}
export class DisciplinaDto {
  @IsUUID() turmaId!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(120) nome!: string;
}
export class MatriculaDto {
  @IsUUID() turmaId!: string;
  @IsUUID() alunoId!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(40) registro!: string;
}
export class LotacaoDto {
  @IsUUID() disciplinaId!: string;
  @IsUUID() professorId!: string;
}
export class TutoriaDto {
  @IsUUID() matriculaId!: string;
  @IsUUID() tutorId!: string;
}
export class AulaDto {
  @IsUUID() disciplinaId!: string;
  @IsDateString({ strict: true }) data!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(200) tema!: string;
}
export class PresencaItem {
  @IsUUID() matriculaId!: string;
  @IsEnum(SituacaoPresenca) situacao!: SituacaoPresenca;
}
export class FrequenciaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique((item: PresencaItem) => item.matriculaId)
  @ValidateNested({ each: true })
  @Type(() => PresencaItem)
  itens!: PresencaItem[];
}
export class AvaliacaoDto {
  @IsUUID() disciplinaId!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(160) titulo!: string;
  @IsNumber() @Min(0.01) @Max(1000) peso!: number;
  @IsNumber() @Min(0.01) @Max(1000) notaMaxima!: number;
  @IsDateString({ strict: true }) data!: string;
}
export class NotaItem {
  @IsUUID() matriculaId!: string;
  @IsNumber() @Min(0) @Max(1000) valor!: number;
}
export class NotasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique((item: NotaItem) => item.matriculaId)
  @ValidateNested({ each: true })
  @Type(() => NotaItem)
  itens!: NotaItem[];
}
export class AtividadeDto {
  @IsUUID() disciplinaId!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(160) titulo!: string;
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(4000)
  descricao!: string;
  @IsDateString({ strict: true }) prazo!: string;
  @IsNumber() @Min(0.01) @Max(1000) notaMaxima!: number;
  @IsEnum(EstadoAtividade) estado!: EstadoAtividade;
}
export class EntregaDto {
  @IsUUID() arquivoId!: string;
}
export class CorrecaoDto {
  @IsNumber() @Min(0) @Max(1000) nota!: number;
  @Transform(trim) @IsString() @MaxLength(4000) feedback!: string;
}
export class MaterialDto {
  @IsUUID() disciplinaId!: string;
  @IsUUID() arquivoId!: string;
  @Transform(trim) @IsString() @Matches(/\S/) @MaxLength(160) titulo!: string;
  @Transform(trim) @IsString() @MaxLength(4000) descricao!: string;
}
export class FechamentoDto {
  @IsBoolean() fechada!: boolean;
}
export class ResumoQuery {
  @IsOptional() @IsUUID() turmaId?: string;
}

export class FeedQuery extends ResumoQuery {
  @IsOptional() @IsUUID() disciplinaId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) tamanho = 20;
}

export class CalendarioQuery extends FeedQuery {
  @IsDateString({ strict: true }) inicio!: string;
  @IsDateString({ strict: true }) fim!: string;
}

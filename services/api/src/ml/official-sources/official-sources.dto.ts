import {
  IsInt,
  IsNumber,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SemesterSourceDto {
  @IsInt() @Min(0) @Max(1000) versao!: number;
  @IsInt() @Min(0) @Max(1000) creditadas!: number;
  @IsInt() @Min(0) @Max(1000) matriculadas!: number;
  @IsInt() @Min(0) @Max(1000) avaliacoes!: number;
  @IsInt() @Min(0) @Max(1000) aprovadas!: number;
  @IsNumber() @Min(0) @Max(20) nota!: number;
  @IsInt() @Min(0) @Max(1000) semAvaliacao!: number;
  @IsString() @MaxLength(200) @Matches(/\S/) fonteRef!: string;
}

export class MacroSourceDto {
  @IsNumber() @Min(0) @Max(100) desemprego!: number;
  @IsNumber() @Min(-100) @Max(100) inflacao!: number;
  @IsNumber() @Min(-100) @Max(100) pib!: number;
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  fonteUrl!: string;
}

export class MacroCohortDto {
  @Matches(/^[A-Z]{2}$/) pais!: string;
  @IsInt() @Min(1990) @Max(2100) ano!: number;
}

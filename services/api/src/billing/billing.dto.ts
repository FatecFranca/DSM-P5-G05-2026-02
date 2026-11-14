import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  Length,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  matriculaId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  competencia!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  vencimento!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  valorCentavos!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  semestre?: number;
}

export class EnrollmentSearchDto {
  @IsString()
  @Length(2, 40)
  registro!: string;
}

export class RecordPaymentDto {
  @IsString()
  @Length(8, 100)
  referencia!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  valorCentavos!: number;
}

export class MonthlyPlanDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  inicioCompetencia!: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  fimCompetencia?: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  valorCentavos!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimento!: number;

  @IsBoolean()
  ativo!: boolean;
}

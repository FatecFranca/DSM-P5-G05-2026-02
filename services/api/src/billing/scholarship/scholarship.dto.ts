import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class ScholarshipDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  inicio!: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  fim?: string;

  @IsBoolean()
  ativa!: boolean;
}

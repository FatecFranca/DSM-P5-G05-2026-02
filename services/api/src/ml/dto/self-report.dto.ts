import { IsEnum, IsInt, Max, Min } from 'class-validator';

export enum TurnoDeclarado {
  DIURNO = 'DIURNO',
  NOTURNO = 'NOTURNO',
}

export class SelfReportDto {
  @IsInt()
  @Min(14)
  @Max(100)
  idadeNoIngresso!: number;

  @IsEnum(TurnoDeclarado)
  turno!: TurnoDeclarado;
}

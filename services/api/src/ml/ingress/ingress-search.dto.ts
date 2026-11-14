import { IsString, Length } from 'class-validator';

export class IngressEnrollmentSearchDto {
  @IsString()
  @Length(2, 40)
  registro!: string;
}

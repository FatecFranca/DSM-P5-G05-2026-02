import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(64)
  @MaxLength(128)
  refreshToken!: string;
}

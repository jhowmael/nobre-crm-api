import { plainToInstance, Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, validateSync } from 'class-validator';

const toNumber = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'PORT deve ser um número inteiro' })
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'APP_TODAY deve estar no formato AAAA-MM-DD' })
  APP_TODAY?: string;

  @IsOptional()
  @IsString()
  API_KEY?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'THROTTLE_LIMIT deve ser um número inteiro' })
  @Min(1, { message: 'THROTTLE_LIMIT deve ser maior que zero' })
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'THROTTLE_TTL_SECONDS deve ser um número inteiro' })
  @Min(1, { message: 'THROTTLE_TTL_SECONDS deve ser maior que zero' })
  THROTTLE_TTL_SECONDS?: number;
}

export const DEFAULT_THROTTLE_LIMIT = 120;
export const DEFAULT_THROTTLE_TTL_SECONDS = 60;

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: false });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; '));
  }
  return validated;
}

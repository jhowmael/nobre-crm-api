import { applyDecorators, BadRequestException, ParseUUIDPipe, ValidationPipe, type ValidationError } from '@nestjs/common';
import { IsDateString, Matches } from 'class-validator';
import type { RuleViolationResponseDto } from './error-response.dto.js';

export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) => {
      const violations = flattenValidationErrors(errors);
      return new BadRequestException({ message: violations[0]?.message ?? 'Dados inválidos.', errors: violations });
    },
  });

export const uuidPipe = () =>
  new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Identificador inválido: informe um UUID.') });

export const IsDateOnly = (message: string) =>
  applyDecorators(IsDateString({ strict: true }, { message }), Matches(/^\d{4}-\d{2}-\d{2}$/, { message }));

export function flattenValidationErrors(errors: ValidationError[], parent = ''): RuleViolationResponseDto[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const [rule, message] = Object.entries(error.constraints ?? {}).at(-1) ?? [];
    const own = message ? [{ field, message: rule === 'whitelistValidation' ? `O campo ${field} não é permitido.` : message }] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

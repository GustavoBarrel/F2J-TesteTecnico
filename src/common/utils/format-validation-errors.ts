import { ValidationError } from '@nestjs/common';

export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    const fieldPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      result[fieldPath] = Object.values(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(result, formatValidationErrors(error.children, fieldPath));
    }
  }

  return result;
}

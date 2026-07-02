import { registerDecorator, ValidationOptions } from 'class-validator';
import { isSupportedUnit, SUPPORTED_UNITS } from './unit-converter.registry';

/**
 * DTO-level unit validation that delegates to the unit registry
 * instead of a hardcoded @IsIn(['kg', 'lb']) — a newly registered
 * unit passes validation with zero DTO changes.
 */
export function IsSupportedUnit(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSupportedUnit',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isSupportedUnit(value),
        defaultMessage: () =>
          `$property must be one of the supported units: ${SUPPORTED_UNITS.join(', ')}`,
      },
    });
  };
}

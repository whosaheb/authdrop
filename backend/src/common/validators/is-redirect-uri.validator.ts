import { registerDecorator, type ValidationOptions } from 'class-validator';
import { redirectUriProblem } from '../helpers/uri.helper.js';

/** Validates every element of a string array against the redirect URI policy. */
export function IsRedirectUriList(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isRedirectUriList',
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => Array.isArray(value) && value.every((v) => typeof v === 'string' && redirectUriProblem(v) === null),
        defaultMessage: (args) => {
          const bad = (Array.isArray(args?.value) ? (args!.value as unknown[]) : []).find((v) => typeof v !== 'string' || redirectUriProblem(v) !== null);
          return `${args?.property}: ${String(bad)} ${typeof bad === 'string' ? (redirectUriProblem(bad) ?? '') : 'must be a string'}`;
        },
      },
    });
  };
}

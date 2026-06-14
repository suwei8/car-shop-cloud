import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * 生产级密码强度约束：
 *   - 至少 8 位
 *   - 至少包含一个字母 (a-z / A-Z / 中文字符)
 *   - 至少包含一个数字
 *
 * 不强制特殊字符，兼顾安全性与用户友好性。
 */
@ValidatorConstraint({ async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (value.length < 8) return false;
    // 字母：ASCII 字母或 Unicode 字母（含中文）
    if (!/[\p{L}]/u.test(value)) return false;
    // 数字
    if (!/\d/.test(value)) return false;
    return true;
  }

  defaultMessage(): string {
    return '密码至少8位，且必须包含字母和数字';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

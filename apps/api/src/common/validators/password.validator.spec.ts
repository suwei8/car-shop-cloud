import { validateSync } from 'class-validator';
import { IsStrongPassword } from './password.validator';

class PasswordHolder {
  @IsStrongPassword()
  password: string;

  constructor(value: string) {
    this.password = value;
  }
}

function isValid(value: string): boolean {
  const errors = validateSync(new PasswordHolder(value));
  return errors.length === 0;
}

describe('IsStrongPassword validator', () => {
  it('rejects empty string', () => {
    expect(isValid('')).toBe(false);
  });

  it('rejects pure digits even if >= 8 chars', () => {
    expect(isValid('12345678')).toBe(false);
  });

  it('rejects pure letters even if >= 8 chars', () => {
    expect(isValid('abcdefgh')).toBe(false);
  });

  it('rejects 6-char mixed (too short)', () => {
    expect(isValid('abc123')).toBe(false);
  });

  it('rejects 7-char mixed (too short)', () => {
    expect(isValid('Abc1234')).toBe(false);
  });

  it('accepts 8-char mixed lowercase + digit', () => {
    expect(isValid('a1234567')).toBe(true);
  });

  it('accepts 8-char mixed uppercase + digit', () => {
    expect(isValid('ABCD1234')).toBe(true);
  });

  it('accepts mixed case letters + digits', () => {
    expect(isValid('Abc12345')).toBe(true);
  });

  it('accepts Chinese letters + digits (>=8 chars)', () => {
    expect(isValid('ab12中文xx')).toBe(true);
  });

  it('rejects non-string values', () => {
    expect(isValid(undefined as unknown as string)).toBe(false);
    expect(isValid(null as unknown as string)).toBe(false);
    expect(isValid(12345678 as unknown as string)).toBe(false);
  });

  it('default error message mentions length + composition rule', () => {
    const errors = validateSync(new PasswordHolder('weak'));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toMatchObject({
      IsStrongPasswordConstraint: expect.stringMatching(/至少8位/),
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { validateTransition, statusLabel } from './work-order.state-machine';

describe('validateTransition', () => {
  it('draft → confirmed：合法', () => {
    expect(() => validateTransition('draft', 'confirmed')).not.toThrow();
  });

  it('draft → cancelled：合法', () => {
    expect(() => validateTransition('draft', 'cancelled')).not.toThrow();
  });

  it('draft → quoted：合法', () => {
    expect(() => validateTransition('draft', 'quoted')).not.toThrow();
  });

  it('draft → settled：非法', () => {
    expect(() => validateTransition('draft', 'settled')).toThrow(BadRequestException);
  });

  it('quoted → confirmed：合法', () => {
    expect(() => validateTransition('quoted', 'confirmed')).not.toThrow();
  });

  it('confirmed → dispatching：合法', () => {
    expect(() => validateTransition('confirmed', 'dispatching')).not.toThrow();
  });

  it('dispatching → in_progress：合法', () => {
    expect(() => validateTransition('dispatching', 'in_progress')).not.toThrow();
  });

  it('in_progress → completed：合法', () => {
    expect(() => validateTransition('in_progress', 'completed')).not.toThrow();
  });

  it('completed → settled：合法', () => {
    expect(() => validateTransition('completed', 'settled')).not.toThrow();
  });

  it('settled → 任何状态：非法（终态）', () => {
    expect(() => validateTransition('settled', 'draft')).toThrow(BadRequestException);
    expect(() => validateTransition('settled', 'completed')).toThrow(BadRequestException);
  });

  it('cancelled → 任何状态：非法（终态）', () => {
    expect(() => validateTransition('cancelled', 'draft')).toThrow(BadRequestException);
    expect(() => validateTransition('cancelled', 'in_progress')).toThrow(BadRequestException);
  });

  it('未知状态：抛出 BadRequestException', () => {
    expect(() => validateTransition('unknown', 'draft')).toThrow(BadRequestException);
  });

  it('非法跳转错误信息包含中文标签', () => {
    try {
      validateTransition('draft', 'settled');
    } catch (e) {
      expect((e as BadRequestException).message).toContain('草稿');
      expect((e as BadRequestException).message).toContain('已结算');
    }
  });

  describe('简易模式（simpleMode = true）', () => {
    it('confirmed → completed：合法', () => {
      expect(() => validateTransition('confirmed', 'completed', true)).not.toThrow();
    });

    it('confirmed → dispatching：仍然合法', () => {
      expect(() => validateTransition('confirmed', 'dispatching', true)).not.toThrow();
    });

    it('confirmed → cancelled：仍然合法', () => {
      expect(() => validateTransition('confirmed', 'cancelled', true)).not.toThrow();
    });

    it('其他非法跳转仍被拒绝', () => {
      expect(() => validateTransition('draft', 'settled', true)).toThrow(BadRequestException);
    });
  });

  describe('普通模式下 confirmed → completed 仍非法', () => {
    it('confirmed → completed：非法', () => {
      expect(() => validateTransition('confirmed', 'completed', false)).toThrow(BadRequestException);
    });
  });
});

describe('statusLabel', () => {
  it('返回正确的中文标签', () => {
    expect(statusLabel('draft')).toBe('草稿');
    expect(statusLabel('confirmed')).toBe('已确认');
    expect(statusLabel('in_progress')).toBe('施工中');
    expect(statusLabel('settled')).toBe('已结算');
    expect(statusLabel('cancelled')).toBe('已作废');
  });

  it('未知状态返回原始值', () => {
    expect(statusLabel('unknown')).toBe('unknown');
  });
});

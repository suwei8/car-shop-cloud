import { BadRequestException } from '@nestjs/common';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:       ['quoted', 'confirmed', 'cancelled'],
  quoted:      ['confirmed', 'cancelled'],
  confirmed:   ['dispatching', 'cancelled'],
  dispatching: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   ['settled', 'cancelled'],
  settled:     [],
  cancelled:   [],
};

// 简易模式下允许的额外流转
const SIMPLE_MODE_EXTRA: Record<string, string[]> = {
  confirmed: ['completed'],
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  quoted: '已报价',
  confirmed: '已确认',
  dispatching: '派工中',
  in_progress: '施工中',
  completed: '已完成',
  settled: '已结算',
  cancelled: '已作废',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function validateTransition(currentStatus: string, targetStatus: string, simpleMode: boolean = false): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) {
    throw new BadRequestException(`未知工单状态: ${currentStatus}`);
  }

  const extraAllowed = simpleMode ? (SIMPLE_MODE_EXTRA[currentStatus] || []) : [];
  const allAllowed = [...allowed, ...extraAllowed];

  if (!allAllowed.includes(targetStatus)) {
    throw new BadRequestException(
      `不允许从「${statusLabel(currentStatus)}」流转到「${statusLabel(targetStatus)}」，` +
      `允许的目标状态: ${allAllowed.map(statusLabel).join('、') || '无'}`,
    );
  }
}

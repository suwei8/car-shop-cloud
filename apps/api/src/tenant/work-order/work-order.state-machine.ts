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

export function validateTransition(currentStatus: string, targetStatus: string): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) {
    throw new BadRequestException(`未知工单状态: ${currentStatus}`);
  }
  if (!allowed.includes(targetStatus)) {
    throw new BadRequestException(
      `不允许从「${statusLabel(currentStatus)}」流转到「${statusLabel(targetStatus)}」，` +
      `允许的目标状态: ${allowed.map(statusLabel).join('、') || '无'}`,
    );
  }
}

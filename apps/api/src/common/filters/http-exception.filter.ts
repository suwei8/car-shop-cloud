import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any).message || exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = this.resolvePrismaUniqueMessage(exception);
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = '记录不存在';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = '数据库操作失败';
          this.logger.error(
            `Prisma error [${exception.code}]: ${exception.message}`,
            exception.stack,
          );
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    response.status(status).json({
      code: status,
      message: Array.isArray(message) ? message.join('; ') : message,
      data: null,
    });
  }

  private resolvePrismaUniqueMessage(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const target = exception.meta?.target;
    if (!target) return '数据已存在（唯一约束冲突）';

    const targets = Array.isArray(target) ? target : [target];
    const normalizedTargets = targets.map((item) => String(item).toLowerCase());
    const joined = normalizedTargets.join(' ');

    const isUserPhoneFieldTarget =
      normalizedTargets.length === 1 && normalizedTargets[0] === 'phone';
    const isLegacyScopedUserPhoneTarget =
      normalizedTargets.length === 2
      && normalizedTargets.includes('tenantid')
      && normalizedTargets.includes('phone');
    const isUserPhoneConstraintTarget =
      joined === 'users_phone_key' || joined === 'users_tenantid_phone_key';
    const isScopedCardNoFieldTarget =
      normalizedTargets.length === 2
      && normalizedTargets.includes('tenantid')
      && normalizedTargets.includes('cardno');

    if (isUserPhoneFieldTarget || isLegacyScopedUserPhoneTarget || isUserPhoneConstraintTarget) {
      return '该手机号已被其他账号使用';
    }

    if (joined === 'parts_tenantid_code_key') {
      return '配件编码已存在';
    }

    if (
      isScopedCardNoFieldTarget ||
      joined === 'stored_value_cards_tenantid_cardno_key' ||
      joined === 'package_cards_tenantid_cardno_key'
    ) {
      return '卡号已存在';
    }

    return '数据已存在（唯一约束冲突）';
  }
}

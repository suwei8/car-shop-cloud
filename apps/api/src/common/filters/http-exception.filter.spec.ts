import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: Partial<Response>;
  let mockHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  describe('Prisma P2002 — phone unique constraint', () => {
    it('should return phone-specific message when target is ["phone"]', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`phone`)',
        { code: 'P2002', clientVersion: '5.20.0', meta: { target: ['phone'] } },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '该手机号已被其他账号使用' }),
      );
    });

    it('should return phone-specific message when target is ["tenantId", "phone"]', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: ['tenantId', 'phone'] },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '该手机号已被其他账号使用' }),
      );
    });

    it('should return phone-specific message when target is "users_phone_key"', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: 'users_phone_key' },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '该手机号已被其他账号使用' }),
      );
    });

    it('should return generic message for non-phone unique constraint', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '5.20.0', meta: { target: ['email'] } },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '数据已存在（唯一约束冲突）' }),
      );
    });

    it('should return part-code message when target is "parts_tenantId_code_key"', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: 'parts_tenantId_code_key' },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '配件编码已存在' }),
      );
    });

    it('should return card-no message when target is "stored_value_cards_tenantId_cardNo_key"', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: 'stored_value_cards_tenantId_cardNo_key' },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '卡号已存在' }),
      );
    });

    it('should return card-no message when target is ["tenantId", "cardNo"]', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: ['tenantId', 'cardNo'] },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '卡号已存在' }),
      );
    });

    it('should return card-no message when target is "package_cards_tenantId_cardNo_key"', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: 'package_cards_tenantId_cardNo_key' },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '卡号已存在' }),
      );
    });

    it('should return generic message for non-user phone-like target', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed on the constraint: `customers_phone_key`',
        { code: 'P2002', clientVersion: '5.20.0', meta: { target: 'customers_phone_key' } },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '数据已存在（唯一约束冲突）' }),
      );
    });

    it('should return generic message for roles_tenantId_code_key', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.20.0',
          meta: { target: 'roles_tenantId_code_key' },
        },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '数据已存在（唯一约束冲突）' }),
      );
    });

    it('should return generic message when target is missing', () => {
      const exception = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.20.0', meta: {} },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '数据已存在（唯一约束冲突）' }),
      );
    });
  });

  describe('Prisma P2025 — record not found', () => {
    it('should return record-not-found message', () => {
      const exception = new PrismaClientKnownRequestError(
        'Record to update not found',
        { code: 'P2025', clientVersion: '5.20.0', meta: {} },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '记录不存在' }),
      );
    });
  });

  describe('HttpException', () => {
    it('should forward HttpException status and message', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Forbidden' }),
      );
    });
  });
});

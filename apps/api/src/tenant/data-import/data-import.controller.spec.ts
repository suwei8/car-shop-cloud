import { BadRequestException } from '@nestjs/common';
import { DataImportController } from './data-import.controller';

const mockDataImportService = {
  generateTemplate: jest.fn(),
  preview: jest.fn(),
  execute: jest.fn(),
};

function createController() {
  return new DataImportController(mockDataImportService as any);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DataImportController', () => {
  describe('preview', () => {
    it('should throw BadRequestException when file is missing', async () => {
      const controller = createController();

      await expect(controller.preview(null as any, { tenantId: 't1' } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file exceeds size limit', async () => {
      const controller = createController();
      const bigFile = { size: 6 * 1024 * 1024 };

      await expect(controller.preview(bigFile as any, { tenantId: 't1' } as any))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('execute', () => {
    it('should throw BadRequestException when previewData is missing', async () => {
      const controller = createController();
      const file = { size: 1024 };

      await expect(
        controller.execute(file as any, undefined as any, { tenantId: 't1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with correct message when previewData is missing', async () => {
      const controller = createController();
      const file = { size: 1024 };

      try {
        await controller.execute(file as any, undefined as any, { tenantId: 't1' } as any);
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('缺少预览数据，请先执行预览步骤');
      }
    });

    it('should throw BadRequestException when previewData is invalid JSON', async () => {
      const controller = createController();
      const file = { size: 1024 };

      try {
        await controller.execute(file as any, 'not-json' as any, { tenantId: 't1' } as any);
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('预览数据格式错误');
      }
    });

    it('should throw BadRequestException when file is missing', async () => {
      const controller = createController();

      await expect(
        controller.execute(null as any, '{}', { tenantId: 't1' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

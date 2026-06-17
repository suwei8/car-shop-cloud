import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly ocrServiceUrl: string;

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {
    this.ocrServiceUrl = this.config.get<string>('OCR_SERVICE_URL', 'http://localhost:8080');
    this.logger.log(`OCR Service URL: ${this.ocrServiceUrl}`);
  }

  async recognizePlate(imageBase64: string): Promise<{ plateNo: string | null; confidence: number }> {
    this.logger.log('Processing license plate recognition request');

    try {
      // 调用自建 OCR 服务
      const response = await firstValueFrom(
        this.http.post(`${this.ocrServiceUrl}/recognize`, {
          image_base64: imageBase64,
        }, {
          timeout: 30000, // 30秒超时
        })
      );

      const result = response.data;
      this.logger.log(`OCR result: ${JSON.stringify(result)}`);

      return {
        plateNo: result.plate_no || null,
        confidence: result.confidence || 0,
      };
    } catch (error) {
      this.logger.error(`OCR service error: ${error.message}`);
      
      // 如果 OCR 服务不可用，返回 null
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.logger.warn('OCR service is not available, returning null');
      }
      
      return {
        plateNo: null,
        confidence: 0,
      };
    }
  }

  async recognizeVin(imageBase64: string): Promise<{ plateNo: string | null; confidence: number }> {
    this.logger.log('Processing VIN recognition request');

    try {
      const response = await firstValueFrom(
        this.http.post(`${this.ocrServiceUrl}/recognize-vin`, {
          image_base64: imageBase64,
        }, {
          timeout: 30000,
        })
      );

      const result = response.data;
      this.logger.log(`VIN OCR result: ${JSON.stringify(result)}`);

      return {
        plateNo: result.plate_no || null,
        confidence: result.confidence || 0,
      };
    } catch (error) {
      this.logger.error(`VIN OCR service error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.logger.warn('OCR service is not available, returning null');
      }
      
      return {
        plateNo: null,
        confidence: 0,
      };
    }
  }

  /**
   * 验证车牌号格式是否有效
   */
  validatePlateNo(plateNo: string): boolean {
    const plateRegex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-Z0-9]{5,6}$/;
    return plateRegex.test(plateNo);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarrantyService } from './warranty.service';
import { CurrentUser } from '../../common/decorators';
import { JwtPayload } from '@car/shared';

@ApiTags('warranty')
@ApiBearerAuth()
@Controller('warranty')
export class WarrantyController {
  constructor(private warrantyService: WarrantyService) {}

  @Get('vehicle/:vehicleId')
  @ApiOperation({ summary: '查询车辆已换配件的质保状态' })
  async getWarrantyByVehicle(
    @Param('vehicleId') vehicleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.warrantyService.getWarrantyByVehicle(vehicleId, user);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: '查询客户所有车辆已换配件的质保状态' })
  async getWarrantyByCustomer(
    @Param('customerId') customerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.warrantyService.getWarrantyByCustomer(customerId, user);
  }
}

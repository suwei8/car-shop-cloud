import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlatformTenantModule } from './platform/tenant/tenant.module';
import { PlatformSubscriptionPlanModule } from './platform/subscription-plan/subscription-plan.module';
import { PlatformFeatureFlagModule } from './platform/feature-flag/feature-flag.module';
import { ShopModule } from './tenant/shop/shop.module';
import { UserModule } from './tenant/user/user.module';
import { RoleModule } from './tenant/role/role.module';
import { PermissionModule } from './tenant/permission/permission.module';
import { DictionaryModule } from './tenant/dictionary/dictionary.module';
import { SystemParameterModule } from './tenant/system-parameter/system-parameter.module';
import { CustomerModule } from './tenant/customer/customer.module';
import { VehicleModule } from './tenant/vehicle/vehicle.module';
import { AppointmentModule } from './tenant/appointment/appointment.module';
import { WorkOrderModule } from './tenant/work-order/work-order.module';
import { ServiceItemModule } from './tenant/service-item/service-item.module';
import { DispatchModule } from './tenant/dispatch/dispatch.module';
import { InspectionModule } from './tenant/inspection/inspection.module';
import { PartModule } from './tenant/part/part.module';
import { SupplierModule } from './tenant/supplier/supplier.module';
import { StockModule } from './tenant/stock/stock.module';
import { SettlementModule } from './tenant/settlement/settlement.module';
import { StoredValueCardModule } from './tenant/stored-value-card/stored-value-card.module';
import { PackageCardModule } from './tenant/package-card/package-card.module';
import { DashboardModule } from './tenant/dashboard/dashboard.module';
import { ReportModule } from './tenant/report/report.module';
import { PrintModule } from './tenant/print/print.module';
import { FileModule } from './file/file.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { RolesGuard, PermissionsGuard, TenantGuard, JwtAuthGuard } from './common/guards';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AuditModule,
    FileModule,
    HealthModule,
    // Platform modules
    PlatformTenantModule,
    PlatformSubscriptionPlanModule,
    PlatformFeatureFlagModule,
    // Tenant modules
    ShopModule,
    UserModule,
    RoleModule,
    PermissionModule,
    DictionaryModule,
    SystemParameterModule,
    CustomerModule,
    VehicleModule,
    AppointmentModule,
    WorkOrderModule,
    ServiceItemModule,
    DispatchModule,
    InspectionModule,
    PartModule,
    SupplierModule,
    StockModule,
    SettlementModule,
    StoredValueCardModule,
    PackageCardModule,
    DashboardModule,
    ReportModule,
    PrintModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}

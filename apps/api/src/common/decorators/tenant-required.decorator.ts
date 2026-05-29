import { SetMetadata } from '@nestjs/common';
import { TENANT_REQUIRED } from '../guards/tenant.guard';

export const TenantRequired = () => SetMetadata(TENANT_REQUIRED, true);

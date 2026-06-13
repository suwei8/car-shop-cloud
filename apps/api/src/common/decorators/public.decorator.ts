import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CUSTOMER_PORTAL_KEY = 'customerPortal';
export const CustomerPortal = () => SetMetadata(CUSTOMER_PORTAL_KEY, true);

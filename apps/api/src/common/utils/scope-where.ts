import { JwtPayload } from '@car/shared';

/**
 * 根据用户数据范围生成查询 where 条件
 * @param user JWT 载荷
 * @param baseWhere 基础查询条件（已包含 tenantId）
 * @param scopeField 查询条件中的字段名（默认 'shopId'）
 * @param ownerField 数据所属人字段名（用于 SELF 范围，如 'advisorId'、'operatorId'、'technicianId'）
 */
export function applyDataScope(
  user: JwtPayload,
  baseWhere: Record<string, any>,
  scopeField = 'shopId',
  ownerField?: string,
): Record<string, any> {
  if (user.isPlatform) return baseWhere;

  const scope = user.dataScope || 'shop';

  switch (scope) {
    case 'all':
      return baseWhere;
    case 'shop':
      if (user.shopId) {
        return { ...baseWhere, [scopeField]: user.shopId };
      }
      return baseWhere;
    case 'self':
      if (ownerField && user.sub) {
        return { ...baseWhere, [ownerField]: user.sub };
      }
      return baseWhere;
    default:
      return baseWhere;
  }
}

export interface SmsProvider {
  send(phone: string, templateCode: string, params: Record<string, string>): Promise<{ ok: boolean; error?: string }>;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

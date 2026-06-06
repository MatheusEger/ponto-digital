// app/api/ip/route.ts
import { getClientIp } from '@/lib/ip';
import { jsonOk } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export function GET() {
  return jsonOk({ ip: getClientIp() });
}

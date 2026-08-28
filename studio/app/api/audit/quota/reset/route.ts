import { POST as resetQuota } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/audit/quota/reset — alias for the development quota reset. */
export { resetQuota as POST };

import {
	addDiagnostic,
	findLatestDiagnosticByDomain,
	updateDiagnostic,
} from '@/lib/firebase/diagnostics';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { liveResultToDiagnosticInput } from './live-diagnostic-map';
import type { LiveDiagnosticResult } from './liveDiagnosticTypes';

export { liveResultToDiagnosticInput } from './live-diagnostic-map';

export async function persistLiveDiagnosticResult(
	result: LiveDiagnosticResult,
	opts: { requestedBy: string; userId?: string | null },
): Promise<{ id: string }> {
	if (!isFirebaseAdminConfigured()) {
		throw new Error('Firebase가 설정되지 않아 진단 이력을 저장할 수 없습니다.');
	}
	const payload = liveResultToDiagnosticInput(result, opts.requestedBy, opts.userId);
	const latest = await findLatestDiagnosticByDomain(result.domain);
	if (latest) {
		await updateDiagnostic(latest.id, payload, { refreshCreatedAt: true });
		return { id: latest.id };
	}
	return addDiagnostic(payload);
}

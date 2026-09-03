/**
 * Dataset isolation for the shared Competitor Repository.
 * Reuses existing Target / Project / Site identity — never a request id.
 */
export type AsiDatasetScope = {
	domain: string;
	siteId?: string | null;
	projectId?: string | null;
	auditId?: string | null;
};

export function normalizeScopePart(value: string | null | undefined): string {
	return (value || '').trim().toLowerCase();
}

/**
 * Stable store key. Domain is the existing site identity.
 * projectId further isolates the same host owned by different projects.
 * auditId / request-scoped run ids are not used — they would split one session.
 */
export function asiDatasetScopeKey(scope: string | AsiDatasetScope): string {
	if (typeof scope === 'string') return normalizeScopePart(scope);
	const domain = normalizeScopePart(scope.domain);
	const siteId = normalizeScopePart(scope.siteId);
	const projectId = normalizeScopePart(scope.projectId);
	const host = domain || siteId;
	if (!host) return 'unknown';
	return projectId && projectId !== host ? `${host}::${projectId}` : host;
}

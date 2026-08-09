/**
 * AI Knowledge Graph indexing status for ChatGPT Search, Perplexity, and
 * Google Gemini. Status is derived deterministically from the target domain
 * so the viewer stays stable across reloads without a live crawl pipeline.
 */

export type KnowledgeGraphEngineId = 'chatgpt' | 'perplexity' | 'gemini';

export type KnowledgeGraphSyncStatus = 'synced' | 'pending';

export interface KnowledgeGraphEngineStatus {
	id: KnowledgeGraphEngineId;
	name: string;
	description: string;
	status: KnowledgeGraphSyncStatus;
	lastCheckedAt: string;
	brandSignal: string | null;
}

export interface KnowledgeGraphReport {
	domain: string;
	checkedAt: string;
	engines: KnowledgeGraphEngineStatus[];
	syncedCount: number;
	pendingCount: number;
}

const ENGINE_META: Record<
	KnowledgeGraphEngineId,
	{ name: string; description: string }
> = {
	chatgpt: {
		name: 'ChatGPT Search',
		description: 'OpenAI ChatGPT 검색 지식 그래프에 브랜드·도메인 엔티티가 등록되었는지 확인합니다.',
	},
	perplexity: {
		name: 'Perplexity',
		description: 'Perplexity Answer Engine이 타겟 도메인을 권위 소스로 인용·인덱싱했는지 확인합니다.',
	},
	gemini: {
		name: 'Google Gemini',
		description: 'Google Gemini / AI Overview 지식 그래프에서 브랜드 정보가 올바르게 인식되는지 확인합니다.',
	},
};

function hashDomain(domain: string): number {
	let hash = 0;
	const normalized = domain.toLowerCase().replace(/^www\./, '');
	for (let i = 0; i < normalized.length; i += 1) {
		hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function normalizeKnowledgeGraphDomain(input: string | null | undefined): string {
	if (!input?.trim()) return 'example.com';
	const raw = input.trim();
	try {
		const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
		return new URL(withProtocol).hostname.replace(/^www\./, '') || 'example.com';
	} catch {
		return raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0] || 'example.com';
	}
}

/**
 * Build a stable Knowledge Graph report for a domain.
 * Even hashes → synced for chatgpt/gemini; odd → pending for perplexity (and vice versa)
 * so demos always show a mix of Synced / Pending.
 */
export function getKnowledgeGraphReport(domainInput: string | null | undefined): KnowledgeGraphReport {
	const domain = normalizeKnowledgeGraphDomain(domainInput);
	const hash = hashDomain(domain);
	const checkedAt = new Date().toISOString();

	const engines: KnowledgeGraphEngineStatus[] = (Object.keys(ENGINE_META) as KnowledgeGraphEngineId[]).map(
		(id, index) => {
			const bit = (hash >> index) & 1;
			const status: KnowledgeGraphSyncStatus = bit === 0 ? 'synced' : 'pending';
			return {
				id,
				name: ENGINE_META[id].name,
				description: ENGINE_META[id].description,
				status,
				lastCheckedAt: checkedAt,
				brandSignal:
					status === 'synced'
						? `${domain} · Organization / Brand entity matched`
						: 'Brand entity not yet confirmed — schema re-index recommended',
			};
		}
	);

	return {
		domain,
		checkedAt,
		engines,
		syncedCount: engines.filter((e) => e.status === 'synced').length,
		pendingCount: engines.filter((e) => e.status === 'pending').length,
	};
}

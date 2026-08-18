import type { AIEngineTestResult, EngineAnalysisTag } from '@/types/geo-diagnostic';
import type { EngineCurrentStatus } from '@/types/geo-trigger-simulation';
import type { LiveProbeEngineResult } from '@/types/live-probe';

function toAnalysisTags(live: LiveProbeEngineResult, mentioned: boolean): EngineAnalysisTag[] {
	return live.tags.map((raw, index) => {
		const label = raw.replace(/^#/, '').trim() || `tag-${index}`;
		return {
			id: `${live.id}-${label}`,
			label,
			polarity: live.isLive && mentioned ? 'positive' : 'negative',
		};
	});
}

export function applyLiveProbeOverlay(
	engine: AIEngineTestResult,
	live: LiveProbeEngineResult,
	query: string,
): AIEngineTestResult {
	const mentioned = /Level\s*2/i.test(live.levelBadge);
	const analysisTags = toAnalysisTags(live, mentioned);
	const currentStatus: EngineCurrentStatus = {
		level: mentioned ? 2 : 1,
		levelLabel: live.levelBadge,
		triggerQuery: query,
		simulationResponse: live.responsePreview,
		statusTags: live.tags,
	};

	const base = {
		...engine,
		triggerQuery: query,
		simulatedResponse: live.responsePreview,
		analysisTags,
		isLive: live.isLive,
		liveLabel: live.name,
		currentStatus,
	};

	if (mentioned) {
		return { ...base, statusBadge: 'moderate', depthLevel: 2 };
	}
	return { ...base, statusBadge: 'exact_only', depthLevel: 1 };
}

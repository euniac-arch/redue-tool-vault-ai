export type LiveProbeEngineId = 'chatgpt' | 'claude';

export type ProbeKind = 'simulation' | 'live-api';

export interface LiveProbeEngineResult {
	id: LiveProbeEngineId;
	name: string;
	icon: string;
	isLive: boolean;
	levelBadge: string;
	responsePreview: string;
	tags: string[];
}

export interface LiveProbeResponse {
	success: boolean;
	isRealApi?: boolean;
	results?: LiveProbeEngineResult[];
	error?: string;
}

export interface LiveProbeOverlay {
	query: string;
	results: LiveProbeEngineResult[];
}

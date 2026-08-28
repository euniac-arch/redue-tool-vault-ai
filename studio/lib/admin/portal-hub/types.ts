export type PortalHubTabId = 'naver' | 'google' | 'kakao' | 'geo' | 'presets';

export interface PortalHubLink {
	label: string;
	url: string;
}

export interface PortalHubChecklistItem {
	id: string;
	label: string;
	detail?: string;
}

export interface PortalHubTip {
	title: string;
	detail: string;
}

export interface PortalHubCodePreset {
	id: string;
	title: string;
	description: string;
	filename: string;
	language: 'text' | 'json' | 'html';
	/** Template string. Use `{{domain}}` as a placeholder, substituted at render time. */
	template: string;
}

export interface GeoEngineRow {
	engine: string;
	indexSource: string;
	crawlerBots: string;
	note: string;
}

/** Persisted shape for `usePortalHubState`. */
export interface PortalHubStoredState {
	domain: string;
	naverVerificationCode: string;
	checklist: Record<string, boolean>;
}

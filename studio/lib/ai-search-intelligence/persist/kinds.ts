export const ASI_HISTORY_KINDS = [
	'observation',
	'evidence',
	'competitor',
	'opportunity',
	'action',
	'visibility',
	'alert',
] as const;

export type AsiHistoryKind = (typeof ASI_HISTORY_KINDS)[number];

export type AsiHistoryRecord = {
	id: string;
	domain: string;
	kind: AsiHistoryKind;
	provider?: string | null;
	query?: string | null;
	timestamp: string;
	payload: unknown;
};

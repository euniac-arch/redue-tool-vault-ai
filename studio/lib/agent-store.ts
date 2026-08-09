import fs from 'node:fs';
import path from 'node:path';

export type AgentSchemaType = 'SoftwareApplication' | 'Article' | 'LocalBusiness' | 'WebSite';

export type AgentEventKind =
	| 'scan'
	| 'change_detected'
	| 'schema_regen'
	| 'inject'
	| 'rollback'
	| 'notify'
	| 'error'
	| 'ok';

export interface AgentMonitoredSite {
	id: string;
	domain: string;
	siteUrl: string;
	userId: string | null;
	/** Absolute path to local WP target file when available (sandbox inject). */
	targetFilePath: string | null;
	/** Pre-healing original file content for Auto-Rollback. */
	originalBackup: string | null;
	lastFingerprint: string | null;
	lastStatusCode: number | null;
	lastSchemaTypes: AgentSchemaType[];
	lastHealedAt: string | null;
	createdAt: string;
}

export interface AgentTimelineEvent {
	id: string;
	siteId: string | null;
	domain: string | null;
	kind: AgentEventKind;
	message: string;
	schemaType?: AgentSchemaType | null;
	success: boolean;
	createdAt: string;
}

export interface AgentStats {
	schemasAutoUpdated: number;
	algorithmUpToDatePercent: number;
	autoRollbacks: number;
	sitesMonitored: number;
	lastCronAt: string | null;
	lastCronDurationMs: number | null;
}

export interface AgentState {
	sites: AgentMonitoredSite[];
	timeline: AgentTimelineEvent[];
	stats: AgentStats;
	adminAlerts: string[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'agent-state.json');

function ensureDir(): void {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}

export function defaultAgentState(): AgentState {
	const now = new Date().toISOString();
	return {
		sites: [
			{
				id: 'site_demo_redue',
				domain: 'demo.redue.ai',
				siteUrl: 'https://demo.redue.ai',
				userId: null,
				targetFilePath: null,
				originalBackup: null,
				lastFingerprint: null,
				lastStatusCode: 200,
				lastSchemaTypes: ['SoftwareApplication', 'WebSite'],
				lastHealedAt: null,
				createdAt: now,
			},
			{
				id: 'site_demo_agency',
				domain: 'agency-demo.local',
				siteUrl: 'https://agency-demo.local',
				userId: null,
				targetFilePath: null,
				originalBackup: null,
				lastFingerprint: null,
				lastStatusCode: 200,
				lastSchemaTypes: ['Article', 'LocalBusiness'],
				lastHealedAt: null,
				createdAt: now,
			},
		],
		timeline: [
			{
				id: 'evt_boot',
				siteId: null,
				domain: null,
				kind: 'ok',
				message: 'AI Webmaster Agent initialized — weekly Self-Healing cron armed.',
				success: true,
				createdAt: now,
			},
		],
		stats: {
			schemasAutoUpdated: 0,
			algorithmUpToDatePercent: 100,
			autoRollbacks: 0,
			sitesMonitored: 2,
			lastCronAt: null,
			lastCronDurationMs: null,
		},
		adminAlerts: [],
	};
}

export function loadAgentState(): AgentState {
	ensureDir();
	try {
		const raw = fs.readFileSync(STATE_FILE, 'utf8');
		const parsed = JSON.parse(raw) as AgentState;
		parsed.stats.sitesMonitored = parsed.sites.length;
		return parsed;
	} catch {
		const state = defaultAgentState();
		saveAgentState(state);
		return state;
	}
}

export function saveAgentState(state: AgentState): void {
	ensureDir();
	state.stats.sitesMonitored = state.sites.length;
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function appendAgentEvent(
	state: AgentState,
	event: Omit<AgentTimelineEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): AgentTimelineEvent {
	const full: AgentTimelineEvent = {
		id: event.id ?? `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
		createdAt: event.createdAt ?? new Date().toISOString(),
		siteId: event.siteId,
		domain: event.domain,
		kind: event.kind,
		message: event.message,
		schemaType: event.schemaType ?? null,
		success: event.success,
	};
	state.timeline.unshift(full);
	state.timeline = state.timeline.slice(0, 200);
	return full;
}

export function pushAdminAlert(state: AgentState, message: string): void {
	state.adminAlerts.unshift(`[${new Date().toISOString()}] ${message}`);
	state.adminAlerts = state.adminAlerts.slice(0, 50);
}

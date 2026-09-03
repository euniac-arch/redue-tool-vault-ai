export type AsiEngineId = 'chatgpt' | 'gemini' | 'perplexity' | 'claude';

export type AsiSource = 'mock' | 'audit' | 'live' | 'derived' | 'fallback';

export type AsiProviderVendor = 'openai' | 'gemini' | 'perplexity' | 'anthropic';

export type AsiRuntimeMode = 'mock' | 'live' | 'hybrid';

export type AsiProviderCallMeta = {
	mode: AsiRuntimeMode;
	provider: AsiProviderVendor;
	engine: AsiEngineId;
	fallback: boolean;
	error?: string;
	code?: string;
	cacheHit?: boolean;
	retries?: number;
	/** True when this engine was not called or the call failed. Never invents an answer. */
	unavailable?: boolean;
};

export type AsiSignalFamily =
	| 'technical'
	| 'content'
	| 'schema'
	| 'local'
	| 'entity'
	| 'aeo'
	| 'faq'
	| 'citation';

/** Read-only SEO/GEO signals the Intelligence Core may consume. Audit engine is never mutated. */
export type AsiAuditSignalId = 'schema' | 'entity' | 'local' | 'content' | 'faq' | 'citation' | 'technical';

export type AsiSignalLinkId =
	| 'schema_to_reputation'
	| 'localbusiness_to_local'
	| 'faq_to_recommendation'
	| 'entity_to_perception'
	| 'citation_to_explorer'
	| 'aeo_to_readiness'
	| 'content_to_perception'
	| 'technical_to_readiness';

export type AsiSignalLink = {
	id: AsiSignalLinkId;
	family: AsiSignalFamily;
	gap: boolean;
	href: string;
};

export type AsiAuditBind = {
	seoScore: number;
	seoMaxScore: number;
	signalLinks: AsiSignalLink[];
};

export type AsiMentionType = 'none' | 'simple_mention' | 'recommended';

export type AsiCitationOwnership = 'owned' | 'brand_earned' | 'unbranded_third_party';

export type AsiStatusTone = 'rising' | 'falling' | 'caution';

export type AsiCompetitorIntensity = 'high' | 'mid' | 'low';

export type AsiWarRoomSite = {
	url: string;
	brandName: string;
	domain: string;
	location?: string;
	category?: string;
};

export type AsiEngineVisibility = {
	engine: AsiEngineId;
	score: number;
	mentionType: AsiMentionType;
};

export type AsiWarRoomKpis = {
	visibility: number;
	recommendationRate: number;
	shareOfVoice: number;
	trustScore: number;
	agentReadiness: number;
};

export type AsiWarRoomBlocker = {
	id: string;
	title: string;
	detail: string;
	href: string;
};

export type AsiWarRoomOpportunity = {
	id: string;
	title: string;
	detail: string;
	impact: number;
	href: string;
};

export type AsiWarRoomCompetitor = {
	name: string;
	coRecommend: number;
	intensity: AsiCompetitorIntensity;
	sharePercent: number;
};

export type AsiWarRoomQuery = {
	query: string;
	recommended: boolean;
	winner: string;
};

export type AsiWarRoomCitation = {
	title: string;
	url: string;
	ownership: AsiCitationOwnership;
};

export type AsiPerceptionAxisId =
	| 'expertise'
	| 'local'
	| 'trust'
	| 'differentiation'
	| 'awareness'
	| 'recommendation';

export const ASI_PERCEPTION_AXES: readonly AsiPerceptionAxisId[] = [
	'expertise',
	'trust',
	'local',
	'differentiation',
	'recommendation',
	'awareness',
];

export type AsiPerceptionEngineNote = {
	engine: AsiEngineId;
	summary: string;
	mentionType: AsiMentionType;
};

export type AsiPerceptionSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	trustScore: number;
	axes: Record<AsiPerceptionAxisId, number>;
	understood: string;
	unknown: string[];
	confused: string[];
	currentNarrative: string;
	targetNarrative: string;
	gapNotes: string[];
	engineNotes: AsiPerceptionEngineNote[];
};

export const ASI_ENGINES: readonly AsiEngineId[] = ['chatgpt', 'gemini', 'perplexity', 'claude'];

/** Provider-normalized answer. UI never sees raw OpenAI/Gemini/Perplexity/Claude payloads. */
export type AIResponse = {
	provider: AsiEngineId;
	query: string;
	answer: string;
	mentions: string[];
	recommendations: string[];
	citations: CitationResult[];
	confidence: number;
	timestamp: string;
	source: AsiSource;
	meta?: AsiProviderCallMeta;
};

export type RecommendationResult = {
	brand: string;
	mentioned: boolean;
	rank: AsiRecommendRank;
	reason: string;
	provider: AsiEngineId;
	query: string;
};

export type CitationResult = {
	source: string;
	url: string;
	type: AsiCitationKind;
	relevance: number;
	authority: number;
};

export type AsiRecommendRank = 1 | 2 | 3 | null;

export type AsiEngineRecommendResult = {
	engine: AsiEngineId;
	rank: AsiRecommendRank;
	mentioned: boolean;
	reason: string;
	summary: string;
	mentionType: AsiMentionType;
	source?: AsiSource;
	fallback?: boolean;
	error?: string;
	mentions?: string[];
	recommendations?: string[];
	citations?: string[];
	timestamp?: string;
	query?: string;
};

export type AsiTargetAppearStatus = 'RECOMMENDED' | 'MENTIONED' | 'NOT_FOUND' | 'NO_DATA';

export type AsiSimRunStatus = 'idle' | 'observed' | 'fallback' | 'mock_preview' | 'error' | 'no_result';

export type AsiSimEntityRole = 'target' | 'competitor' | 'other';

export type AsiSimEntity = {
	name: string;
	role: AsiSimEntityRole;
	mentioned: boolean;
	recommended: boolean;
};

export type AsiSimCitation = {
	source: string;
	url: string;
};

export type AsiSimWhyId = 'local' | 'service' | 'expertise' | 'citation' | 'entity' | 'third_party' | 'intent';

export type AsiSimWhyItem = {
	id: AsiSimWhyId;
	observed: boolean;
};

export type AsiQueryObservation = {
	query: string;
	mentionedBrands: number;
	targetCount: 0 | 1;
	competitorCount: number;
};

/** Single-query Search Simulator observation. Never mixes SEO scores. */
export type AsiSearchSimulation = {
	query: string;
	runStatus: AsiSimRunStatus;
	targetStatus: AsiTargetAppearStatus;
	observedAt: string | null;
	providers: AsiEngineId[];
	entities: AsiSimEntity[];
	citations: AsiSimCitation[];
	citationAvailable: boolean;
	why: AsiSimWhyItem[];
	observation: AsiQueryObservation;
	usableResponseCount: number;
};

export type AsiSimulatorPenaltyId =
	| 'local_entity'
	| 'expertise'
	| 'third_party'
	| 'faq'
	| 'content_structure';

export type AsiSimulatorPenalty = {
	id: AsiSimulatorPenaltyId;
	points: number;
	detail: string;
};

export type AsiSovCategory = 'discovery' | 'recommend' | 'compare' | 'solve' | 'purchase' | 'local';

export const ASI_SOV_CATEGORIES: readonly AsiSovCategory[] = [
	'discovery',
	'recommend',
	'compare',
	'solve',
	'purchase',
	'local',
];

export type AsiSovPeriod = '7d' | '14d' | '30d';

export const ASI_SOV_PERIODS: readonly AsiSovPeriod[] = ['7d', '14d', '30d'];

/** REDUE-derived share. `value` is null when the live sample is too small to interpret. */
export type AsiSovMetric = {
	value: number | null;
	sampleSize: number;
	brandCount: number;
	universeCount: number;
	sufficient: boolean;
};

/** Shared sample inventory. SOV is scored only when `calculable`. */
export type AsiSovCoverage = {
	queryCount: number;
	validResponseCount: number;
	competitorObservationCount: number;
	calculable: boolean;
};

/**
 * Page-level competitor observation.
 * NO_COMPETITOR_OBSERVED is only valid after a sufficient sample.
 */
export type AsiObservationState = 'NO_DATA' | 'INSUFFICIENT_SAMPLE' | 'NO_COMPETITOR_OBSERVED' | 'COMPETITORS_FOUND';

export type AsiSovObservation = {
	query: string;
	category: AsiSovCategory;
	provider: AsiEngineId;
	brandMentioned: boolean;
	competitorMentions: string[];
	recommended: boolean;
	rank: AsiRecommendRank;
	position: number | null;
	citations: string[];
	timestamp: string;
	source: AsiSource;
};

export type AsiSovSlice = {
	label: string;
	brandShare: number;
	competitorShare: number;
	otherShare: number;
	sampleSize?: number;
	sufficient?: boolean;
};

/** REDUE-derived SOV. One definition — `AsiSovReport` is an alias. */
export type SOVResult = {
	mention: AsiSovMetric;
	recommendation: AsiSovMetric;
	sampleSize: number;
	sufficient: boolean;
	shares: { brand: number; competitor: number; other: number };
	byProvider: Array<AsiSovSlice & { engine: AsiEngineId; mention: AsiSovMetric; recommendation: AsiSovMetric }>;
	byCategory: Array<AsiSovSlice & { category: AsiSovCategory; mention: AsiSovMetric; recommendation: AsiSovMetric }>;
	byQuery: AsiSovSlice[];
	byPeriod: Array<{
		period: AsiSovPeriod;
		mention: AsiSovMetric;
		recommendation: AsiSovMetric;
		brandShare: number;
		competitorShare: number;
	}>;
};

export type AsiCompetitorRow = AsiWarRoomCompetitor & {
	area: string;
	engineRate: Record<AsiEngineId, number>;
};

export type AsiRecommendationSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	defaultQuery: string;
	testQuery: string;
	testResults: AsiEngineRecommendResult[];
	simulator: {
		potential: number;
		penalties: AsiSimulatorPenalty[];
	};
	sov: {
		overall: number;
		mention: AsiSovMetric;
		recommendation: AsiSovMetric;
		sampleSize: number;
		sufficient: boolean;
		coverage: AsiSovCoverage;
		computedFrom: 'mock' | 'live';
		byQuery: AsiSovSlice[];
		byEngine: Array<AsiSovSlice & { engine: AsiEngineId }>;
		byCategory: Array<AsiSovSlice & { category: AsiSovCategory }>;
		byPeriod: Array<{
			period: AsiSovPeriod;
			mention: AsiSovMetric;
			recommendation: AsiSovMetric;
			brandShare: number;
			competitorShare: number;
		}>;
		timeline: Array<{ period: string; brandShare: number; competitorShare: number; sampleSize?: number }>;
	};
	competitors: AsiCompetitorRow[];
	observationState?: AsiObservationState;
	simulation?: AsiSearchSimulation;
};

export type AsiCitationKind =
	| 'official'
	| 'blog'
	| 'news'
	| 'map'
	| 'review'
	| 'youtube'
	| 'sns'
	| 'third_party'
	| 'schema';

export const ASI_CITATION_KINDS: readonly AsiCitationKind[] = [
	'official',
	'blog',
	'news',
	'map',
	'review',
	'youtube',
	'sns',
	'third_party',
	'schema',
];

export type AsiCitationSourceClass = 'owned' | 'local' | 'third_party' | 'social' | 'unknown';

export const ASI_CITATION_SOURCE_CLASSES: readonly AsiCitationSourceClass[] = [
	'owned',
	'local',
	'third_party',
	'social',
	'unknown',
];

export type AsiCitationMixSlice = {
	count: number;
	percent: number;
};

export type AsiCitationMix = Record<AsiCitationSourceClass, AsiCitationMixSlice>;

export type AsiNormalizedCitation = {
	id: string;
	url: string;
	domain: string;
	title: string;
	sourceType: AsiCitationSourceClass;
	kind: AsiCitationKind;
	brandRelevance: number;
	query: string;
	provider: AsiEngineId;
	cited: boolean;
};

export type AsiCitationReport = {
	computedFrom: 'mock' | 'live';
	available: boolean;
	responseCount: number;
	citedResponseCount: number;
	unavailableProviders: AsiEngineId[];
	mix: AsiCitationMix;
	brandSupportCount: number;
};

export type AsiEvidenceCitation = {
	id: string;
	source: string;
	url: string;
	kind: AsiCitationKind;
	relevance: number;
	authority: number;
	relation: string;
	ownership: AsiCitationOwnership;
	sourceType?: AsiCitationSourceClass;
	domain?: string;
	title?: string;
	query?: string;
	provider?: AsiEngineId;
	cited?: boolean;
	brandRelevance?: number;
};

export type AsiQuestionIntent =
	| 'discovery'
	| 'recommend'
	| 'compare'
	| 'solve'
	| 'purchase'
	| 'local'
	| 'natural';

export const ASI_QUESTION_INTENTS: readonly AsiQuestionIntent[] = [
	'discovery',
	'recommend',
	'compare',
	'solve',
	'purchase',
	'local',
	'natural',
];

export type AsiQuestionInput = {
	industry: string;
	location: string;
	service: string;
	target: string;
};

export type AsiGeneratedQuestion = {
	id: string;
	intent: AsiQuestionIntent;
	query: string;
};

/** Query Intelligence generation outcome. Distinct from observation states. */
export type AsiQueryGenerationStatus =
	| 'NO_DATA'
	| 'CONTEXT_INCOMPLETE'
	| 'GENERATION_FAILED'
	| 'PROVIDER_ERROR'
	| 'QUERY_GENERATED';

export const ASI_QUERY_GENERATION_STATUSES: readonly AsiQueryGenerationStatus[] = [
	'NO_DATA',
	'CONTEXT_INCOMPLETE',
	'GENERATION_FAILED',
	'PROVIDER_ERROR',
	'QUERY_GENERATED',
];

export type AsiQueryContextSource = 'audit' | 'questions' | 'site' | 'none';

export type AsiQueryContextReport = {
	industry: string | null;
	location: string | null;
	services: string[];
	target: string | null;
	intents: string[];
	sources: {
		industry: AsiQueryContextSource;
		location: AsiQueryContextSource;
		services: AsiQueryContextSource;
		target: AsiQueryContextSource;
	};
};

export type AsiQueryGeneration = {
	status: AsiQueryGenerationStatus;
	context: AsiQueryContextReport;
	count: number;
};

/**
 * Canonical query contract for the existing 12 tools. Provider calls, SOV sets,
 * and generated questions all reuse this shape — pages must not invent a second
 * provider query type. The 5 additive features use `Query` in `core/models.ts`
 * and convert back here via `intelligenceQueryToAIQuery`.
 */
export type AIQuery = {
	query: string;
	url?: string;
	brand?: string;
	location?: string;
	category?: string;
	intent?: AsiQuestionIntent | AsiSovCategory;
	id?: string;
};

export type AsiQueryExtract = {
	mentioned: boolean;
	recommended: boolean;
	rank: AsiRecommendRank;
	mentionType: AsiMentionType;
	competitors: string[];
	citations: string[];
};

export type AsiQueryProbeRecord = {
	runId: string;
	timestamp: string;
	query: string;
	provider: AsiEngineId;
	response: {
		answer: string;
		source: AsiSource;
		fallback: boolean;
		error?: string;
	};
	extracted: AsiQueryExtract;
};

export type AsiQueryRun = {
	runId: string;
	timestamp: string;
	siteUrl: string;
	brand: string;
	queries: string[];
	records: AsiQueryProbeRecord[];
};

export type AsiQueryCompareRow = {
	query: string;
	provider: AsiEngineId;
	previous: AsiQueryExtract | null;
	current: AsiQueryExtract;
	mentionChanged: boolean;
	recommendChanged: boolean;
	rankDelta: number | null;
};

export type AsiQueryProbeReport = {
	current: AsiQueryRun | null;
	previous: AsiQueryRun | null;
	compare: AsiQueryCompareRow[];
};

export type AsiMonitorRange = 'today' | '7d' | '14d' | '30d';

export const ASI_MONITOR_RANGES: readonly AsiMonitorRange[] = ['today', '7d', '14d', '30d'];

export type AsiMonitorPoint = {
	label: string;
	mention: number;
	recommendationRate: number;
	shareOfVoice: number;
	citationCount: number;
	visibilityScore: number;
};

export type AsiMonitorLatest = Omit<AsiMonitorPoint, 'label'>;

export type AsiEvidenceSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	citations: AsiEvidenceCitation[];
	citationReport: AsiCitationReport;
	questions: AsiGeneratedQuestion[];
	questionInputs: AsiQuestionInput;
	queryGeneration?: AsiQueryGeneration;
	queryProbe: AsiQueryProbeReport;
	monitor: Record<AsiMonitorRange, AsiMonitorPoint[]>;
	monitorLatest: AsiMonitorLatest;
};

export type AsiReadinessCriterion =
	| 'business_info'
	| 'location'
	| 'opening_hours'
	| 'service_info'
	| 'pricing'
	| 'booking'
	| 'contact'
	| 'faq'
	| 'structured_data'
	| 'entity_consistency'
	| 'trust_signals';

export const ASI_READINESS_CRITERIA: readonly AsiReadinessCriterion[] = [
	'business_info',
	'location',
	'opening_hours',
	'service_info',
	'pricing',
	'booking',
	'contact',
	'faq',
	'structured_data',
	'entity_consistency',
	'trust_signals',
];

export type AsiReadinessStatus = 'ready' | 'partial' | 'gap';

export type AsiReadinessItem = {
	id: AsiReadinessCriterion;
	score: number;
	status: AsiReadinessStatus;
	issue: string;
	fix: string;
};

export type AsiAgentReadinessSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	overall: number;
	items: AsiReadinessItem[];
	statusCounts: Record<AsiReadinessStatus, number>;
};

export const ASI_LOOP_STAGES = [
	'measure',
	'discover',
	'explain',
	'compete',
	'act',
	'monitor',
	'alert',
] as const;

export type AsiLoopStage = (typeof ASI_LOOP_STAGES)[number];

export type AsiLoopLink = {
	id: string;
	title: string;
	href: string;
	meta?: string;
};

export type AsiSearchHealth = {
	current: number;
	previous: number | null;
	change: number | null;
	changePct: number | null;
	provenance: 'derived';
	changeProvenance: 'observed' | null;
};

export type AsiLoopChanges = {
	hasPrevious: boolean;
	queryExposure: number | null;
	citation: number | null;
	competitorName: string | null;
	competitorChangePct: number | null;
	competitorChange: number | null;
};

export type AsiIntelligenceLoop = {
	health: AsiSearchHealth;
	changes: AsiLoopChanges;
	opportunities: AsiLoopLink[];
	gaps: AsiLoopLink[];
	actions: AsiLoopLink[];
	alerts: AsiLoopLink[];
	trend7: AsiVisibilityDelta;
	trend30: AsiVisibilityDelta;
};

export type AsiWarRoomSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	visibility: {
		overall: number;
		engines: AsiEngineVisibility[];
	};
	kpis: AsiWarRoomKpis;
	today: Record<AsiStatusTone, string[]>;
	blockers: AsiWarRoomBlocker[];
	opportunities: AsiWarRoomOpportunity[];
	competitors: AsiWarRoomCompetitor[];
	queries: AsiWarRoomQuery[];
	citations: AsiWarRoomCitation[];
	loop?: AsiIntelligenceLoop;
	validResponseCount?: number;
	queryCount?: number;
	observationState?: AsiObservationState;
};

export type AsiOpportunityStatus = 'win' | 'compete' | 'miss';

export const ASI_OPPORTUNITY_STATUSES: readonly AsiOpportunityStatus[] = ['win', 'compete', 'miss'];

export type AsiOpportunitySignalId =
	| 'searchIntent'
	| 'businessRelevance'
	| 'competitorPresence'
	| 'brandAbsence'
	| 'citationAvailability'
	| 'contentCoverage'
	| 'localRelevance'
	| 'improvementPotential';

export const ASI_OPPORTUNITY_SIGNAL_IDS: readonly AsiOpportunitySignalId[] = [
	'searchIntent',
	'businessRelevance',
	'competitorPresence',
	'brandAbsence',
	'citationAvailability',
	'contentCoverage',
	'localRelevance',
	'improvementPotential',
];

export type AsiOpportunitySignals = Record<AsiOpportunitySignalId, number>;

export type AsiOpportunityEngineRow = {
	engine: AsiEngineId;
	mentioned: boolean;
	recommended: boolean;
	answer: string;
	source: AsiSource;
	fallback?: boolean;
	error?: string;
	citations: string[];
};

export type AsiOpportunityRow = {
	queryId: string;
	query: string;
	intent: AsiQuestionIntent;
	category: AsiSovCategory | 'natural';
	priority: number;
	status: AsiOpportunityStatus;
	isOpportunity: boolean;
	score: number;
	reason: string;
	competitor?: string;
	missingSignals: AsiAuditSignalId[];
	mentionRate: number;
	recommendationRate: number;
	brandMentioned: boolean;
	brandRecommended: boolean;
	citations: string[];
	competitors: string[];
	engines: AsiOpportunityEngineRow[];
	signals: AsiOpportunitySignals;
};

export type AsiOpportunitySnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	summary: {
		total: number;
		win: number;
		compete: number;
		miss: number;
		opportunity: number;
	};
	rows: AsiOpportunityRow[];
	top: AsiOpportunityRow[];
};

/** STEP 3 Evidence Explorer source types. Mapped from observed URLs only. */
export const ASI_EVIDENCE_SOURCE_TYPES = [
	'official',
	'blog',
	'news',
	'review',
	'directory',
	'social',
	'youtube',
	'map',
	'other',
] as const;

export type AsiEvidenceSourceType = (typeof ASI_EVIDENCE_SOURCE_TYPES)[number];

export type AsiEvidenceWhyFactId =
	| 'brand_mentioned'
	| 'brand_recommended'
	| 'official_cited'
	| 'citation_present'
	| 'competitor_mentioned'
	| 'local_entity'
	| 'content_coverage'
	| 'competitor_leads'
	| 'weak_coverage';

export type AsiEvidenceWhyFact = {
	id: AsiEvidenceWhyFactId;
	present: boolean;
	provenance: 'observed' | 'derived';
};

export type AsiEvidenceTraceStep = {
	citation: string | null;
	sourceType: AsiEvidenceSourceType | null;
	relatedPage: string | null;
	brandEntity: string | null;
	competitorEntities: string[];
	available: boolean;
};

export type AsiEvidenceAnswerTrace = {
	id: string;
	provider: AsiEngineId;
	query: string;
	timestamp: string;
	answer: string;
	source: AsiSource;
	fallback?: boolean;
	error?: string;
	brandMentioned: boolean;
	brandRecommended: boolean;
	competitors: string[];
	citations: string[];
	whyObserved: AsiEvidenceWhyFact[];
	whyDerived: AsiEvidenceWhyFact[];
	traces: AsiEvidenceTraceStep[];
	evidenceAvailable: boolean;
};

export type AsiEvidenceSourceRow = {
	url: string;
	sourceType: AsiEvidenceSourceType;
	citedBy: AsiEngineId[];
	query: string;
	relatedTo: 'brand' | 'competitor' | 'unknown';
	entity?: string;
	relatedPage: string | null;
};

export type AsiEvidenceEntityCompare = {
	name: string;
	kind: 'brand' | 'competitor';
	citations: number;
	relevantPages: number;
	externalSources: number;
};

export type AsiEvidenceExplorerSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	answers: AsiEvidenceAnswerTrace[];
	sources: AsiEvidenceSourceRow[];
	brand: AsiEvidenceEntityCompare;
	competitors: AsiEvidenceEntityCompare[];
	summary: {
		answers: number;
		withEvidence: number;
		unavailable: number;
		brandCitations: number;
		competitorCitations: number;
		validResponseCount?: number;
		queryCount?: number;
		observationState?: AsiObservationState;
	};
};

export const ASI_COMPETITOR_GAP_KINDS = [
	'visibility',
	'recommendation',
	'citation',
	'evidence',
	'content',
	'entity',
	'local',
	'authority',
	'coverage',
] as const;

export type AsiCompetitorGapKind = (typeof ASI_COMPETITOR_GAP_KINDS)[number];

export type AsiCompetitorGapMetric = {
	kind: AsiCompetitorGapKind;
	brand: number;
	competitor: number;
	gap: number;
	unit: 'percent' | 'count';
	available: boolean;
};

export type AsiCompetitorGapQueryCompare = {
	query: string;
	competitor: string;
	brand: {
		recommendation: number;
		citation: number;
		mention: number;
	};
	competitorStats: {
		recommendation: number;
		citation: number;
		mention: number;
	};
	gaps: {
		recommendation: number;
		citation: number;
		visibility?: number;
	};
};

export type AsiRankedCompetitor = {
	name: string;
	mentionCount: number;
	recommendCount: number;
};

export type AsiCompetitorGapBoard = {
	name: string;
	mentionCount: number;
	recommendCount: number;
	metrics: AsiCompetitorGapMetric[];
	queries: AsiCompetitorGapQueryCompare[];
	whyTheyWin: AsiCompetitorWhyWin[];
	rows: AsiCompetitorGapRow[];
	top: AsiCompetitorGapRow[];
};

export type AsiCompetitorWhyWin = {
	id: AsiCompetitorGapKind;
	delta: number;
	unit: 'percent' | 'count';
	evidence: string[];
	provenance: 'observed' | 'derived';
};

export type AsiCompetitorGapRow = {
	id: string;
	kind: AsiCompetitorGapKind;
	competitor: string;
	query?: string;
	brandValue: number;
	competitorValue: number;
	gap: number;
	unit: 'percent' | 'count';
	why: string;
	evidence: string[];
	impact: number;
	recommendedAction: string;
	actionCategory:
		| 'content'
		| 'schema'
		| 'citation'
		| 'entity'
		| 'faq'
		| 'local'
		| 'query'
		| 'technical'
		| 'youtube'
		| 'internal_link'
		| 'external_mention';
	available: boolean;
};

export type AsiCompetitorGapSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	brand: AsiEvidenceEntityCompare;
	competitors: AsiEvidenceEntityCompare[];
	selectedCompetitor?: string;
	rankedCompetitors?: AsiRankedCompetitor[];
	boards?: AsiCompetitorGapBoard[];
	metrics: AsiCompetitorGapMetric[];
	queries: AsiCompetitorGapQueryCompare[];
	whyTheyWin: AsiCompetitorWhyWin[];
	rows: AsiCompetitorGapRow[];
	top: AsiCompetitorGapRow[];
	summary: {
		competitorsObserved: number;
		totalGaps: number;
		highImpact: number;
		validResponseCount?: number;
		queryCount?: number;
		observationState?: AsiObservationState;
	};
};

export const ASI_ACTION_KINDS = [
	'content',
	'faq',
	'entity',
	'local',
	'citation',
	'internal_link',
	'schema',
	'youtube',
	'external_mention',
	'query',
] as const;

export type AsiActionKind = (typeof ASI_ACTION_KINDS)[number];

export type AsiActionTier = 'high' | 'medium' | 'low';

export type AsiNextAction = {
	id: string;
	kind: AsiActionKind;
	title: string;
	why: string;
	howToFix: string;
	evidence: string[];
	affectedQueries: string[];
	relatedPages: string[];
	auditHref?: string;
	priority: number;
	priorityTier?: AsiActionTier;
	impact: number;
	effort: number;
	confidence: number;
	impactTier: AsiActionTier;
	effortTier: AsiActionTier;
	confidenceTier: AsiActionTier;
	estimatedImpact: number;
	source: 'opportunity' | 'gap' | 'evidence' | 'audit' | 'readiness';
};

export type AsiNextActionSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	actions: AsiNextAction[];
	top: AsiNextAction[];
	summary: {
		total: number;
		highImpact: number;
		lowEffort: number;
		ruleSet?: string;
	};
};

export const ASI_VISIBILITY_WINDOWS = ['today', '7d', '30d'] as const;
export type AsiVisibilityWindow = (typeof ASI_VISIBILITY_WINDOWS)[number];

export type AsiVisibilityCadence = 'daily' | 'weekly' | 'monthly' | 'on_demand';

export type AsiVisibilityQueryMetric = {
	query: string;
	mentionRate: number;
	recommendationRate: number;
	citationRate: number;
};

export type AsiVisibilityRecord = {
	timestamp: string;
	cadence: AsiVisibilityCadence;
	queryCount: number;
	mention: number;
	visibility: number;
	recommendation: number;
	citation: number;
	sov: number;
	providerScores: Partial<Record<AsiEngineId, number>>;
	competitorScores: Record<string, number>;
	queries: AsiVisibilityQueryMetric[];
	source: AsiSource;
};

export type AsiVisibilityDelta = {
	current: number | null;
	previous: number | null;
	change: number | null;
	changePct: number | null;
	provenance: 'observed';
};

export type AsiVisibilityKpiId = 'visibility' | 'recommendation' | 'citation' | 'sov';

export type AsiVisibilityCompetitorRow = {
	name: string;
	kind: 'brand' | 'competitor';
	current: number | null;
	previous: number | null;
	change: number | null;
};

export type AsiVisibilityTrend = {
	window: AsiVisibilityWindow;
	kpis: Record<AsiVisibilityKpiId, AsiVisibilityDelta>;
	providers: Array<{
		engine: AsiEngineId;
		current: number | null;
		previous: number | null;
		change: number | null;
	}>;
	competitors: AsiVisibilityCompetitorRow[];
	gap: {
		brandCurrent: number | null;
		brandPrevious: number | null;
		competitorName: string | null;
		competitorCurrent: number | null;
		competitorPrevious: number | null;
		widened: boolean;
	};
	points: AsiMonitorPoint[];
	hasPrevious: boolean;
};

export type AsiVisibilityAlertCause = {
	text: string;
	provenance: 'derived';
};

export type AsiVisibilityAlert = {
	id: string;
	type:
		| 'visibility_drop'
		| 'recommendation_drop'
		| 'citation_drop'
		| 'sov_drop'
		| 'competitor_surge'
		| 'query_shift'
		| 'provider_anomaly';
	severity: 'info' | 'warning' | 'critical';
	title: string;
	message: string;
	window: AsiVisibilityWindow;
	previousValue: number;
	currentValue: number;
	change: number;
	relatedQuery?: string;
	relatedCompetitor?: string;
	relatedProvider?: AsiEngineId;
	causes: AsiVisibilityAlertCause[];
	href: string;
};

export type AsiVisibilityRemeasureComparison = {
	previousAt: string;
	currentAt: string;
	queryCount: number;
	visibility: AsiVisibilityDelta;
	sov: AsiVisibilityDelta;
	recommendation: AsiVisibilityDelta;
	citation: AsiVisibilityDelta;
	competitors: AsiVisibilityCompetitorRow[];
	alerts: AsiVisibilityAlert[];
};

export type AsiVisibilityMonitorSnapshot = {
	source: AsiSource;
	analyzedAt: string;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	site: AsiWarRoomSite;
	latest: AsiVisibilityRecord | null;
	historyCount: number;
	reused: boolean;
	remeasured: boolean;
	nextEligibleAt: string | null;
	enrolled: Exclude<AsiVisibilityCadence, 'on_demand'> | null;
	trends: Record<AsiVisibilityWindow, AsiVisibilityTrend>;
	alerts: AsiVisibilityAlert[];
	comparison: AsiVisibilityRemeasureComparison | null;
	persistVersion?: string;
};

/** Canonical result names. These alias existing snapshot/row types — do not add parallel models. */
export type CompetitorResult = AsiCompetitorRow;
export type BrandPerceptionResult = AsiPerceptionSnapshot;
export type ReputationResult = AsiPerceptionSnapshot;
export type VisibilityResult = AsiVisibilityMonitorSnapshot;
export type AgentReadinessResult = AsiAgentReadinessSnapshot;

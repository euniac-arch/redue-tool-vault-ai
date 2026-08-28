import type { IndustryType as RegistryIndustryType } from '@/lib/registry/universalIndustryRegistry';
import type { IndustryType as LegacyIndustryType } from '@/lib/audit/site-metadata';
import type { ScoreGrade } from '@/lib/audit/score-grade';

export type StrategyLang = 'ko' | 'en';

export type StrategyLoadSource = 'api' | 'guest-history' | 'latest-payload';

/** A measured 0–100 value. Omit the field entirely when the audit never produced it. */
export interface MeasuredScore {
	value: number;
	grade?: ScoreGrade;
}

/**
 * Headline axes the studio can display.
 * `aeo` / `content` stay absent — the audit engine does not emit independent scores.
 * `trust` is omitted when it would only duplicate GEO (`externalTrustScore`).
 */
export interface StrategyScoreBoard {
	seo: MeasuredScore | null;
	geo: MeasuredScore | null;
	aeo: MeasuredScore | null;
	entity: MeasuredScore | null;
	local: MeasuredScore | null;
	content: MeasuredScore | null;
	trust: MeasuredScore | null;
	measured: MeasuredScore | null;
}

export interface StrategyEntitySignals {
	brandName?: string;
	organizationName?: string;
	representativeName?: string;
	businessEntity?: string;
	phrases: string[];
	schemaTypes: string[];
}

export interface StrategyLocalSignals {
	location?: string;
	broadLocation?: string;
	address?: string;
	addressLocality?: string;
	addressRegion?: string;
	telephone?: string;
	hasGeo: boolean;
	hasOpeningHours: boolean;
	sameAsCount: number;
}

export type KnownPageRole = 'home' | 'service' | 'condition' | 'person' | 'local' | 'faq' | 'other';

export interface StrategyKnownPage {
	url: string;
	label: string;
	role: KnownPageRole;
	source: 'audit-url' | 'nav' | 'collected' | 'page-meta';
}

export interface StrategyContentSignals {
	bodyTextLength?: number;
	h1Count?: number;
	faqCount?: number;
}

export interface StrategyTrustSignals {
	isHttps: boolean;
	sameAsCount: number;
}

export interface StrategySchemaSignals {
	coverage?: number;
	types: string[];
}

export interface StrategyIssue {
	id: string;
	title: string;
	detail?: string;
	severity?: 'critical' | 'warning' | 'fail';
}

export interface StrategyCompetitorSnapshot {
	query?: string;
	names: string[];
	clientRank?: number;
	source?: string;
}

export interface StrategyIndustryProfileRef {
	registryType: RegistryIndustryType;
	legacyType: LegacyIndustryType;
	label: string;
	schemaType?: string;
	specialties: string[];
}

export interface StrategyAuditContext {
	auditId: string | null;
	url: string;
	siteName: string;
	industry: string;
	industryType: LegacyIndustryType;
	subIndustry: string | null;
	location: string | null;
	scores: StrategyScoreBoard;
	entities: StrategyEntitySignals;
	localSignals: StrategyLocalSignals;
	contentSignals: StrategyContentSignals;
	trustSignals: StrategyTrustSignals;
	schema: StrategySchemaSignals;
	pages: StrategyKnownPage[];
	issues: StrategyIssue[];
	recommendations: string[];
	competitors: StrategyCompetitorSnapshot | null;
	fetchedAt: string;
	source: StrategyLoadSource;
}

export interface TargetKeywordState {
	/** First-rank keyword from recommended groups (or a location+industry fallback). */
	seed: string | null;
	value: string;
}

export type SearchIntentId =
	| 'local'
	| 'category'
	| 'service'
	| 'problem'
	| 'comparison'
	| 'recommendation'
	| 'list'
	| 'naturalLanguage'
	| 'aiRecommendation';

export type StrategyPriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type EntityCoverage = 'present' | 'partial' | 'missing';

export type IndustryRelevance = 'high' | 'medium' | 'low';

export interface NormalizedKeyword {
	raw: string;
	location: string[];
	industry: string | null;
	industryType: RegistryIndustryType | null;
	service: string | null;
	problem: string | null;
	intentMarkers: string[];
}

export interface IndustryMatch {
	auditType: RegistryIndustryType;
	keywordType: RegistryIndustryType | null;
	relevance: IndustryRelevance;
	note: string;
}

export interface StrategyEntityNode {
	id: string;
	role: string;
	label: string;
	status: EntityCoverage;
}

export interface StrategySearchSurface {
	id: 'naver' | 'google' | 'chatgpt' | 'gemini' | 'perplexity';
	label: string;
	related: boolean;
	reason: string;
}

export interface StrategyProfileSignal {
	id: string;
	label: string;
	emphasized: boolean;
}

export interface StrategyAxisCompare {
	axis: string;
	currentLabel: string;
	currentValue?: number;
	targetLabel: string;
	targetHint: string;
}

export interface StrategyGap {
	id: string;
	code: 'ENTITY' | 'LOCAL' | 'CONTENT' | 'AEO' | 'TRUST' | 'SCHEMA';
	title: string;
	current: string;
	strategy: string;
	priority: StrategyPriorityLevel;
	why: string;
	what: string;
	how: string[];
	expectedImpact: string;
	weight: number;
}

export interface StrategyPriorityItem {
	id: string;
	level: StrategyPriorityLevel;
	title: string;
}

export interface StrategyMove {
	gapId: string;
	title: string;
	why: string;
	what: string;
	how: string[];
	expectedImpact: string;
}

export interface StrategyFaqSample {
	q: string;
	a: string;
}

export interface StrategyExecutionSample {
	keyword: string;
	title: string;
	metaDescription: string;
	h1: string;
	h2: string[];
	faqs: StrategyFaqSample[];
	answer: string;
	internalLinks: string[];
	entitySentence: string;
	schemaRecommendation: string[];
}

export interface StrategyActionPlan {
	today: string[];
	thisWeek: string[];
	next: string[];
	p0: string[];
	p1: string[];
	p2: string[];
}

export type PageStrategyKind = 'local_industry_guide' | 'service_hub' | 'specialist_content' | 'selection_guide';

export type SchemaConsideration = 'consider' | 'already_present' | 'skip';

export interface ExecutionCopyUnit {
	id: 'title' | 'meta' | 'h1' | 'faq' | 'answer' | 'entitySentence' | 'schema';
	label: string;
	text: string;
}

export interface BlueprintPageStrategy {
	keyword: string;
	pageType: PageStrategyKind;
	pageTypeLabel: string;
	intents: SearchIntentId[];
	intentLabel: string;
}

export interface BlueprintSeo {
	title: string;
	metaDescription: string;
	h1: string;
	h2: string[];
	urlSlug: string;
	slugNote: string;
	canonical: string;
	canonicalNote: string;
}

export interface BlueprintAeo {
	question: string;
	shortAnswer: string;
	detail: string;
	relatedServices: string[];
}

export interface BlueprintGeoNode {
	id: string;
	role: string;
	label: string;
}

export interface BlueprintGeo {
	chain: BlueprintGeoNode[];
	entitySentence: string;
}

export interface BlueprintContentBlock {
	id: 'h1' | 'introduction' | 'question' | 'answer' | 'evidence' | 'service' | 'faq' | 'cta';
	label: string;
	text: string;
}

export interface BlueprintSchemaCandidate {
	type: string;
	status: SchemaConsideration;
	reason: string;
}

export interface BlueprintSchema {
	candidates: BlueprintSchemaCandidate[];
	jsonLd: Record<string, unknown>;
	jsonLdText: string;
	note: string;
}

export interface BlueprintInternalLink {
	role: KnownPageRole;
	roleLabel: string;
	url: string | null;
	pageLabel: string | null;
	note: string;
}

export interface BlueprintLocalNode {
	label: string;
	source: 'audit' | 'address' | 'keyword-overlap';
}

export interface BlueprintLocal {
	chain: BlueprintLocalNode[];
	note: string;
}

export interface BlueprintAction {
	p0: string[];
	p1: string[];
	p2: string[];
}

/** Variant id from an injected `BlueprintProfile`. New industries add ids in the profile map, not in engine switches. */
export type AiCitationTopic = string;

export interface BlueprintDecisionMatrixRow {
	type: string;
	recommended: string;
	device: string;
	caution: string;
	downtime?: string;
}

export interface BlueprintDecisionMatrix {
	topic: AiCitationTopic;
	title: string;
	caption: string;
	columns: string[];
	rows: BlueprintDecisionMatrixRow[];
	markdown: string;
	html: string;
}

export interface BlueprintRagChunk {
	id: string;
	title: string;
	text: string;
	tokenEstimate: number;
}

export interface BlueprintInformationGainItem {
	id: string;
	label: string;
	value: string;
	unit?: string;
	note?: string;
}

export interface BlueprintInformationGain {
	topic: AiCitationTopic;
	title: string;
	caption: string;
	items: BlueprintInformationGainItem[];
}

export interface BlueprintSafetySignals {
	heading: string;
	notRecommended: string[];
	sideEffects: string[];
	contraindications: string[];
	disclaimer: string;
}

export interface BlueprintLlmsTxt {
	filename: 'llms.txt';
	deployPath: '/llms.txt';
	markdown: string;
}

/** Export-ready execution payload. File download is a later step. */
export interface ExecutionBlueprint {
	version: 1;
	keyword: string;
	pageStrategy: BlueprintPageStrategy;
	seo: BlueprintSeo;
	aeo: BlueprintAeo;
	geo: BlueprintGeo;
	entity: BlueprintGeo;
	content: BlueprintContentBlock[];
	schema: BlueprintSchema;
	internalLinks: BlueprintInternalLink[];
	local: BlueprintLocal;
	action: BlueprintAction;
	copyUnits: ExecutionCopyUnit[];
	decisionMatrix: BlueprintDecisionMatrix;
	ragChunks: BlueprintRagChunk[];
	informationGain: BlueprintInformationGain;
	safetySignals: BlueprintSafetySignals;
	llmsTxt: BlueprintLlmsTxt;
}

export type QualitativeWeight = 'primary' | 'secondary' | 'idle';

export type CoverageLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type StrategyConfidenceLevel = 'high' | 'medium' | 'low';

export type ClusterPageKind = 'existing' | 'new';

export type StrategyJourneyStage =
	| 'location'
	| 'industry'
	| 'service'
	| 'problem'
	| 'comparison'
	| 'recommendation'
	| 'ai';

export interface StrategyIntentWeight {
	id: SearchIntentId;
	label: string;
	weight: QualitativeWeight;
}

export interface StrategyJourneyStep {
	id: string;
	stage: StrategyJourneyStage;
	label: string;
	value: string;
}

export interface StrategyEntityStatusItem {
	id: string;
	role: string;
	label: string;
	status: EntityCoverage;
	whyNeeded?: string;
	whatToAdd?: string;
}

export interface StrategyEntityTreeNode {
	id: string;
	role: string;
	label: string;
	status: EntityCoverage;
	children: StrategyEntityTreeNode[];
}

export interface StrategySurfaceSignal {
	id: string;
	label: string;
}

export interface StrategySurfaceCard {
	id: StrategySearchSurface['id'];
	label: string;
	related: boolean;
	reason: string;
	signals: StrategySurfaceSignal[];
	modelNote: string;
}

export type AxisCoverageSource = 'audit-score' | 'audit-signal' | 'qualitative';

export interface StrategyAxisCoverage {
	axis: string;
	code: StrategyGap['code'];
	currentLevel: CoverageLevel;
	currentLabel: string;
	currentValue?: number;
	currentSource: AxisCoverageSource;
	targetLevel: CoverageLevel;
	targetLabel: string;
	gapLevel: CoverageLevel;
	dots: number;
}

export interface StrategyMapPriority {
	id: string;
	rank: 'P0' | 'P1' | 'P2';
	title: string;
	whyFirst: string;
	why: string;
	what: string;
	how: string[];
}

export interface StrategyCompetitionView {
	ready: boolean;
	keyword: string;
	names: string[];
	gapAxes: string[];
	note: string;
}

export interface StrategyClusterNode {
	id: string;
	label: string;
	kind: ClusterPageKind;
	url: string | null;
	role: string;
	children: StrategyClusterNode[];
}

export interface StrategyMapSummary {
	target: string;
	industry: string;
	location: string | null;
	primaryIntent: string;
	topGap: string;
	secondGap: string | null;
	topAction: string;
}

export interface StrategyConfidence {
	level: StrategyConfidenceLevel;
	label: string;
	reasons: string[];
}

export interface KeywordPortfolioSlot {
	keyword: string;
	active: boolean;
}

/** Reserved for a future KEYWORD PORTFOLIO. Current UI is single-keyword. */
export interface KeywordPortfolio {
	version: 1;
	activeKeyword: string;
	slots: KeywordPortfolioSlot[];
}

export interface SearchStrategyMap {
	version: 1;
	keyword: string;
	industry: { type: string; label: string; specialty: string | null };
	location: { tokens: string[]; display: string | null };
	intent: StrategyIntentWeight[];
	journey: StrategyJourneyStep[];
	entityTree: StrategyEntityTreeNode;
	entityStatus: StrategyEntityStatusItem[];
	searchSurfaces: StrategySurfaceCard[];
	coverage: StrategyAxisCoverage[];
	priorities: StrategyMapPriority[];
	competition: StrategyCompetitionView;
	contentCluster: StrategyClusterNode;
	actionPlan: { today: string[]; thisWeek: string[]; next: string[] };
	summary: StrategyMapSummary;
	confidence: StrategyConfidence;
	portfolio: KeywordPortfolio;
}

export interface StrategyResult {
	keyword: string;
	normalized: NormalizedKeyword;
	industry: IndustryMatch;
	intent: SearchIntentId[];
	/** @deprecated use `intent` */
	intents: SearchIntentId[];
	entities: StrategyEntityNode[];
	searchSurfaces: StrategySearchSurface[];
	currentState: StrategyAxisCompare[];
	targetState: StrategyAxisCompare[];
	gaps: StrategyGap[];
	priorities: StrategyPriorityItem[];
	strategies: StrategyMove[];
	samples: StrategyExecutionSample;
	/** @deprecated use `samples` */
	sample: StrategyExecutionSample;
	blueprint: ExecutionBlueprint;
	actionPlan: StrategyActionPlan;
	strategyMap: SearchStrategyMap;
	profileCode: string;
	specialtyCode: string | null;
	profileSignals: StrategyProfileSignal[];
	comparison: StrategyAxisCompare[];
}

export type CopilotRefineTarget =
	| 'title'
	| 'meta'
	| 'h1'
	| 'faq'
	| 'answer'
	| 'entitySentence'
	| 'content'
	| 'strategy'
	| 'action';

export type CopilotProvider = 'openai' | 'gemini' | 'heuristic';

/** Compact engine snapshot passed to AI. Keyword-only prompts are not allowed. */
export interface StrategyCopilotContext {
	version: 1;
	lang: StrategyLang;
	keyword: string;
	audit: {
		url: string;
		siteName: string;
		industry: string;
		location: string | null;
		scores: { seo: number | null; geo: number | null };
		schemaTypes: string[];
		issues: string[];
	};
	industryProfile: {
		type: string;
		label: string;
		schemaType?: string;
		specialties: string[];
	};
	intent: SearchIntentId[];
	entities: Array<{ role: string; label: string; status: EntityCoverage }>;
	currentState: Array<{ axis: string; currentLabel: string }>;
	gaps: Array<{ code: string; title: string; priority: StrategyPriorityLevel; current: string; strategy: string }>;
	priorities: Array<{ id: string; level: StrategyPriorityLevel; title: string }>;
	target: CopilotRefineTarget;
	currentText: string;
}

export interface CopilotRefineRequest {
	context: StrategyCopilotContext;
}

export interface CopilotRefineResponse {
	target: CopilotRefineTarget;
	refinedText: string;
	provider: CopilotProvider;
	model?: string;
	warning?: string;
}

export interface StrategyStudioState {
	auditContext: StrategyAuditContext | null;
	industryProfile: StrategyIndustryProfileRef | null;
	targetKeyword: TargetKeywordState;
	strategyResult: StrategyResult | null;
}

/**
 * Shared Intelligence Core models for the 5 additive features
 * (Opportunity Finder, Evidence Explorer, Competitor Gap, Next Best Action,
 * Visibility Monitor + Alert).
 *
 * These types sit on top of the existing 12-tool contracts (`AIQuery`,
 * `AIResponse`, SOV / citation stores). They do not replace them.
 *
 * OBSERVED  = values taken from a provider answer (or a parse of that answer).
 * DERIVED   = values REDUE computed. Never present these as "the AI said".
 */
import type { AsiProvenance } from '@/lib/ai-search-intelligence/provenance';
import type {
	AsiAuditSignalId,
	AsiCitationKind,
	AsiCitationSourceClass,
	AsiEngineId,
	AsiQuestionIntent,
	AsiRecommendRank,
	AsiSource,
	AsiSovCategory,
} from '@/lib/ai-search-intelligence/types';

export type { AsiProvenance };

export type ObservedValue<T> = {
	value: T;
	provenance: 'observed';
};

export type DerivedValue<T> = {
	value: T;
	provenance: 'derived';
};

export function observedOf<T>(value: T): ObservedValue<T> {
	return { value, provenance: 'observed' };
}

export function derivedOf<T>(value: T): DerivedValue<T> {
	return { value, provenance: 'derived' };
}

export type IntelligenceQueryIntent = AsiQuestionIntent;
export type IntelligenceQueryCategory = AsiSovCategory | 'natural';

/**
 * Canonical query for the 5 new features.
 * Maps from / to `AIQuery` — provider calls still use `AIQuery` only.
 *
 * Priority is always DERIVED. Query text is the only provider input.
 */
export type Query = {
	id: string;
	text: string;
	category: IntelligenceQueryCategory;
	intent: IntelligenceQueryIntent;
	location?: string;
	service?: string;
	priority: DerivedValue<number>;
};

export type AIObservation = {
	provider: AsiEngineId;
	query: string;
	timestamp: string;
	source: AsiSource;
	answer: ObservedValue<string>;
	brandMention: ObservedValue<boolean>;
	recommendation: ObservedValue<boolean>;
	competitors: ObservedValue<string[]>;
	citations: ObservedValue<string[]>;
	confidence: ObservedValue<number>;
};

export type Evidence = {
	source: string;
	url: ObservedValue<string>;
	title: string;
	snippet?: string;
	sourceType: DerivedValue<AsiCitationSourceClass | AsiCitationKind>;
	relevance: DerivedValue<number>;
	citedBy: ObservedValue<AsiEngineId[]>;
	timestamp: string;
};

export type CompetitorObservation = {
	competitor: ObservedValue<string>;
	query: string;
	provider: AsiEngineId;
	mention: ObservedValue<boolean>;
	recommendation: ObservedValue<boolean>;
	citation?: ObservedValue<string>;
	rank: DerivedValue<AsiRecommendRank>;
	evidence: ObservedValue<string[]>;
};

export type Opportunity = {
	query: string;
	priority: DerivedValue<number>;
	reason: string;
	competitor?: string;
	missingSignals: AsiAuditSignalId[];
	estimatedImpact: DerivedValue<number>;
	recommendedAction: string;
};

export type IntelligenceActionCategory =
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

export type Action = {
	id: string;
	title: string;
	reason: string;
	priority: DerivedValue<number>;
	category: IntelligenceActionCategory;
	affectedQueries: string[];
	expectedImpact: DerivedValue<number>;
	relatedPages: string[];
};

export type VisibilitySnapshot = {
	timestamp: string;
	totalQueries: ObservedValue<number>;
	visibilityScore: DerivedValue<number | null>;
	recommendationRate: DerivedValue<number | null>;
	citationRate: DerivedValue<number | null>;
	shareOfVoice: DerivedValue<number | null>;
	competitorScores: DerivedValue<Record<string, number>>;
	providerScores: DerivedValue<Partial<Record<AsiEngineId, number>>>;
};

export type IntelligenceAlertType =
	| 'visibility_drop'
	| 'recommendation_drop'
	| 'sov_drop'
	| 'citation_drop'
	| 'competitor_surge'
	| 'query_shift'
	| 'provider_anomaly';

export type IntelligenceAlertSeverity = 'info' | 'warning' | 'critical';

export type Alert = {
	type: IntelligenceAlertType;
	severity: IntelligenceAlertSeverity;
	message: string;
	relatedQuery?: string;
	relatedCompetitor?: string;
	previousValue: ObservedValue<number>;
	currentValue: ObservedValue<number>;
	createdAt: string;
};

/**
 * Mock and live engines must return this same bundle for the 5 new features.
 * Existing 12-tool snapshots stay unchanged.
 */
export type IntelligenceCoreBundle = {
	queries: Query[];
	observations: AIObservation[];
	evidence: Evidence[];
	competitors: CompetitorObservation[];
	opportunities: Opportunity[];
	actions: Action[];
	visibility: VisibilitySnapshot | null;
	alerts: Alert[];
};

export function emptyIntelligenceCore(): IntelligenceCoreBundle {
	return {
		queries: [],
		observations: [],
		evidence: [],
		competitors: [],
		opportunities: [],
		actions: [],
		visibility: null,
		alerts: [],
	};
}

/**
 * Field-level catalog so UI / tests cannot mix OBSERVED and DERIVED.
 * Keys match the 8 core concepts.
 */
export const INTELLIGENCE_CORE_PROVENANCE = {
	query: {
		id: 'derived',
		text: 'derived',
		category: 'derived',
		intent: 'derived',
		location: 'derived',
		service: 'derived',
		priority: 'derived',
	},
	observation: {
		provider: 'observed',
		query: 'observed',
		timestamp: 'observed',
		answer: 'observed',
		brandMention: 'observed',
		recommendation: 'observed',
		competitors: 'observed',
		citations: 'observed',
		confidence: 'observed',
	},
	evidence: {
		url: 'observed',
		citedBy: 'observed',
		sourceType: 'derived',
		relevance: 'derived',
	},
	competitor: {
		competitor: 'observed',
		mention: 'observed',
		recommendation: 'observed',
		citation: 'observed',
		evidence: 'observed',
		rank: 'derived',
	},
	opportunity: {
		priority: 'derived',
		estimatedImpact: 'derived',
		missingSignals: 'derived',
		reason: 'derived',
	},
	action: {
		priority: 'derived',
		expectedImpact: 'derived',
		category: 'derived',
	},
	visibility: {
		totalQueries: 'observed',
		visibilityScore: 'derived',
		recommendationRate: 'derived',
		citationRate: 'derived',
		shareOfVoice: 'derived',
		competitorScores: 'derived',
		providerScores: 'derived',
	},
	alert: {
		previousValue: 'observed',
		currentValue: 'observed',
		severity: 'derived',
		type: 'derived',
	},
} as const satisfies Record<string, Record<string, AsiProvenance>>;

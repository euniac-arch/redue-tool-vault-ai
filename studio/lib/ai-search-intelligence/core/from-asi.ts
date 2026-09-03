/**
 * Map existing 12-tool ASI types onto Intelligence Core models.
 * No provider I/O — live and mock snapshots both pass through here.
 */
import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import {
	derivedOf,
	emptyIntelligenceCore,
	observedOf,
	type AIObservation,
	type Action,
	type Alert,
	type CompetitorObservation,
	type Evidence,
	type IntelligenceActionCategory,
	type IntelligenceCoreBundle,
	type IntelligenceQueryCategory,
	type IntelligenceQueryIntent,
	type Opportunity,
	type Query,
	type VisibilitySnapshot,
} from '@/lib/ai-search-intelligence/core/models';
import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import { ASI_VISIBILITY_CONFIG } from '@/lib/ai-search-intelligence/visibility/config';
import type {
	AIQuery,
	AIResponse,
	AsiAuditSignalId,
	AsiCitationKind,
	AsiCitationSourceClass,
	AsiEngineId,
	AsiEvidenceCitation,
	AsiGeneratedQuestion,
	AsiMonitorLatest,
	AsiNormalizedCitation,
	AsiSovObservation,
	AsiWarRoomOpportunity,
	AsiWarRoomSnapshot,
	CitationResult,
	SOVResult,
} from '@/lib/ai-search-intelligence/types';
import { ASI_QUESTION_INTENTS } from '@/lib/ai-search-intelligence/types';

const INTENT_PRIORITY: Record<IntelligenceQueryIntent, number> = {
	recommend: 90,
	compare: 75,
	solve: 70,
	purchase: 65,
	local: 60,
	discovery: 50,
	natural: 40,
};

function slugId(text: string, prefix: string): string {
	const slug = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 48);
	return `${prefix}-${slug || 'item'}`;
}

function asIntent(value: string | undefined): IntelligenceQueryIntent {
	if (value && (ASI_QUESTION_INTENTS as readonly string[]).includes(value)) {
		return value as IntelligenceQueryIntent;
	}
	return classifyAsiSovQuery(value || '') as IntelligenceQueryIntent;
}

function asCategory(intent: IntelligenceQueryIntent, text: string): IntelligenceQueryCategory {
	if (intent === 'natural') return 'natural';
	return classifyAsiSovQuery(text);
}

export function derivedQueryPriority(intent: IntelligenceQueryIntent): number {
	return INTENT_PRIORITY[intent];
}

export function toIntelligenceQuery(
	input: AIQuery | AsiGeneratedQuestion | { query: string; category?: string; id?: string },
	extras?: { location?: string; service?: string; priority?: number },
): Query {
	const text = 'query' in input ? input.query : '';
	const id = 'id' in input && input.id ? input.id : slugId(text, 'q');
	const rawIntent = 'intent' in input ? input.intent : 'category' in input ? input.category : undefined;
	const intent = asIntent(typeof rawIntent === 'string' ? rawIntent : text);
	const location = extras?.location || ('location' in input ? input.location : undefined);
	const service = extras?.service || ('category' in input && 'brand' in input ? input.category : undefined);
	return {
		id,
		text,
		category: asCategory(intent, text),
		intent,
		location,
		service,
		priority: derivedOf(extras?.priority ?? derivedQueryPriority(intent)),
	};
}

export function toAIQuery(query: Query, extras?: Pick<AIQuery, 'url' | 'brand'>): AIQuery {
	return {
		id: query.id,
		query: query.text,
		intent: query.intent,
		location: query.location,
		category: query.service,
		url: extras?.url,
		brand: extras?.brand,
	};
}

export function toAIObservation(
	response: AIResponse,
	input: { brand: string; aliases?: readonly string[] },
): AIObservation {
	const analysis = analyzeAsiAnswer(response, input);
	return {
		provider: response.provider,
		query: response.query,
		timestamp: response.timestamp,
		source: response.source,
		answer: observedOf(response.answer),
		brandMention: observedOf(analysis.brandMentioned),
		recommendation: observedOf(analysis.recommended),
		competitors: observedOf(analysis.competitors),
		citations: observedOf(analysis.citations),
		confidence: observedOf(response.confidence),
	};
}

export function toAIObservations(
	responses: readonly AIResponse[],
	input: { brand: string; aliases?: readonly string[] },
): AIObservation[] {
	return responses.map((response) => toAIObservation(response, input));
}

function evidenceFromCitation(input: {
	source: string;
	url: string;
	title?: string;
	snippet?: string;
	sourceType: AsiCitationSourceClass | AsiCitationKind;
	relevance: number;
	citedBy: AsiEngineId[];
	timestamp: string;
}): Evidence {
	return {
		source: input.source,
		url: observedOf(input.url),
		title: input.title || input.source,
		snippet: input.snippet,
		sourceType: derivedOf(input.sourceType),
		relevance: derivedOf(input.relevance),
		citedBy: observedOf(input.citedBy),
		timestamp: input.timestamp,
	};
}

export function evidenceFromCitationResult(
	citation: CitationResult,
	input: { provider?: AsiEngineId; timestamp?: string },
): Evidence {
	return evidenceFromCitation({
		source: citation.source,
		url: citation.url,
		title: citation.source,
		sourceType: citation.type,
		relevance: citation.relevance,
		citedBy: input.provider ? [input.provider] : [],
		timestamp: input.timestamp || new Date().toISOString(),
	});
}

export function evidenceFromNormalized(citation: AsiNormalizedCitation, timestamp?: string): Evidence {
	return evidenceFromCitation({
		source: citation.domain,
		url: citation.url,
		title: citation.title,
		sourceType: citation.sourceType,
		relevance: citation.brandRelevance,
		citedBy: [citation.provider],
		timestamp: timestamp || new Date().toISOString(),
	});
}

export function evidenceFromExplorerRow(citation: AsiEvidenceCitation, timestamp?: string): Evidence {
	return evidenceFromCitation({
		source: citation.source,
		url: citation.url,
		title: citation.title || citation.source,
		sourceType: citation.sourceType || citation.kind,
		relevance: citation.relevance,
		citedBy: citation.provider ? [citation.provider] : [],
		timestamp: timestamp || new Date().toISOString(),
	});
}

export function competitorsFromObservation(
	observation: AIObservation | AsiSovObservation,
	extras?: { rank?: AsiSovObservation['rank'] },
): CompetitorObservation[] {
	const query = observation.query;
	const provider = observation.provider;
	if ('competitors' in observation && observation.competitors.provenance === 'observed') {
		return observation.competitors.value.map((name) => ({
			competitor: observedOf(name),
			query,
			provider,
			mention: observedOf(true),
			recommendation: observedOf(false),
			rank: derivedOf(null),
			evidence: observedOf(observation.citations.value),
		}));
	}
	const sov = observation as AsiSovObservation;
	return sov.competitorMentions.map((name) => ({
		competitor: observedOf(name),
		query,
		provider,
		mention: observedOf(true),
		recommendation: observedOf(sov.recommended),
		rank: derivedOf(extras?.rank ?? sov.rank),
		evidence: observedOf(sov.citations),
	}));
}

export function competitorsFromResponse(
	response: AIResponse,
	input: { brand: string; aliases?: readonly string[] },
): CompetitorObservation[] {
	const analysis = analyzeAsiAnswer(response, input);
	return analysis.competitors.map((name) => ({
		competitor: observedOf(name),
		query: response.query,
		provider: response.provider,
		mention: observedOf(true),
		recommendation: observedOf(analysis.recommendations.some((item) => item === name)),
		citation: analysis.citations[0] ? observedOf(analysis.citations[0]) : undefined,
		rank: derivedOf(null),
		evidence: observedOf(analysis.citations),
	}));
}

export { opportunityFromRow } from '@/lib/ai-search-intelligence/opportunity/analyze';

export function opportunitiesFromWarRoom(snapshot: AsiWarRoomSnapshot): Opportunity[] {
	return snapshot.opportunities.map((item: AsiWarRoomOpportunity) => ({
		query: item.title,
		priority: derivedOf(item.impact),
		reason: item.detail,
		missingSignals: [],
		estimatedImpact: derivedOf(item.impact),
		recommendedAction: item.title,
	}));
}

const ACTION_CATEGORY_FROM_SIGNAL: Record<AsiAuditSignalId, IntelligenceActionCategory> = {
	schema: 'schema',
	entity: 'entity',
	local: 'local',
	content: 'content',
	faq: 'faq',
	citation: 'citation',
	technical: 'technical',
};

export function actionFromOpportunity(
	opportunity: Opportunity,
	extras?: { id?: string; relatedPages?: string[]; category?: IntelligenceActionCategory },
): Action {
	const category = extras?.category ?? (opportunity.missingSignals[0] ? ACTION_CATEGORY_FROM_SIGNAL[opportunity.missingSignals[0]] : 'query');
	return {
		id: extras?.id || slugId(opportunity.recommendedAction, 'act'),
		title: opportunity.recommendedAction,
		reason: opportunity.reason,
		priority: opportunity.priority,
		category,
		affectedQueries: opportunity.query ? [opportunity.query] : [],
		expectedImpact: opportunity.estimatedImpact,
		relatedPages: extras?.relatedPages ?? [],
	};
}

export function visibilityFromObservations(
	observations: readonly AIObservation[],
	extras?: {
		sov?: Pick<SOVResult, 'shares'> | null;
		monitor?: AsiMonitorLatest | null;
		competitorScores?: Record<string, number>;
		timestamp?: string;
	},
): VisibilitySnapshot {
	const total = new Set(observations.map((row) => row.query)).size;
	const mentioned = observations.filter((row) => row.brandMention.value).length;
	const recommended = observations.filter((row) => row.recommendation.value).length;
	const cited = observations.filter((row) => row.citations.value.length > 0).length;
	const sample = observations.length;

	const providerScores: Partial<Record<AsiEngineId, number>> = {};
	for (const row of observations) {
		const prev = providerScores[row.provider] ?? 0;
		providerScores[row.provider] = prev + (row.recommendation.value ? 2 : row.brandMention.value ? 1 : 0);
	}

	const recommendationRate = extras?.monitor?.recommendationRate ?? (sample ? Math.round((recommended / sample) * 100) : null);
	const citationRate = sample ? Math.round((cited / sample) * 100) : null;
	const visibilityScore =
		extras?.monitor?.visibilityScore ?? (sample ? Math.round((mentioned / sample) * 70 + (recommended / sample) * 30) : null);
	const shareOfVoice = extras?.sov?.shares.brand ?? extras?.monitor?.shareOfVoice ?? null;

	return {
		timestamp: extras?.timestamp || new Date().toISOString(),
		totalQueries: observedOf(total),
		visibilityScore: derivedOf(visibilityScore),
		recommendationRate: derivedOf(recommendationRate),
		citationRate: derivedOf(citationRate),
		shareOfVoice: derivedOf(shareOfVoice),
		competitorScores: derivedOf(extras?.competitorScores ?? {}),
		providerScores: derivedOf(providerScores),
	};
}

export function alertFromDelta(input: {
	type: Alert['type'];
	severity?: Alert['severity'];
	message: string;
	previousValue: number;
	currentValue: number;
	relatedQuery?: string;
	relatedCompetitor?: string;
	createdAt?: string;
}): Alert {
	const drop = input.previousValue - input.currentValue;
	const { criticalDrop, warningDrop } = ASI_VISIBILITY_CONFIG.alerts;
	const severity =
		input.severity ?? (drop >= criticalDrop ? 'critical' : drop >= warningDrop ? 'warning' : 'info');
	return {
		type: input.type,
		severity,
		message: input.message,
		relatedQuery: input.relatedQuery,
		relatedCompetitor: input.relatedCompetitor,
		previousValue: observedOf(input.previousValue),
		currentValue: observedOf(input.currentValue),
		createdAt: input.createdAt || new Date().toISOString(),
	};
}

export function buildIntelligenceCore(input: {
	queries?: Array<AIQuery | AsiGeneratedQuestion | Query>;
	responses?: readonly AIResponse[];
	citations?: readonly (AsiNormalizedCitation | AsiEvidenceCitation | CitationResult)[];
	sovRows?: readonly AsiSovObservation[];
	warRoom?: AsiWarRoomSnapshot | null;
	sov?: Pick<SOVResult, 'shares'> | null;
	monitor?: AsiMonitorLatest | null;
	brand: string;
	aliases?: readonly string[];
	location?: string;
	service?: string;
}): IntelligenceCoreBundle {
	const bundle = emptyIntelligenceCore();
	const extras = { location: input.location, service: input.service };

	bundle.queries = (input.queries ?? []).map((item) =>
		'text' in item && 'priority' in item ? item : toIntelligenceQuery(item, extras),
	);

	const observations = toAIObservations(input.responses ?? [], {
		brand: input.brand,
		aliases: input.aliases,
	});
	bundle.observations = observations;

	const fromResponses = (input.responses ?? []).flatMap((response) =>
		response.citations.map((citation) =>
			evidenceFromCitationResult(citation, { provider: response.provider, timestamp: response.timestamp }),
		),
	);
	const fromStore = (input.citations ?? []).map((citation) => {
		if ('ownership' in citation) {
			return evidenceFromExplorerRow(citation as AsiEvidenceCitation);
		}
		if ('domain' in citation && 'sourceType' in citation) {
			return evidenceFromNormalized(citation as AsiNormalizedCitation);
		}
		return evidenceFromCitationResult(citation as CitationResult, {});
	});
	bundle.evidence = [...fromResponses, ...fromStore];

	bundle.competitors = [
		...observations.flatMap((row) => competitorsFromObservation(row)),
		...(input.sovRows ?? []).flatMap((row) => competitorsFromObservation(row)),
	];

	bundle.opportunities = input.warRoom ? opportunitiesFromWarRoom(input.warRoom) : [];
	bundle.actions = bundle.opportunities.map((item) => actionFromOpportunity(item));
	bundle.visibility =
		observations.length || input.monitor || input.sov
			? visibilityFromObservations(observations, {
					sov: input.sov,
					monitor: input.monitor,
					timestamp: input.warRoom?.analyzedAt,
				})
			: null;
	bundle.alerts = [];
	return bundle;
}

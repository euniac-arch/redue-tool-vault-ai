import type {
	AiCitationTopic,
	BlueprintDecisionMatrixRow,
	BlueprintInformationGainItem,
	StrategyLang,
} from '@/lib/strategy/types';

export type Localized<T> = { ko: T; en: T };

export interface CitationEntity {
	brand: string;
	person: string;
	personRole: string;
	location: string;
	focus: string;
	industry: string;
	url: string;
	telephone: string;
	address: string;
	schemaType: string;
	services: string[];
}

export interface BlueprintVariant {
	id: AiCitationTopic;
	/** First matching pattern against keyword + service + problem + specialties wins. */
	patterns: readonly RegExp[];
	matrixTitle: Localized<string>;
	matrixCaption: Localized<string>;
	columns: Localized<string[]>;
	rows: Localized<BlueprintDecisionMatrixRow[]>;
	gainTitle: Localized<string>;
	gainCaption: Localized<string>;
	gain: Localized<BlueprintInformationGainItem[]>;
	notRecommended: Localized<string[]>;
	sideEffects: Localized<string[]>;
	contraindications: Localized<string[]>;
	rag: (entity: CitationEntity, lang: StrategyLang) => Array<{ id: string; title: string; text: string }>;
}

export interface BlueprintProfile {
	id: string;
	variants: readonly BlueprintVariant[];
	fallback: BlueprintVariant;
}

export function pickLocale<T>(pair: Localized<T>, lang: StrategyLang): T {
	return lang === 'en' ? pair.en : pair.ko;
}

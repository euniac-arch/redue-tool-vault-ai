/**
 * Generic "Portfolio Case Study" data contract.
 *
 * Distinct from `PortfolioItem` (used by the compact portfolio grid card):
 * a case study captures the full before/after diagnostic story for a single
 * project — 4-axis breakdown, top critical deficits, and AI search engine
 * visibility — for the detailed report layout.
 */

export type StatusTone = 'critical' | 'warning' | 'good' | 'neutral';

export type Severity = 'critical' | 'high' | 'medium';

export interface CaseStudySiteInfo {
	/** Korean/local display name, e.g. "안성햇살의원". */
	name: string;
	/** Bare domain shown next to the name, e.g. "sunshineclinic.kr". */
	domain: string;
	/** Full URL used for outbound links. */
	domainUrl: string;
	/** Industry / vertical badge, e.g. "의료 / 성형외과". */
	category: string;
	/** Detected tech stack summary, e.g. "Custom HTML/PHP". */
	techStack: string;
	httpsEnabled: boolean;
	ttfbMs: number;
	ttfbTone: StatusTone;
}

export interface CaseStudyScoreBand {
	score: number;
	maxScore: number;
	tone: StatusTone;
	/** e.g. "노출 위험 · 상위 47%" */
	label: string;
}

export interface CaseStudyAlgorithmScore {
	before: number;
	after: number;
	maxScore: number;
}

export interface CaseStudyAxisBadge {
	label: string;
	tone: StatusTone;
}

export interface CaseStudyAxis {
	key: string;
	label: string;
	before: {
		score: number;
		/** Raw point fraction shown as helper text, e.g. "19.5/29". */
		raw: string;
		badge?: CaseStudyAxisBadge;
	};
	after: {
		score: number;
		raw?: string;
		badge?: CaseStudyAxisBadge;
	};
}

export interface CaseStudyDeficit {
	severity: Severity;
	title: string;
	impact: string;
}

export interface CaseStudyAiEngine {
	engine: string;
	/** 0-5 */
	stars: number;
	statusLabel: string;
	reason: string;
}

export interface CaseStudyData {
	id: string;
	siteInfo: CaseStudySiteInfo;
	normalizedScore: {
		before: CaseStudyScoreBand;
		after: CaseStudyScoreBand;
	};
	algorithmScore: CaseStudyAlgorithmScore;
	axes: CaseStudyAxis[];
	deficits: CaseStudyDeficit[];
	aiEngines: CaseStudyAiEngine[];
	verifiedAt?: string;
}

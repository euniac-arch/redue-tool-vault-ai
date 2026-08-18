export interface PortfolioSubScores {
	seo: number;
	performance: number;
	schema: number;
	accessibility: number;
	geo: number;
}

export interface PortfolioScorePair {
	before: number;
	after: number;
	maxScore: number;
}

export interface PortfolioItem {
	id: string;
	category: string;
	projectName: string;
	domainUrl: string;
	cmsType: string;
	/** Normalized 100-point after score. Kept for API compatibility with existing consumers. */
	overallScore: number;
	maxScore: number;
	statusLabel: string;
	/** Dual score systems: /100 (SEO·GEO 정규화) and dynamic raw max (알고리즘 배점). */
	scores: {
		normalized: PortfolioScorePair;
		algorithm: PortfolioScorePair;
	};
	subScores: PortfolioSubScores;
	injectionTags: string[];
	verifiedAt: string;
	/** Optional static card thumbnail. Falls back to a live screenshot when omitted. */
	thumbnailUrl?: string;
	/** When set, the left panel shows this brand mark centered instead of a screenshot. */
	logoMark?: string;
	logoCaption?: string;
	/** Example tool page used to sample the SoftwareApplication schema in the verification modal. */
	sampleToolSlug: string;
}

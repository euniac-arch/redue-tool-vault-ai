export interface PortfolioSubScores {
	seo: number;
	performance: number;
	schema: number;
	accessibility: number;
	geo: number;
}

export interface PortfolioItem {
	id: string;
	category: string;
	projectName: string;
	domainUrl: string;
	cmsType: string;
	overallScore: number;
	maxScore: number;
	statusLabel: string;
	subScores: PortfolioSubScores;
	injectionTags: string[];
	verifiedAt: string;
	/** Example tool page used to sample the SoftwareApplication schema in the verification modal. */
	sampleToolSlug: string;
}

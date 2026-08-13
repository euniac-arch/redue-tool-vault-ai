import type {
	CrawlCountryCode,
	CrawlIndustryCode,
	CrawlTargetTagCode,
} from '@/lib/crawling/taxonomy';

/**
 * 수집 사이트 가이드 스키마 (해외 확장 대비).
 * UI 리스트의 CrawlRecord는 이 필드를 포함해 확장합니다.
 */
export type CrawledSiteStatus = 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';

export interface CrawledSiteItem {
	id: string;
	url: string;
	siteName: string;
	/** 해외 확장 대비 국가 코드 */
	country: CrawlCountryCode;
	/** 예: "부산", "부산 해운대구" */
	region?: string;
	/** 업종 코드 또는 표시용 문자열 (예: 의료/클리닉) */
	category: CrawlIndustryCode | string;
	/** 수집 목적 태그 */
	targetTag?: CrawlTargetTagCode | string;
	status: CrawledSiteStatus;
	crawledAt: string;
}

/** 크롤 수집 품질 상태 (리스트 UI 배지용 — CrawledSiteStatus와 별개) */
export type CrawlCollectStatus = 'success' | 'warning' | 'failed';

/** POST /api/crawling/scan 하이브리드 수집 응답 data */
export type HybridCrawlScanData = {
	url: string;
	siteName: string;
	description: string;
	category: string;
	region: string;
	cms: string;
	ttfbMs: number;
	hasViewport: boolean;
	isIndexable: boolean;
	seoScore: number;
	psiUsed: boolean;
	apiKeyUsed: boolean;
	crawledAt: string;
};

export type HybridCrawlScanResponse =
	| { success: true; data: HybridCrawlScanData }
	| { success?: false; error: string; details?: string };

/** POST /api/crawling/target-finder 응답 data 항목 */
export type TargetFinderItem = {
	id: string;
	siteName: string;
	url: string;
	region: string;
	category: string;
	categoryCode?: CrawlIndustryCode | string;
	country?: CrawlCountryCode;
	crawledAt: string;
	source?: 'google' | 'naver' | 'seed' | 'places';
	/** True when company address could not be parsed during collection. */
	checkLocationNeeded?: boolean;
	parsedAddress?: string | null;
	phoneNumber?: string | null;
	googleRating?: number | null;
	googleReviewCount?: number | null;
};

export type TargetFinderResponse =
	| {
			success: true;
			data: TargetFinderItem[];
			/** True when Google/Naver keys missing / API failed / non-KR seed path. */
			isFallback?: boolean;
			message?: string;
			errorNotice?: string;
			/** Active search engine for this response */
			engine?: 'google' | 'naver' | 'seed' | 'places';
			meta?: {
				query?: string;
				source?: 'google' | 'naver' | 'seed' | 'places';
				country?: string;
				scanned?: number;
				requested?: number;
				returned?: number;
				note?: string;
				filteredNote?: string;
				queriesUsed?: string[];
				stopReason?: string;
				skipStats?: Record<string, number>;
				persistence?: {
					inserted: number;
					updated: number;
					skipped: number;
					skippedExcluded: number;
					skippedDiagnosed: number;
					skippedContacted: number;
					skippedBlacklist: number;
					skippedLocation: number;
					skippedPhone?: number;
				};
			};
	  }
	| { success?: false; error: string; details?: string; code?: string };

/** Shared contact + diagnosis fields for a `target_sites` row. */
export type TargetSiteListItem = {
	id: string;
	domain: string;
	original_url: string;
	status: 'PENDING' | 'DIAGNOSED' | 'CONTACTED' | 'EXCLUDED';
	email: string | null;
	contact_form_url: string | null;
	phone_number: string | null;
	address: string | null;
	kakao_channel_url: string | null;
	instagram_url: string | null;
	naver_talk_url: string | null;
	google_rating: number | null;
	google_review_count: number | null;
	last_scraped_at: string | null;
	diagnosed_at: string | null;
	audit_lead_id: string | null;
	has_report: boolean;
	check_location_needed: boolean;
	parsed_address: string | null;
};

/** POST /api/crawling/targets/[id]/refresh — persisted contact fields after a re-scrape. */
export type TargetRefreshData = {
	id: string;
	domain: string;
	email: string | null;
	contact_form_url: string | null;
	phone_number?: string | null;
	address?: string | null;
	kakao_channel_url?: string | null;
	instagram_url?: string | null;
	naver_talk_url?: string | null;
	google_rating?: number | null;
	google_review_count?: number | null;
	last_scraped_at: string | null;
	check_location_needed?: boolean;
	parsed_address?: string | null;
};

export type TargetRefreshResponse =
	| { success: true; data: TargetRefreshData }
	| { success?: false; error: string; details?: string; code?: string };

export type TargetSitesLookupResponse =
	| { success: true; data: TargetSiteListItem[] }
	| { success?: false; error: string; details?: string };

export type TargetDiagnoseData = TargetSiteListItem;

export type TargetDiagnoseResponse =
	| { success: true; data: TargetDiagnoseData }
	| { success?: false; error: string; details?: string; code?: string };

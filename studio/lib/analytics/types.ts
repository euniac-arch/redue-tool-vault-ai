/** Shared types for the self-hosted site analytics feature (client tracker + admin dashboard). */

export type DailyAnalyticsAggregate = {
	/** `YYYY-MM-DD`, Asia/Seoul calendar day. */
	date: string;
	totalViews: number;
	uniqueVisitors: number;
	/** Keyed by classified source label, e.g. `Google`, `Naver`, `Direct`, or a UTM source. */
	referrers: Record<string, number>;
	/** Keyed by `Mobile` | `Tablet` | `Desktop`. */
	devices: Record<string, number>;
	/** Keyed by browser label, e.g. `Chrome`, `Safari`. */
	browsers: Record<string, number>;
	/** Keyed by OS label, e.g. `Windows`, `iOS`. */
	os: Record<string, number>;
	updatedAt: string;
};

/** Raw payload sent from the client tracker via `sendBeacon`/`fetch(keepalive)`. */
export type AnalyticsCollectPayload = {
	path?: string;
	referrer?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	visitorId?: string;
	/** Fallback only — the server prefers the `User-Agent` request header. */
	userAgent?: string;
	screenWidth?: number;
};

/** Fully validated + classified event, ready to persist. */
export type NormalizedAnalyticsEvent = {
	date: string;
	visitorId: string;
	path: string;
	referrerLabel: string;
	device: string;
	browser: string;
	os: string;
};

export type AnalyticsRangeResponse = {
	start: string;
	end: string;
	days: DailyAnalyticsAggregate[];
};

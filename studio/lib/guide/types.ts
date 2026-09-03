export type {
	AiEngineDiagnosis,
	ChannelBadgeType,
	ChannelStatusBriefing,
	ChannelStatusItem,
	GuideAiEngineId,
	GuideAiEngineStatus,
	GuideData,
	GuideFaq,
	GuideSocialLinks,
	SubScores,
} from '@/types/guide';

export const GUIDE_STORAGE_KEY = 'redue_guide_pool_v1';
export const GUIDE_DRAFT_KEY = 'redue_guide_draft_v1';
export const GUIDE_AUDIT_SNAPSHOT_KEY = 'redue_guide_audit_snapshot_v1';
export const GUIDE_SEO_MAX_DEFAULT = 125;

/**
 * Presentable placeholder KPIs used only when a guide has no measured score yet
 * (no diagnosis loaded / field left blank by the admin). Any real measured value
 * — including a genuine 0 or invalid input — always takes precedence; see
 * `sanitizeGuideScores` in `lib/guide/scores.ts`.
 */
export const GUIDE_OBSERVED_SEO_DEFAULT = 125;
export const GUIDE_AI_TRUST_DEFAULT = 85;
export const GUIDE_AI_POTENTIAL_DEFAULT = 80;

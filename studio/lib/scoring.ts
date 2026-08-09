import { MARKER_END, MARKER_START } from './code-generator';
import type { CmsDetectionResult, DiagnosticCheck, DiagnosticReport, ScoreStatus, TargetSelectionResult } from './types';

const WP_HEAD_CALL_RE = /<\?php\s+wp_head\(\s*\);\s*\?>/i;

function statusFor(score: number): { status: ScoreStatus; label: string } {
	if (score >= 90) {
		return { status: 'PASS', label: 'Pass / 최적화 완료' };
	}
	if (score >= 60) {
		return { status: 'WARN', label: 'Warning / 개선 필요' };
	}
	return { status: 'FAIL', label: 'Fail / 조치 필요' };
}

/**
 * Run the 5-check REDUE AI Studio diagnostic rubric against a given file
 * content snapshot (either the pre-injection "before" content or the
 * post-injection "after" content — same rubric, different input).
 */
export function computeDiagnostics(
	cms: CmsDetectionResult,
	target: TargetSelectionResult,
	fileContent: string | null
): DiagnosticReport {
	const hasMasterBlock = !!fileContent && fileContent.includes(MARKER_START) && fileContent.includes(MARKER_END);

	const hasConditionalBranches =
		hasMasterBlock &&
		!!fileContent &&
		fileContent.includes("is_singular( 'ai_tool' )") &&
		fileContent.includes('is_front_page()');

	let hookRegisteredInTime = false;
	if (hasMasterBlock && fileContent) {
		if (target.anchor === 'functions-eof') {
			// functions.php is always loaded well before header.php is
			// rendered, so wherever add_action() sits inside functions.php,
			// it registers in time for wp_head() — position doesn't matter.
			hookRegisteredInTime = true;
		} else {
			const addActionIndex = fileContent.indexOf("add_action( 'wp_head', 'redue_ai_studio_master_schema' )");
			const wpHeadMatch = fileContent.match(WP_HEAD_CALL_RE);
			hookRegisteredInTime =
				addActionIndex !== -1 && !!wpHeadMatch && wpHeadMatch.index !== undefined && addActionIndex < wpHeadMatch.index;
		}
	}

	const checks: DiagnosticCheck[] = [
		{
			id: 'wp-core-detected',
			label: 'WordPress 코어 파일 감지 (wp-config.php / wp-load.php)',
			passed: cms.cmsType === 'WORDPRESS' && (cms.hasWpConfig || cms.hasWpLoad),
			weight: 20,
		},
		{
			id: 'active-theme-target',
			label: '활성 테마 + 타겟 파일(header.php) 확인',
			passed: cms.cmsType === 'WORDPRESS' && !!cms.activeTheme && target.found,
			weight: 20,
		},
		{
			id: 'master-block-present',
			label: 'REDUE AI Studio 마스터 스키마 블록 존재',
			passed: hasMasterBlock,
			weight: 20,
		},
		{
			id: 'conditional-schema-branches',
			label: "is_singular('ai_tool') / is_front_page() 조건부 분기 포함",
			passed: hasConditionalBranches,
			weight: 20,
		},
		{
			id: 'hook-timing-safe',
			label: 'wp_head() 호출 이전 add_action 등록 위치 검증',
			passed: hookRegisteredInTime,
			weight: 18,
		},
	];

	const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
	const score = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
	const { status, label } = statusFor(score);

	return { score, maxScore, status, statusLabel: label, checks };
}

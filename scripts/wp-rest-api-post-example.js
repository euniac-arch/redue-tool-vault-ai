#!/usr/bin/env node
/**
 * ============================================================================
 * REDUE AI Tool Vault — WP REST API 자동 포스팅 가이드 & 테스트 스크립트
 * ============================================================================
 *
 * 목적:
 *   외부 크롤러(또는 배치 잡)가 새로 발견한 AI 툴을 사람 개입 없이 자동으로
 *   `ai_tool` 커스텀 포스트 타입으로 등록할 수 있도록, 워드프레스 REST API
 *   (`POST /wp-json/wp/v2/ai_tool`) 호출 방법을 안내합니다.
 *
 *   `ai_tool` CPT는 `show_in_rest: true`로 등록되어 있고
 *   (wp-content/themes/redue-tool-vault/inc/custom-post-types.php),
 *   모든 메타 필드는 `register_post_meta(..., show_in_rest: true)`로
 *   노출되어 있으므로 (inc/meta-boxes.php) 별도 플러그인 없이 코어 REST API
 *   만으로 포스팅이 가능합니다.
 *
 * ----------------------------------------------------------------------------
 * 1단계. Application Password(애플리케이션 비밀번호) 생성 방법
 * ----------------------------------------------------------------------------
 *   워드프레스는 REST API 인증에 일반 로그인 비밀번호를 그대로 쓰는 것을
 *   권장하지 않습니다. 대신 계정별로 발급 가능한 "Application Passwords"
 *   기능을 사용합니다 (워드프레스 5.6+ 코어 내장 기능, 플러그인 불필요).
 *
 *   1) 관리자로 로그인 후 `내 계정 > 프로필 편집`
 *      (URL 예시: https://euniac.mycafe24.com/tool-vault/wp-admin/profile.php)
 *   2) 페이지 하단 "Application Passwords(애플리케이션 비밀번호)" 섹션으로 이동
 *   3) "새 애플리케이션 비밀번호 이름" 입력란에 식별용 이름 입력
 *      (예: "REDUE AI Studio Crawler")
 *   4) "새 애플리케이션 비밀번호 추가" 버튼 클릭
 *   5) 화면에 단 한 번 표시되는 비밀번호를 즉시 복사해 안전한 곳에 보관
 *      (예: xxxx xxxx xxxx xxxx xxxx xxxx — 공백 포함 그대로 사용 가능)
 *   6) 이 비밀번호 + 워드프레스 사용자명(로그인 ID)을 아래 스크립트의
 *      환경변수(WP_USERNAME / WP_APP_PASSWORD)로 사용합니다.
 *
 *   ⚠️ 주의: 사이트가 HTTPS가 아니면 Application Passwords 기능이
 *   기본적으로 비활성화됩니다 (Basic Auth 자격증명이 평문으로 전송되므로).
 *   Cafe24 등 실서버 배포 시 반드시 SSL 인증서를 적용하세요.
 *
 * ----------------------------------------------------------------------------
 * 2단계. cURL 테스트 예시
 * ----------------------------------------------------------------------------
 *   `사용자명:앱비밀번호`를 Base64로 인코딩해 Basic 인증 헤더로 전달합니다.
 *
 *   curl -X POST "https://euniac.mycafe24.com/tool-vault/wp-json/wp/v2/ai_tool" \
 *     -u "admin:xxxx xxxx xxxx xxxx xxxx xxxx" \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *           "title": "Perplexity Comet",
 *           "status": "publish",
 *           "content": "AI 브라우저 기반 리서치 툴입니다.",
 *           "meta": {
 *             "tool_tagline": "브라우저에 내장된 AI 리서치 에이전트",
 *             "tool_official_url": "https://perplexity.ai/comet",
 *             "tool_pricing_type": "Freemium",
 *             "tool_price_amount": "20",
 *             "tool_price_currency": "USD",
 *             "tool_operating_system": "macOS, Windows",
 *             "tool_rating_score": "4.7"
 *           }
 *         }'
 *
 *   `curl -u`는 내부적으로 `Authorization: Basic base64(user:pass)` 헤더로
 *   변환되므로, 어떤 언어/툴에서든 동일한 방식(Basic Auth)으로 호출하면
 *   됩니다.
 *
 * ----------------------------------------------------------------------------
 * 3단계. 이 Node.js 스크립트 실행 방법 (Node 18+, 내장 fetch 사용)
 * ----------------------------------------------------------------------------
 *   환경변수를 지정한 뒤 실행합니다:
 *
 *     # Windows PowerShell
 *     $env:WP_BASE_URL="https://euniac.mycafe24.com/tool-vault"
 *     $env:WP_USERNAME="admin"
 *     $env:WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"
 *     node scripts/wp-rest-api-post-example.js
 *
 *     # macOS / Linux
 *     WP_BASE_URL="https://euniac.mycafe24.com/tool-vault" \
 *     WP_USERNAME="admin" \
 *     WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx" \
 *     node scripts/wp-rest-api-post-example.js
 *
 *   기본값은 로컬 개발 환경(http://localhost)을 가리키도록 설정되어 있어,
 *   환경변수 없이 실행하면 로컬 워드프레스에 대해 동작을 시도합니다.
 * ============================================================================
 */

const WP_BASE_URL = process.env.WP_BASE_URL || 'http://localhost';
const WP_USERNAME = process.env.WP_USERNAME || 'admin';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || 'REPLACE_WITH_APPLICATION_PASSWORD';

/**
 * The new AI tool to register. In a real crawler, this object would be
 * populated dynamically from whatever source discovered the tool.
 */
const newTool = {
	title: 'Perplexity Comet',
	status: 'publish', // Use 'pending' to send it through editorial review instead.
	content: 'AI 브라우저 기반 리서치 툴입니다. 웹 탐색과 요약을 자동화합니다.',
	excerpt: '브라우저에 내장된 AI 리서치 에이전트',
	meta: {
		tool_tagline: '브라우저에 내장된 AI 리서치 에이전트',
		tool_official_url: 'https://perplexity.ai/comet',
		tool_pricing_type: 'Freemium',
		tool_price_amount: '20',
		tool_price_currency: 'USD',
		tool_operating_system: 'macOS, Windows',
		tool_rating_score: '4.7',
	},
};

async function postAiTool() {
	const endpoint = `${WP_BASE_URL.replace(/\/$/, '')}/wp-json/wp/v2/ai_tool`;
	const basicAuth = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString('base64');

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Basic ${basicAuth}`,
		},
		body: JSON.stringify(newTool),
	});

	const data = await response.json();

	if (!response.ok) {
		console.error(`❌ REST API 요청 실패 (HTTP ${response.status})`);
		console.error(data);
		process.exitCode = 1;
		return;
	}

	console.log(`✅ ai_tool 포스트 생성 완료: #${data.id} — ${data.title?.rendered ?? newTool.title}`);
	console.log(`   permalink: ${data.link}`);
}

postAiTool().catch((err) => {
	console.error('❌ 요청 중 예외가 발생했습니다:', err);
	process.exitCode = 1;
});

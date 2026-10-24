/**
 * Live-grounding citation-path analysis for the Why & Status engine cards.
 *
 * Copy is bound to the live `isCited` verdict plus crawled technical signals
 * (HTTPS, Bing Places, GBP, JSON-LD, /llms.txt). Citation URLs are classified
 * as official-domain vs third-party footprint (blog/portal).
 */

import { ENGINE_DISPLAY_NAME, type EngineAnalysisId } from '@/lib/audit/engine-analysis';
import type { AuditLang } from '@/lib/site-auditor';

export type EngineInsightName = (typeof ENGINE_DISPLAY_NAME)[EngineAnalysisId];

export type CitationPathKind = 'official' | 'external' | 'mixed' | 'unknown';

export interface EngineAnalysis {
	engineName: EngineInsightName;
	engine: EngineAnalysisId;
	isCited: boolean;
	score: number;
	citedSources?: string[];
	citationPath: CitationPathKind;
	reasonTitle: string;
	reasonDetails: string[];
	actionRequired: string;
}

export interface EngineInsightSignals {
	isHttps: boolean;
	bingPlacesRegistered: boolean;
	googleMapsLinked: boolean;
	hasLlmsTxt: boolean;
	hasJsonLd: boolean;
	hasFaq: boolean;
	hasLocalBusiness: boolean;
	siteUrl: string;
	recommendedSchemaType?: string;
}

const ENGINE_ID_BY_NAME: Record<string, EngineAnalysisId> = {
	chatgpt: 'chatgpt',
	perplexity: 'perplexity',
	gemini: 'gemini',
	claude: 'claude',
	copilot: 'copilot',
	clova: 'clova',
};

const EXTERNAL_HOST_HINTS = [
	'blog.naver.com',
	'cafe.naver.com',
	'post.naver.com',
	'in.naver.com',
	'm.blog.naver.com',
	'place.naver.com',
	'map.naver.com',
	'tistory.com',
	'daum.net',
	'kakao.com',
	'instagram.com',
	'facebook.com',
	'youtube.com',
	'youtu.be',
	'threads.net',
	'x.com',
	'twitter.com',
	'linkedin.com',
	'medium.com',
	'brunch.co.kr',
];

export function normalizeEngineId(engine: string): EngineAnalysisId {
	const key = engine.trim().toLowerCase();
	return ENGINE_ID_BY_NAME[key] ?? 'chatgpt';
}

export function hostnameFromUrl(url: string): string {
	try {
		return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./i, '').toLowerCase();
	} catch {
		return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.toLowerCase() || url;
	}
}

export function uniqueHttpUrls(urls: Array<string | undefined | null>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of urls) {
		const value = (raw || '').trim().replace(/[.,);]+$/g, '');
		if (!/^https?:\/\//i.test(value)) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

export function isExternalCitationHost(host: string): boolean {
	const h = host.replace(/^www\./i, '').toLowerCase();
	return EXTERNAL_HOST_HINTS.some((hint) => h === hint || h.endsWith(`.${hint}`));
}

export function isOfficialCitationHost(host: string, siteUrl: string): boolean {
	const siteHost = hostnameFromUrl(siteUrl);
	if (!siteHost || !host) return false;
	return host === siteHost || host.endsWith(`.${siteHost}`);
}

export function classifyCitationPath(sources: readonly string[], siteUrl: string): CitationPathKind {
	if (sources.length === 0) return 'unknown';
	let official = 0;
	let external = 0;
	for (const src of sources) {
		const host = hostnameFromUrl(src);
		if (isOfficialCitationHost(host, siteUrl)) official += 1;
		else if (isExternalCitationHost(host)) external += 1;
		else if (siteUrl && !isOfficialCitationHost(host, siteUrl)) external += 1;
	}
	if (official > 0 && external > 0) return 'mixed';
	if (official > 0) return 'official';
	if (external > 0) return 'external';
	return 'unknown';
}

function schemaLabel(signals: EngineInsightSignals): string {
	return signals.recommendedSchemaType || (signals.hasLocalBusiness ? 'LocalBusiness' : 'MedicalClinic/LocalBusiness');
}

function joinActions(parts: string[]): string {
	return parts.filter(Boolean).join(' + ');
}

function citedPerplexity(
	path: CitationPathKind,
	sources: string[],
	en: boolean,
): Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'> {
	const hosts = sources.map(hostnameFromUrl).filter(Boolean);
	const hostLabel = hosts.slice(0, 3).join(', ');
	if (path === 'official') {
		return {
			reasonTitle: en
				? 'Official-site document cited directly'
				: '공식 웹사이트 직접 인용 성공',
			reasonDetails: [
				en
					? 'Perplexity’s live crawler parsed the official domain and adopted it as an answer source.'
					: 'Perplexity 실시간 크롤러가 공식 도메인 문서를 직접 파싱하여 답변 출처로 채택했습니다.',
				en
					? 'On-page metadata and domain–entity match were strong enough to skip a third-party hop.'
					: '온페이지 메타데이터와 도메인 엔티티 정합도가 높아 외부 채널을 거치지 않고 1차 출처로 인용되었습니다.',
			],
			actionRequired: en
				? 'Keep JSON-LD (FAQPage / service schema) current so the official URL stays the primary citation.'
				: 'FAQPage·서비스 JSON-LD를 유지해 공식 URL 직답 인용 비중을 계속 높이세요.',
		};
	}
	if (path === 'mixed') {
		return {
			reasonTitle: en
				? 'Official domain plus third-party footprint cited together'
				: '공식 도메인 + 외부 풋프린트 결합 인용',
			reasonDetails: [
				en
					? `Perplexity combined the official site with third-party mentions (${hostLabel || 'external pages'}).`
					: `공식 사이트와 제3자 웹 문서(${hostLabel || '외부 페이지'})의 브랜드 언급을 결합해 인용했습니다.`,
				en
					? 'External channel text plus the official URL were fused into a single answer source.'
					: '외부 채널의 상호·도메인 텍스트 신호와 공식 URL을 결합하여 답변 출처로 채택했습니다.',
			],
			actionRequired: en
				? 'Strengthen on-page JSON-LD so official-site citations outpace blog/portal reverse lookups.'
				: '자사 온페이지 스키마(JSON-LD)를 보강해 외부 블로그 의존도를 낮추고 공식 사이트 직답 인용 비중을 높이세요.',
		};
	}
	return {
		reasonTitle: en
			? 'Third-party digital footprint reverse-traced into a citation'
			: '외부 디지털 풋프린트(블로그/포털) 역추적 인용 성공',
		reasonDetails: [
			en
				? 'Perplexity’s live crawler parsed brand mentions on third-party pages (blogs, communities, reviews).'
				: '네이버 블로그, 커뮤니티, 외부 리뷰 등 제3자 웹 문서에 남겨진 브랜드 언급(Citation)을 Perplexity 실시간 크롤러가 성공적으로 파싱했습니다.',
			hostLabel
				? en
					? `Detected external hosts: ${hostLabel}.`
					: `감지된 외부 출처: ${hostLabel}.`
				: en
					? 'Accumulated name/domain text on external channels was used to adopt the official site as a source.'
					: '외부 채널에 누적된 상호·도메인 텍스트 신호를 결합하여 공식 웹사이트 URL을 답변 출처로 채택했습니다.',
			!hostLabel
				? ''
				: en
					? 'Those signals were joined to adopt the official website URL as an answer source.'
					: '외부 채널에 누적된 상호·도메인 텍스트 신호를 결합하여 공식 웹사이트 URL을 답변 출처로 채택했습니다.',
		].filter(Boolean),
		actionRequired: en
			? 'Add on-page JSON-LD so official-site direct citations can rise above 95% and reduce blog dependence.'
			: '자사 온페이지 스키마(JSON-LD)를 보강하면 외부 블로그 의존도를 낮추고 공식 사이트 직답 인용 비중을 95% 이상으로 높일 수 있습니다.',
	};
}

function citedClaude(
	path: CitationPathKind,
	en: boolean,
): Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'> {
	if (path === 'external' || path === 'mixed') {
		return {
			reasonTitle: en
				? 'Entity match via official domain and supporting web mentions'
				: '도메인-엔티티 매칭 + 외부 언급 인용 성공',
			reasonDetails: [
				en
					? 'Query–domain name alignment was high enough for Claude to adopt a live link in the answer.'
					: '검색 쿼리와 도메인 명칭(URL) 간의 상호 정합도가 높아 답변 내 링크로 직접 채택되었습니다.',
				en
					? 'Supporting third-party pages supplied extra entity evidence around the official site.'
					: '제3자 웹 문서의 브랜드 언급이 공식 사이트 엔티티를 뒷받침하는 보조 근거로 활용되었습니다.',
			],
			actionRequired: en
				? 'Inject FAQPage and service schema so citations expand from the URL into on-page facts.'
				: 'FAQPage 및 서비스 스키마를 주입하여 단순 URL 링크를 넘어 본문 팩트(FAQ/안내) 직접 인용으로 확장하세요.',
		};
	}
	return {
		reasonTitle: en
			? 'Domain–entity text match cited successfully'
			: '도메인-엔티티 텍스트 매칭 인용 성공',
		reasonDetails: [
			en
				? 'Query-to-domain (URL) alignment was high, so Claude adopted a direct answer link.'
				: '검색 쿼리와 도메인 명칭(URL) 간의 상호 정합도가 높아 답변 내 링크로 직접 채택되었습니다.',
			en
				? 'Core-keyword search used the site title/description metadata as the citation snippet.'
				: '핵심 키워드 검색 시 사이트의 기본 메타데이터(Title/Description)가 인용 스니펫으로 활용되었습니다.',
		],
		actionRequired: en
			? 'Inject FAQPage and service schema so citations expand from a URL link into on-page facts.'
			: 'FAQPage 및 서비스 스키마를 주입하여 단순 URL 링크를 넘어 본문 팩트(FAQ/진료안내) 직접 인용으로 확장하세요.',
	};
}

function citedDefault(en: boolean): Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'> {
	return {
		reasonTitle: en
			? 'Official entity identified and cited from live web search'
			: '공식 엔티티 식별 및 웹 검색 출처 인용 완료',
		reasonDetails: [
			en
				? 'Live search browsing adopted the official source in the answer.'
				: '실시간 검색 브라우징을 통해 공식 출처로 정상 인용되었습니다.',
		],
		actionRequired: en
			? 'Keep structured data current to hold the top citation card.'
			: '구조화 데이터 최적화로 상단 카드 노출 유지',
	};
}

function uncitedChatGpt(
	signals: EngineInsightSignals,
	en: boolean,
): Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'> {
	const details: string[] = [];
	const actions: string[] = [];
	// These are technical-readiness observations from the crawl, not findings from the AI answer.
	if (!signals.isHttps) {
		details.push(
			en
				? 'Non-secure protocol (HTTP) signal: the site was not confirmed as HTTPS. A missing secure connection can weigh against link citations in AI search.'
				: '비보안 프로토콜(HTTP) 신호: 사이트가 HTTPS로 확인되지 않았습니다. 보안 연결이 없으면 AI 검색의 링크 인용에 불리할 수 있습니다.',
		);
		actions.push(en ? 'Confirm HTTPS is applied site-wide' : 'HTTPS 전면 적용 확인');
	}
	if (!signals.bingPlacesRegistered) {
		details.push(
			en
				? 'Bing Places link not confirmed: no Bing Places signal was found on the public pages. This is not a lookup of the Bing index itself.'
				: 'Bing Places 연동 신호 미확인: 공개 페이지에서 Bing Places 연동 신호를 찾지 못했습니다. Bing 색인 상태를 직접 조회한 결과는 아닙니다.',
		);
		actions.push(en ? 'Check and, if missing, register Bing Places' : 'Bing Places 등록 여부 확인 후 필요 시 등록');
	}
	if (!signals.hasLlmsTxt || !signals.hasJsonLd) {
		const missing = [
			!signals.hasLlmsTxt ? '/llms.txt' : '',
			!signals.hasJsonLd ? 'JSON-LD' : '',
		].filter(Boolean);
		details.push(
			en
				? `${missing.join(' and ')} not found: no official summary an AI crawler can read directly was detected.`
				: `${missing.join(' 및 ')} 미확인: AI 크롤러가 바로 읽을 수 있는 공식 요약 문서를 확인하지 못했습니다.`,
		);
		actions.push(en ? 'Ship JSON-LD schema (and /llms.txt)' : 'JSON-LD 스키마 배포');
	}
	if (details.length === 0) {
		details.push(
			en
				? 'The basic signals are present. There is still room to strengthen the trust signals AI search can use as an official source.'
				: '기본 신호는 확인되었습니다. AI 검색이 공식 출처로 활용할 신뢰 신호를 더 보강할 여지가 있습니다.',
		);
		actions.push(en ? 'Sync on-page schema and Bing local signals' : '온페이지 스키마 및 Bing 로컬 동기화 점검');
	}
	const httpsInTitle = !signals.isHttps;
	const bingInTitle = !signals.bingPlacesRegistered;
	return {
		reasonTitle:
			httpsInTitle && bingInTitle
				? en
					? 'HTTPS and Bing local signals to check'
					: 'HTTPS·Bing 로컬 신호 점검 필요'
				: httpsInTitle
					? en
						? 'HTTPS signal to check'
						: 'HTTPS 적용 점검 필요'
					: bingInTitle
						? en
							? 'Bing local signal to check'
							: 'Bing 로컬 신호 점검 필요'
						: en
							? 'Room to strengthen structured signals'
							: '구조화 신호 보강 여지',
		reasonDetails: details,
		actionRequired: joinActions(actions),
	};
}

function uncitedGemini(
	signals: EngineInsightSignals,
	en: boolean,
): Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'> {
	const details: string[] = [];
	const actions: string[] = [];
	const schema = schemaLabel(signals);
	// These are technical-readiness observations from the crawl, not findings from the AI answer.
	if (!signals.googleMapsLinked) {
		details.push(
			en
				? 'Google Business Profile (GBP) link not confirmed: the match between the website NAP and a GBP listing could not be verified from the public pages.'
				: 'Google 비즈니스 프로필(GBP) 연동 신호 미확인: 공개 페이지에서 웹사이트 NAP와 GBP의 일치 여부를 확인하지 못했습니다. (Knowledge Graph 등록 상태를 직접 조회한 결과는 아닙니다.)',
		);
		actions.push(en ? 'Check and sync Google Business Profile (Maps)' : '구글 지도(GBP) 연동 상태 확인 및 동기화');
	}
	if (!signals.isHttps) {
		details.push(
			en
				? 'HTTPS not confirmed: a missing secure connection can weigh against being used as a Google-based answer source.'
				: 'HTTPS 미확인: 보안 연결이 없으면 Google 기반 답변의 출처로 활용되는 데 불리할 수 있습니다.',
		);
		actions.unshift(en ? 'Confirm HTTPS is applied' : 'HTTPS 적용 확인');
	}
	if (!signals.hasLocalBusiness || !signals.hasJsonLd) {
		details.push(
			en
				? `${schema} structured schema not found — a stronger expertise (E-E-A-T) signal is possible.`
				: `구조화 스키마(${schema}) 미확인 — 전문성(E-E-A-T) 신호를 더 보강할 수 있습니다.`,
		);
		actions.push(en ? `Add ${schema} schema` : `${schema} 스키마 추가`);
	}
	if (details.length === 0) {
		details.push(
			en
				? 'The basic signals are present. There is still room to strengthen the trust signals Gemini can use as an official source.'
				: '기본 신호는 확인되었습니다. Gemini가 공식 출처로 활용할 신뢰 신호를 더 보강할 여지가 있습니다.',
		);
		actions.push(en ? 'Sync GBP and on-page schema' : 'GBP 및 온페이지 스키마 동기화 점검');
	}
	const gbpInTitle = !signals.googleMapsLinked;
	const httpsInTitle = !signals.isHttps;
	return {
		reasonTitle:
			gbpInTitle && httpsInTitle
				? en
					? 'GBP link and HTTPS signals to check'
					: 'Google 비즈니스(GBP) 연동·HTTPS 신호 점검 필요'
				: gbpInTitle
					? en
						? 'Google Business Profile link to check'
						: 'Google 비즈니스(GBP) 연동 점검 필요'
					: httpsInTitle
						? en
							? 'HTTPS signal to check'
							: 'HTTPS 적용 점검 필요'
						: en
							? 'Room to strengthen E-E-A-T / schema signals'
							: 'E-E-A-T·스키마 신호 보강 여지',
		reasonDetails: details,
		actionRequired: joinActions(actions),
	};
}

function uncitedDefault(en: boolean): Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'> {
	return {
		reasonTitle: en
			? 'Room to strengthen structured signals and local-platform links'
			: '구조화 신호 및 로컬 플랫폼 연동 보강 여지',
		reasonDetails: [
			en
				? 'There is room to strengthen the trust signals an AI engine can use as an official source. This is a readiness check, not a finding from the AI answer.'
				: 'AI 엔진이 공식 출처로 활용할 신뢰 신호를 더 보강할 여지가 있습니다. 기술 준비도 점검이며, AI 응답에서 관찰한 결과는 아닙니다.',
		],
		actionRequired: en
			? 'Check on-page schema and local platform profiles'
			: '온페이지 스키마 및 로컬 플랫폼 점검',
	};
}

function uncitedPerplexity(signals: EngineInsightSignals, en: boolean) {
	const details: string[] = [];
	if (!signals.hasFaq && !signals.hasJsonLd) {
		details.push(
			en
				? 'No FAQPage / official summary document was found for Perplexity to quote as a first-party source.'
				: 'Perplexity가 1차 출처로 인용할 FAQPage·공식 요약 문서를 확인하지 못했습니다.',
		);
	}
	details.push(
		en
			? 'There is room to strengthen the third-party footprint and on-page entity text. This is a readiness check, not a finding from the AI answer.'
			: '외부 디지털 풋프린트와 온페이지 엔티티 텍스트를 더 보강할 여지가 있습니다. 기술 준비도 점검이며, AI 응답에서 관찰한 결과는 아닙니다.',
	);
	return {
		reasonTitle: en
			? 'Citable first-party document to check'
			: '인용 가능한 1차 문서 확인 필요',
		reasonDetails: details,
		actionRequired: en
			? 'Publish FAQ/HowTo JSON-LD and keep official pages crawlable'
			: 'FAQ/HowTo JSON-LD 배포 및 공식 페이지 크롤 가능 상태 유지',
	};
}

function uncitedClaude(signals: EngineInsightSignals, en: boolean) {
	const details: string[] = [];
	if (!signals.hasFaq) {
		details.push(
			en
				? 'FAQPage schema was not found, which gives a model less on-page fact material to quote.'
				: 'FAQPage 스키마를 확인하지 못했습니다. 모델이 본문 팩트를 인용할 재료가 적을 수 있습니다.',
		);
	}
	details.push(
		en
			? 'There is room to strengthen query–domain entity matching. This is a readiness check, not a finding from the AI answer.'
			: '검색 쿼리와 도메인 엔티티 매칭 신호를 더 보강할 여지가 있습니다. 기술 준비도 점검이며, AI 응답에서 관찰한 결과는 아닙니다.',
	);
	return {
		reasonTitle: en
			? 'Domain–entity match signal to strengthen'
			: '도메인-엔티티 매칭 신호 보강 여지',
		reasonDetails: details,
		actionRequired: en
			? 'Align Title/Description with the query entity and add FAQPage schema'
			: '쿼리 엔티티에 맞춘 Title/Description 정합 + FAQPage 스키마 주입',
	};
}

export function getEngineInsight(
	engine: string,
	isCited: boolean,
	sources: readonly (string | undefined | null)[] | undefined,
	signals: EngineInsightSignals,
	opts?: { liveScore?: number; lang?: AuditLang },
): EngineAnalysis {
	const engineId = normalizeEngineId(engine);
	const engineName = ENGINE_DISPLAY_NAME[engineId];
	const en = opts?.lang === 'en';
	const citedSources = uniqueHttpUrls([...(sources ?? [])]);
	const citationPath = classifyCitationPath(citedSources, signals.siteUrl);
	const score =
		typeof opts?.liveScore === 'number' && Number.isFinite(opts.liveScore)
			? Math.max(0, Math.min(100, Math.round(opts.liveScore)))
			: isCited
				? 80
				: 30;

	let copy: Pick<EngineAnalysis, 'reasonTitle' | 'reasonDetails' | 'actionRequired'>;
	if (isCited) {
		switch (engineId) {
			case 'perplexity':
				copy = citedPerplexity(citationPath, citedSources, en);
				break;
			case 'claude':
				copy = citedClaude(citationPath, en);
				break;
			default:
				copy = citedDefault(en);
				break;
		}
	} else {
		switch (engineId) {
			case 'chatgpt':
				copy = uncitedChatGpt(signals, en);
				break;
			case 'gemini':
				copy = uncitedGemini(signals, en);
				break;
			case 'perplexity':
				copy = uncitedPerplexity(signals, en);
				break;
			case 'claude':
				copy = uncitedClaude(signals, en);
				break;
			default:
				copy = uncitedDefault(en);
				break;
		}
	}

	return {
		engine: engineId,
		engineName,
		isCited,
		score,
		citedSources: citedSources.length > 0 ? citedSources : undefined,
		citationPath,
		reasonTitle: copy.reasonTitle,
		reasonDetails: copy.reasonDetails,
		actionRequired: copy.actionRequired,
	};
}

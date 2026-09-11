/**
 * Dynamic "how do I actually fix this" guide for each AI-engine cause factor.
 *
 * `engine-readiness.ts` emits short cause badges ("Structured Data 부족",
 * "On-page 개선 2건", "Citation Signal 부족", …). Those badges tell the user
 * *what* is wrong but not *how* to fix it. This module is the common,
 * site-agnostic dictionary/generator that expands each cause into:
 *   - a concrete action summary bound to the diagnosed site's own brand /
 *     domain / URL / industry (never a hardcoded business name),
 *   - an optional short checklist,
 *   - an optional copy-ready code snippet (JSON-LD, robots.txt, …).
 *
 * `getAiFixGuide(factor, auditData, lang)` is keyed first by the specific
 * `EngineCauseFactor.id` emitted by each per-engine analyzer (Gemini /
 * ChatGPT / Perplexity / Claude / Copilot / Clova), then falls back to the
 * broader `EngineCauseCategory` for any id this module does not special-case
 * yet — so newly introduced cause ids always render *something* useful
 * instead of nothing.
 *
 * `auditData` is a `GeoWorkGuideModel` (see `geo-work-guide.ts`) — the same
 * dynamic, industry-aware model already resolved once per audit report for
 * the GEO/AEO work guide modal. Reusing it means every brand / domain /
 * schema-type / NAP field here is bound to the *currently diagnosed* site,
 * with safe Korean/English fallbacks when a field was never collected.
 */
import type { EngineCauseCategory, EngineCauseFactor } from '@/lib/audit/engine-readiness';
import type { GeoWorkGuideModel } from '@/lib/audit/geo-work-guide';
import type { AuditLang } from '@/lib/site-auditor';

export interface AiFixGuide {
	/** One-sentence "what to do" — always bound to the diagnosed site's brand/domain/industry. */
	actionSummary: string;
	/** Optional second sentence — extra context (NAP rule, recommended schema types, …). */
	detail?: string;
	/** Optional short list of concrete action items / recommended question templates. */
	checklist?: string[];
	/** Label shown above the code snippet (e.g. "Copy-ready JSON-LD"). */
	codeLabel?: string;
	/** Optional copy-ready code (JSON-LD, robots.txt rule, Title/Meta example, …). */
	codeSnippet?: string;
}

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function brandLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	const raw = compact(model.brandName);
	if (!raw || raw === '해당 웹사이트') return lang === 'en' ? 'the official site' : '해당 비즈니스';
	return raw;
}

function domainLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.domain) || compact(model.url) || (lang === 'en' ? 'the official domain' : '공식 도메인');
}

function urlLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.url) || domainLabel(model, lang);
}

function serviceLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.mainService) || (lang === 'en' ? 'core service' : '핵심 서비스');
}

function servicesListLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.servicesLabel) || serviceLabel(model, lang);
}

function locationLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.location) || (lang === 'en' ? 'its service area' : '해당 지역');
}

function categoryLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.defaultCategory) || (lang === 'en' ? 'business' : '업체');
}

function repTitleLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.representativeTitle) || (lang === 'en' ? 'the representative' : '대표자');
}

function platformsLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return (
		compact(model.platformsLabel) ||
		(lang === 'en' ? 'industry review / directory platforms' : '업종별 리뷰·디렉터리 플랫폼')
	);
}

function napAddressLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.address) || (lang === 'en' ? 'the registered street address' : '등록된 도로명주소');
}

function napPhoneLabel(model: GeoWorkGuideModel, lang: AuditLang): string {
	return compact(model.phone) || (lang === 'en' ? 'the main phone number' : '대표 전화번호');
}

function sameAsSnippet(model: GeoWorkGuideModel): string {
	const domain = compact(model.domain) || 'example.com';
	return [
		'"sameAs": [',
		'  "https://map.naver.com/p/entry/place/XXXXXXXX",',
		'  "https://www.google.com/maps/place/?q=place_id:XXXXXXXX",',
		`  "https://www.bing.com/maps?q=${domain}",`,
		'  "https://www.instagram.com/your_official_handle"',
		']',
	].join('\n');
}

function organizationJsonLd(model: GeoWorkGuideModel, lang: AuditLang): string {
	const brand = brandLabel(model, lang);
	const url = compact(model.url);
	const obj: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: brand,
		...(url ? { url } : {}),
		logo: 'https://YOUR-DOMAIN/logo.png',
		sameAs: [
			'https://map.naver.com/p/entry/place/XXXXXXXX',
			'https://www.google.com/maps/place/?q=place_id:XXXXXXXX',
			'https://www.instagram.com/your_official_handle',
		],
	};
	return JSON.stringify(obj, null, 2);
}

function faqPageJsonLd(model: GeoWorkGuideModel): string {
	const obj = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: [
			{
				'@type': 'Question',
				name: model.faq.question,
				acceptedAnswer: { '@type': 'Answer', text: model.faq.answer },
			},
		],
	};
	return JSON.stringify(obj, null, 2);
}

function personJsonLd(model: GeoWorkGuideModel, lang: AuditLang): string {
	const obj: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': model.personSchemaType || 'Person',
		name: lang === 'en' ? 'Representative full name' : '대표자 실명',
		jobTitle: repTitleLabel(model, lang),
		worksFor: { '@type': 'Organization', name: brandLabel(model, lang) },
	};
	return JSON.stringify(obj, null, 2);
}

function faqQuestionTemplates(model: GeoWorkGuideModel, lang: AuditLang): string[] {
	const brand = brandLabel(model, lang);
	const service = serviceLabel(model, lang);
	const location = locationLabel(model, lang);
	if (lang === 'en') {
		return [
			`"What ${service} does ${brand} offer?" — service scope`,
			`"Where is ${brand} located and what does ${service} cost?" — location / pricing`,
			`"How do I book or use ${brand}'s ${service}?" — how to use`,
		];
	}
	return [
		`"${location} ${service} 잘하는 곳 추천해줘" — 서비스 범위`,
		`"${brand} 위치랑 ${service} 비용이 어떻게 되나요?" — 위치/비용`,
		`"${brand} ${service} 이용 방법이 어떻게 되나요?" — 이용 방법`,
	];
}

function robotsTxtSnippet(bot: 'GPTBot' | 'ClaudeBot', alias: string): string {
	return [`User-agent: ${bot}`, 'Allow: /', '', `User-agent: ${alias}`, 'Allow: /'].join('\n');
}

// ---------------------------------------------------------------------------
// Guide builders — one per broad remediation theme. Every builder is a pure
// function of (model, lang); nothing here is hardcoded to a specific brand.
// ---------------------------------------------------------------------------

function structuredDataGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	const schemaType = model.schemaType || 'Organization';
	const detailType = model.detailSchemaType || 'WebPage';
	if (lang === 'en') {
		return {
			actionSummary: `${brand}'s site is missing the core structured data for its industry. Insert JSON-LD for the ${schemaType} and ${detailType} schema types inside the page <head>.`,
			detail: `Recommended types: ${schemaType}, ${detailType}, FAQPage — apply the type that matches this industry first, then fill every required property.`,
			checklist: [
				`Place ${schemaType} as the top-level entity and ${detailType} on the service-detail page.`,
				'Fill name / url / logo / sameAs and other required fields completely.',
				'Validate with Google Rich Results Test until 0 errors remain.',
			],
			codeLabel: 'Copy-ready minimal JSON-LD',
			codeSnippet: model.jsonLdSample,
		};
	}
	return {
		actionSummary: `${brand} 웹사이트의 업종에 맞춘 핵심 구조화 데이터가 누락되었습니다. JSON-LD 포맷의 ${schemaType} 및 ${detailType} 스키마를 <head> 태그 내부에 삽입해야 합니다.`,
		detail: `추천 스키마 타입: ${schemaType} · ${detailType} · FAQPage — 업종 특성에 맞는 타입을 최우선으로 적용한 뒤 필수 속성을 모두 채우세요.`,
		checklist: [
			`${schemaType}를 최상위 엔티티로, ${detailType}를 서비스 상세 페이지에 배치하세요.`,
			'name / url / logo / sameAs 등 필수 속성을 100% 채우세요.',
			'Google 리치 결과 테스트로 오류 0건을 확인하세요.',
		],
		codeLabel: '복사 가능한 최소 JSON-LD 스니펫',
		codeSnippet: model.jsonLdSample,
	};
}

function organizationEntityGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `${brand}'s Organization structured data is missing core attributes such as name, url, logo, and sameAs. Gemini's knowledge-graph matching needs every one of these fields filled in.`,
			checklist: [
				'Fill name / url / logo / sameAs completely.',
				'Use a high-resolution logo image URL (not a favicon).',
				'Add every map and social-profile URL to sameAs.',
			],
			codeLabel: 'Copy-ready minimal Organization JSON-LD',
			codeSnippet: organizationJsonLd(model, lang),
		};
	}
	return {
		actionSummary: `${brand}의 Organization 구조화 데이터에 name·url·logo·sameAs 같은 핵심 속성이 비어 있습니다. Gemini의 지식 그래프 매칭을 위해 아래 필드를 100% 채운 Organization JSON-LD를 삽입하세요.`,
		checklist: [
			'name / url / logo / sameAs 필드를 모두 채우세요.',
			'로고는 파비콘이 아닌 고해상도 이미지 URL로 연결하세요.',
			'sameAs에 지도·SNS 프로필 URL을 모두 추가하세요.',
		],
		codeLabel: '복사 가능한 최소 Organization JSON-LD',
		codeSnippet: organizationJsonLd(model, lang),
	};
}

function businessProfileGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	const url = urlLabel(model, lang);
	const category = categoryLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `OpenAI(Bing) and Google Grounding verify local-business indexing first. Register [${brand}] on Bing Places and Google Business Profile, then map the map URL directly into the site schema's sameAs array.`,
			detail: `NAP consistency rule — keep the business name "${brand}", address "${napAddressLabel(model, lang)}", and phone "${napPhoneLabel(model, lang)}" 100% identical across every channel.`,
			checklist: [
				`Set the Google Business Profile category to "${category}" and register each service under ${servicesListLabel(model, lang)} individually.`,
				`Register on Bing Places using the business registration name, then fill in ${url}, hours, and services.`,
				'Add geo coordinates to the LocalBusiness schema and link the sameAs map URLs.',
			],
			codeLabel: 'sameAs link example',
			codeSnippet: sameAsSnippet(model),
		};
	}
	return {
		actionSummary: `OpenAI(Bing) 및 Google Grounding은 로컬 비즈니스 색인을 최우선으로 검증합니다. Bing Places 및 Google 비즈니스 프로필에 [${brand}]을 등록하고, 웹사이트 schema의 sameAs 배열에 해당 지도 URL을 직접 매핑하세요.`,
		detail: `NAP(상호·주소·전화) 100% 일치 원칙 — 상호 "${brand}", 주소 "${napAddressLabel(model, lang)}", 전화 "${napPhoneLabel(model, lang)}"를 모든 채널(웹사이트·지도·SNS)에서 완전히 동일하게 유지하세요.`,
		checklist: [
			`Google 비즈니스 프로필 카테고리를 '${category}'로 설정하고, ${servicesListLabel(model, lang)} 등 세부 서비스 항목을 개별 등록하세요.`,
			`Bing Places에 사업자등록증 기준 상호로 등록하고 ${url}, 운영시간, 서비스 항목을 입력하세요.`,
			'LocalBusiness schema에 geo 좌표를 포함하고 sameAs에 지도 URL을 연결하세요.',
		],
		codeLabel: 'sameAs 링크 예시',
		codeSnippet: sameAsSnippet(model),
	};
}

function napEntityGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `${brand}'s name / address / phone (NAP) signals are inconsistent or incomplete across channels. Make the business name and address notation exactly identical everywhere (website, maps, social).`,
			detail: `Reference NAP — name: ${brand} · address: ${napAddressLabel(model, lang)} · phone: ${napPhoneLabel(model, lang)}.`,
			checklist: [
				'Use the exact same business-registration name string everywhere — no abbreviations on some channels.',
				'Format the address identically (unit/suite, dong/ho notation) across the site, maps, and directories.',
				'Keep one canonical phone number and remove any outdated numbers from old listings.',
			],
			codeLabel: 'sameAs link example',
			codeSnippet: sameAsSnippet(model),
		};
	}
	return {
		actionSummary: `${brand}의 상호·주소·전화(NAP) 정보가 채널 간 불일치하거나 불완전합니다. 웹사이트·지도·SNS 등 모든 채널에서 상호명과 주소 표기를 완전히 동일하게 맞추세요.`,
		detail: `기준 NAP — 상호: ${brand} · 주소: ${napAddressLabel(model, lang)} · 전화: ${napPhoneLabel(model, lang)}.`,
		checklist: [
			'사업자등록증 기준 상호명 문자열을 모든 채널에서 동일하게 사용하세요(일부만 줄임말 사용 금지).',
			'동/호수 표기 등 주소 형식을 웹사이트·지도·디렉터리에서 동일하게 맞추세요.',
			'대표 전화번호를 하나로 통일하고, 오래된 등록 정보의 옛 번호를 정리하세요.',
		],
		codeLabel: 'sameAs 링크 예시',
		codeSnippet: sameAsSnippet(model),
	};
}

function contentFaqGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	const service = serviceLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `Perplexity and Claude cite question-and-answer context directly, more than raw keywords. Build 3–5 representative questions about ${service} into an FAQ section on the page and connect a FAQPage schema.`,
			detail: `Recommended question templates for ${brand}:`,
			checklist: faqQuestionTemplates(model, lang),
			codeLabel: 'Copy-ready FAQPage JSON-LD',
			codeSnippet: faqPageJsonLd(model),
		};
	}
	return {
		actionSummary: `Perplexity 및 Claude는 단순 키워드보다 '질문-답변' 형태의 문맥을 직접 인용합니다. 사이트 본문에 ${service} 관련 대표 질문 3~5개를 FAQ 섹션으로 구성하고 FAQPage 스키마를 연결하세요.`,
		detail: `${brand} 맞춤형 권장 질문 템플릿:`,
		checklist: faqQuestionTemplates(model, lang),
		codeLabel: '복사 가능한 FAQPage JSON-LD',
		codeSnippet: faqPageJsonLd(model),
	};
}

function citationSignalGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	const url = urlLabel(model, lang);
	const platforms = platformsLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `Relying on a single domain's own signal alone leaves external verification thin. Distribute text footprints containing [${brand}] and its official domain URL (${url}) across third-party platforms — blogs, press coverage, verified directories, and social profiles.`,
			checklist: [
				`Register / update the ${brand} profile on ${platforms} with full details.`,
				`Publish press releases or guest posts that explicitly state the official URL (${url}).`,
				'Add the official domain link to every social-profile bio (Instagram, YouTube, blog).',
			],
		};
	}
	return {
		actionSummary: `단독 도메인 신호만으로는 외부 검증 신뢰도가 낮습니다. 제3자 플랫폼(블로그, 언론 보도, 공인 디렉터리, SNS)에 [${brand}]과 공식 도메인 URL(${url})이 포함된 텍스트 풋프린트를 분산 생성하세요.`,
		checklist: [
			`${platforms}에 ${brand} 프로필 정보를 등록·보강하세요.`,
			`보도자료·게스트 포스팅에 공식 도메인 URL(${url})을 명시해 배포하세요.`,
			'SNS 프로필(인스타그램·유튜브·블로그) 소개란에 공식 도메인 링크를 추가하세요.',
		],
	};
}

function geoCitationGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	const service = serviceLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `The current GEO citation signal still has room to improve. Increase content — on official documents and third-party channels alike — that mentions ${brand} together with the "${service}" keyword to raise citation odds.`,
			checklist: [
				`Publish detail pages / posts that pair ${brand} with "${service}" as running text, not a bare keyword list.`,
				'Cross-link official documents (brochures, press releases) with the matching on-site page.',
			],
		};
	}
	return {
		actionSummary: `현재 GEO 인용 신호가 개선 여지가 있습니다. 공식 문서와 제3자 채널 모두에서 ${brand}과 "${service}" 키워드가 함께 서술형 문장으로 언급되는 콘텐츠를 늘려 인용 확률을 높이세요.`,
		checklist: [
			`${brand}과 "${service}"를 단순 키워드 나열이 아닌 서술형 문장으로 함께 다루는 상세 페이지·게시물을 발행하세요.`,
			'공식 문서(브로슈어, 보도자료)와 사이트 내 해당 페이지를 상호 링크하세요.',
		],
	};
}

function onpageGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	if (lang === 'en') {
		return {
			actionSummary: `Title tag and meta description entity consistency is weak. Rewrite them as a complete, factoid-style sentence structured as [region/field + brand + core service definition].`,
			checklist: [
				'Title should read as one complete phrase, not a keyword list separated by pipes/dashes.',
				'Meta description should state, in one factual sentence, who the brand is and what it does.',
				'Keep H1 aligned with the same brand + service entity used in Title/Meta.',
			],
			codeLabel: 'Recommended Title / Meta / H1 example',
			codeSnippet: [`Title — ${model.titleExample}`, `Meta — ${model.metaExample}`, `H1 — ${model.h1Example}`].join(
				'\n',
			),
		};
	}
	return {
		actionSummary: `Title 태그와 Meta Description의 엔티티 정합성이 약합니다. [지역/분야 + 브랜드명 + 핵심 서비스 정의] 구조의 완성형 단답형 문장(Factoid)으로 재작성하세요.`,
		checklist: [
			'Title은 파이프(|)·대시로 나열한 키워드가 아닌, 하나의 완성된 문구로 작성하세요.',
			'Meta Description은 브랜드가 누구이고 무엇을 하는지 하나의 사실 문장으로 서술하세요.',
			'H1도 Title/Meta와 동일한 브랜드+서비스 엔티티로 정렬하세요.',
		],
		codeLabel: '추천 Title / Meta / H1 예시',
		codeSnippet: [`Title — ${model.titleExample}`, `Meta — ${model.metaExample}`, `H1 — ${model.h1Example}`].join(
			'\n',
		),
	};
}

function crawlerAccessGuide(bot: 'GPTBot' | 'ClaudeBot', alias: string, lang: AuditLang): AiFixGuide {
	const vendor = bot === 'GPTBot' ? 'OpenAI' : 'Anthropic';
	if (lang === 'en') {
		return {
			actionSummary: `A ${bot} crawl-allow signal was not confirmed in robots.txt. Add an allow rule so ${vendor}'s crawler can index this site.`,
			checklist: [
				'Add the rule near the top of robots.txt, above any broad Disallow rules.',
				`Confirm no existing "Disallow: /" rule blocks ${bot} or ${alias}.`,
				'After deploying, open /robots.txt in a browser to verify the rule is live.',
			],
			codeLabel: 'robots.txt rule',
			codeSnippet: robotsTxtSnippet(bot, alias),
		};
	}
	return {
		actionSummary: `robots.txt에서 ${bot} 수집 허용 신호가 확인되지 않았습니다. ${vendor} 크롤러가 이 사이트를 인덱싱할 수 있도록 허용 규칙을 추가하세요.`,
		checklist: [
			'robots.txt 상단, 광범위한 Disallow 규칙보다 앞쪽에 허용 규칙을 추가하세요.',
			`기존 "Disallow: /" 규칙이 ${bot} 또는 ${alias}를 차단하고 있지 않은지 확인하세요.`,
			'배포 후 브라우저에서 /robots.txt에 접속해 규칙이 반영되었는지 확인하세요.',
		],
		codeLabel: 'robots.txt 규칙',
		codeSnippet: robotsTxtSnippet(bot, alias),
	};
}

function httpsGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const domain = domainLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `The origin is not served over HTTPS, so trust and crawl-foundation signals are weak across every AI engine. Install an SSL certificate and apply a permanent HTTP → HTTPS redirect.`,
			checklist: [
				`Issue and install an SSL certificate for ${domain} (Let's Encrypt or your CDN's managed certificate both work).`,
				'Rewrite all internal links, canonical tags, and sitemap URLs to https://.',
				'Add an HSTS header so browsers and crawlers always request the HTTPS version.',
			],
		};
	}
	return {
		actionSummary: `사이트가 HTTPS로 제공되지 않아 모든 AI 엔진 대상 신뢰·수집 기반 신호가 취약합니다. SSL 인증서를 설치하고 HTTP → HTTPS 영구 리다이렉트를 적용하세요.`,
		checklist: [
			`${domain}에 SSL 인증서를 발급·설치하세요(Let's Encrypt 또는 CDN 관리형 인증서 모두 가능).`,
			'내부 링크, canonical 태그, sitemap URL을 모두 https://로 변경하세요.',
			'HSTS 헤더를 적용해 브라우저·크롤러가 항상 HTTPS 버전을 요청하도록 하세요.',
		],
	};
}

function eeatGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const repTitle = repTitleLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `Content and external signals that support expertise, experience, and trust (E-E-A-T) are thin. Publish ${repTitle}'s credentials as a Person schema, and surface an author profile and sources on the content itself.`,
			checklist: [
				`State ${repTitle}'s qualifications, license/registration numbers, and years of experience in text — not just an image.`,
				'Add an author byline plus a short bio linking to the Person schema on long-form content.',
				'Cite sources or references for medical/legal/financial claims where relevant.',
			],
			codeLabel: 'Copy-ready Person JSON-LD',
			codeSnippet: personJsonLd(model, lang),
		};
	}
	return {
		actionSummary: `전문성·경험·신뢰성(E-E-A-T)을 뒷받침하는 콘텐츠와 외부 신호가 부족합니다. ${repTitle}의 이력·자격을 Person 스키마로 명시하고, 콘텐츠 자체에 작성자 프로필과 출처를 노출하세요.`,
		checklist: [
			`${repTitle}의 자격증·등록번호·경력을 이미지가 아닌 텍스트로 명시하세요.`,
			'장문형 콘텐츠에 작성자 표기와 Person 스키마로 연결되는 짧은 소개를 추가하세요.',
			'의료·법률·금융 등 전문 주장에는 근거 출처를 함께 인용하세요.',
		],
		codeLabel: '복사 가능한 Person JSON-LD',
		codeSnippet: personJsonLd(model, lang),
	};
}

function technicalReadinessGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const service = serviceLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `Technical completeness is still low, so AI crawlers may not fully collect the page's core information. Verify that the core ${service} text is present in the initial HTML without requiring client-side script execution (SSR).`,
			checklist: [
				'Confirm core text is visible with JavaScript disabled (view-source, not just DevTools).',
				'Reduce render-blocking scripts so crawlers do not time out before content loads.',
				'Fix broken internal links and duplicate/soft-404 pages that dilute crawl budget.',
			],
		};
	}
	return {
		actionSummary: `기술 완성도가 낮아 AI 크롤러가 핵심 정보를 온전히 수집하지 못할 수 있습니다. 핵심 ${service} 텍스트가 클라이언트 사이드 스크립트 실행 없이 초기 HTML에 그대로 노출(SSR)되는지 점검하세요.`,
		checklist: [
			'자바스크립트를 비활성화한 상태(뷰소스 기준)에서도 핵심 텍스트가 보이는지 확인하세요.',
			'렌더링을 지연시키는 스크립트를 줄여 크롤러가 콘텐츠 로딩 전에 타임아웃되지 않게 하세요.',
			'크롤 예산을 갉아먹는 깨진 내부 링크·중복/소프트 404 페이지를 정리하세요.',
		],
	};
}

function genericFallbackGuide(model: GeoWorkGuideModel, lang: AuditLang): AiFixGuide {
	const brand = brandLabel(model, lang);
	if (lang === 'en') {
		return {
			actionSummary: `Align this signal with ${brand}'s current entity data — brand name, official URL, and industry-specific schema — so AI engines can match it with higher confidence.`,
		};
	}
	return {
		actionSummary: `${brand}의 현재 엔티티 데이터(브랜드명·공식 URL·업종별 스키마)와 이 신호를 일치시켜 AI 엔진이 더 높은 확신으로 매칭할 수 있도록 하세요.`,
	};
}

// ---------------------------------------------------------------------------
// Cause-id → guide builder. Keyed by the specific `EngineCauseFactor.id`
// values emitted across every per-engine analyzer in `engine-readiness.ts`.
// ---------------------------------------------------------------------------

const GUIDE_BY_ID: Record<string, (model: GeoWorkGuideModel, lang: AuditLang) => AiFixGuide> = {
	'structured-data': structuredDataGuide,
	'organization-entity': organizationEntityGuide,
	'local-geographic': businessProfileGuide,
	'nap-entity': napEntityGuide,
	'external-entity': businessProfileGuide,
	'bing-places-profile': businessProfileGuide,
	'naver-place-profile': businessProfileGuide,
	'bing-entity': structuredDataGuide,
	'naver-entity': structuredDataGuide,
	'external-content': citationSignalGuide,
	'citation-docs': citationSignalGuide,
	'geo-citation': geoCitationGuide,
	'content-search-intent': contentFaqGuide,
	'expert-content': contentFaqGuide,
	eeat: eeatGuide,
	'technical-readiness': technicalReadinessGuide,
	onpage: onpageGuide,
	https: httpsGuide,
	gptbot: (model, lang) => crawlerAccessGuide('GPTBot', 'ChatGPT-User', lang),
	claudebot: (model, lang) => crawlerAccessGuide('ClaudeBot', 'anthropic-ai', lang),
};

const GUIDE_BY_CATEGORY: Record<EngineCauseCategory, (model: GeoWorkGuideModel, lang: AuditLang) => AiFixGuide> = {
	entity: organizationEntityGuide,
	structuredData: structuredDataGuide,
	onpage: onpageGuide,
	content: contentFaqGuide,
	searchIntent: contentFaqGuide,
	citation: citationSignalGuide,
	externalSignal: citationSignalGuide,
	technical: technicalReadinessGuide,
	localGeographic: businessProfileGuide,
	eeat: eeatGuide,
	brandAuthority: citationSignalGuide,
	businessProfile: businessProfileGuide,
};

/**
 * Resolves the actionable fix guide for one cause factor, dynamically bound
 * to the currently diagnosed site (`auditData`). Never hardcodes a business
 * name — every string is built from `auditData.brandName` / `.domain` /
 * `.url` / industry-derived fields, with safe generic fallbacks when a field
 * was never collected.
 */
export function getAiFixGuide(
	factor: Pick<EngineCauseFactor, 'id' | 'category'>,
	auditData: GeoWorkGuideModel,
	lang: AuditLang = 'ko',
): AiFixGuide {
	const byId = GUIDE_BY_ID[factor.id];
	if (byId) return byId(auditData, lang);
	const byCategory = GUIDE_BY_CATEGORY[factor.category];
	if (byCategory) return byCategory(auditData, lang);
	return genericFallbackGuide(auditData, lang);
}

import { generateSmartHashtags, normalizeHashtagList } from '@/lib/analysis/generateSmartHashtags';
import { ensureGuideData } from '@/lib/guide/ensure-guide-data';
import { GUIDE_SEO_MAX_DEFAULT, type AiEngineDiagnosis, type ChannelStatusItem, type GuideData, type GuideFaq, type GuideSocialLinks, type SubScores } from '@/lib/guide/types';
import { withJosa } from '@/lib/utils/korean';

export type { AiEngineDiagnosis, GuideData, GuideFaq, GuideSocialLinks };

type GuideReportTemplateProps = {
	data: GuideData;
};

function display(value: string | undefined, fallback: string): string {
	const next = (value || '').trim();
	return next || fallback;
}

function isFilled(value: string | undefined): boolean {
	return Boolean((value || '').trim());
}

function emptyLabel(label: string): string {
	return `${label} 미등록`;
}

function reportHashtags(data: GuideData, brand: string, features: string[]): string[] {
	const sanitized = normalizeHashtagList(data.keywords || []);
	if (sanitized.length) return sanitized;
	const generated = generateSmartHashtags({
		brandName: brand,
		region: data.region,
		industry: data.industry,
		address: data.address,
		coreFeatures: features,
		extractedKeywords: data.keywords || [],
	});
	return generated.length ? generated : ['#지역대표키워드', '#핵심서비스', '#브랜드명'];
}

function featureOr(features: string[], index: number, fallback: string): string {
	return features[index]?.trim() || fallback;
}

function sameAsUrls(links?: GuideSocialLinks | null): string[] {
	return [links?.youtube, links?.instagram, links?.facebook, links?.blog, links?.website]
		.map((url) => (url || '').trim())
		.filter(Boolean);
}

function instagramHandle(brandNameEng: string, slug: string): string {
	const raw = (brandNameEng || slug || 'brand').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
	return raw || 'brand';
}

function fileSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9가-힣]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 32);
}

const ENGINE_ICON: Record<string, string> = {
	chatgpt: 'GPT',
	gemini: 'G',
	perplexity: 'P',
	claude: 'C',
	copilot: 'MS',
	navercue: 'N',
};

const SUB_SCORE_LABELS: Array<{ key: keyof SubScores; label: string }> = [
	{ key: 'specialty', label: '전문성 (Specialty)' },
	{ key: 'localPresence', label: '지역성 (Local Presence)' },
	{ key: 'authority', label: '신뢰도 (Authority)' },
	{ key: 'uniqueness', label: '차별성 (Uniqueness)' },
	{ key: 'awareness', label: '인지도 (Awareness)' },
];

function clampDisplay(n: number, max = 100): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(max, Math.max(0, Math.round(n)));
}

function seoKpiCopy(score: number, max: number, brand: string): string {
	const pct = max > 0 ? score / max : 0;
	if (pct >= 0.9) {
		return `웹사이트 기본 SEO 점수: 검색엔진이 읽을 수 있는 사이트 기술적 구조는 완벽하게 구축되어 있습니다.`;
	}
	if (pct >= 0.6) {
		return `웹사이트 기본 SEO 점수: ${brand} 온페이지 기반은 확보됐으나 만점(${max}점)까지 기술 보완이 남았습니다.`;
	}
	return `웹사이트 기본 SEO 점수: ${score}/${max}점으로 색인·스키마 구조를 우선 보강해야 합니다.`;
}

function trustKpiCopy(score: number, brand: string): string {
	if (score >= 80) {
		return `AI TRUST (신뢰도): AI 엔진이 ${withJosa(brand, '을/를')} 신뢰할 수 있는 기관으로 안정적으로 인지하고 있습니다.`;
	}
	if (score >= 55) {
		return `AI TRUST (신뢰도): AI 엔진이 ${withJosa(brand, '을/를')} 신뢰할 수 있는 기관으로 인지하기 시작한 단계입니다.`;
	}
	return `AI TRUST (신뢰도): ${brand} 엔티티 신뢰 신호가 약합니다. 인용 문서와 E-E-A-T를 먼저 쌓으세요.`;
}

function potentialKpiCopy(score: number): string {
	if (score >= 80) {
		return `AI 추천 잠재력: 최상위 추천 진입이 가능한 신호 밀도입니다. 주력 키워드를 고정하세요.`;
	}
	if (score >= 55) {
		return `AI 추천 잠재력: 최신 장비·특화 서비스 관련 텍스트 신호가 보강되면 최상위 추천 진입이 유력합니다.`;
	}
	return `AI 추천 잠재력: 공식 정의 문장과 3rd-party 인용이 쌓이면 추천 후보군에 오를 수 있습니다.`;
}

function statusClass(status: AiEngineDiagnosis['status']): string {
	if (status === 'OPTIMAL') return 'guide-report__status--ok';
	if (status === 'CRITICAL') return 'guide-report__status--critical';
	return 'guide-report__status--warn';
}

function splitCauseLines(cause: string | undefined): string[] {
	return (cause || '')
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function AiEngineDiagnosisCard({ row }: { row: AiEngineDiagnosis }) {
	const status = row.status || 'WARNING';
	const isOptimal = status === 'OPTIMAL';
	const causes = splitCauseLines(row.detectedCause);
	const actions = (row.actionItems || []).map((item) => String(item || '').trim()).filter(Boolean);

	return (
		<article className={`guide-report__engine-card guide-report__engine-card--${status.toLowerCase()}`}>
			<div className="guide-report__engine-head">
				<div className="guide-report__engine-brand">
					<span className={`guide-report__engine-icon guide-report__engine-icon--${row.engine}`} aria-hidden>
						{ENGINE_ICON[row.engine] || '●'}
					</span>
					<div>
						<h3 className="guide-report__card-title" style={{ margin: 0 }}>
							{row.engineName}
						</h3>
						<p className="guide-report__engine-cat">{row.category}</p>
					</div>
				</div>
				<span className={`guide-report__status ${statusClass(status)}`}>{row.statusText || status}</span>
			</div>
			{!isOptimal && causes.length > 0 ? (
				<div className="guide-report__signal guide-report__signal--cause">
					<strong>신호가 덜 잡히는 원인</strong>
					{causes.length === 1 ? (
						<p className="guide-report__signal-text">{causes[0]}</p>
					) : (
						<ul className="guide-report__list">
							{causes.map((cause) => (
								<li key={cause}>{cause}</li>
							))}
						</ul>
					)}
				</div>
			) : null}
			{actions.length > 0 ? (
				<div className="guide-report__signal guide-report__signal--action">
					<strong>{isOptimal ? '유지 가이드' : '필수 조치 사항'}</strong>
					<ul className="guide-report__list">
						{actions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			) : null}
		</article>
	);
}

function ChannelBriefingCard({
	title,
	item,
}: {
	title: string;
	item?: ChannelStatusItem;
}) {
	const badge = item?.statusBadge?.trim() || '진단 대기';
	const tone = item?.badgeType || 'amber';
	return (
		<article className="guide-report__channel-card">
			<div className="guide-report__channel-head">
				<h3 className="guide-report__channel-title">{title}</h3>
				<span className={`guide-report__channel-badge guide-report__channel-badge--${tone}`}>{badge}</span>
			</div>
			<p className="guide-report__channel-desc">{item?.description || '채널 브리핑을 입력하세요.'}</p>
		</article>
	);
}

function fallbackDiagnoses(): AiEngineDiagnosis[] {
	const meta: Array<Pick<AiEngineDiagnosis, 'engine' | 'engineName' | 'category'>> = [
		{ engine: 'chatgpt', engineName: 'ChatGPT / SearchGPT', category: '웹 인덱싱 & 지식 베이스 검색' },
		{ engine: 'gemini', engineName: 'Google Gemini', category: '멀티모달 · Knowledge Graph · 유튜브' },
		{ engine: 'perplexity', engineName: 'Perplexity', category: '실시간 웹 크롤 · 인용 기반 답변' },
		{ engine: 'claude', engineName: 'Claude', category: '장문 추론 · 의학적 인과관계 텍스트' },
		{ engine: 'copilot', engineName: 'Microsoft Copilot', category: 'Bing Places · NAP 동기화' },
		{ engine: 'navercue', engineName: 'Naver Cue', category: '스마트플레이스 · 지식iN' },
	];
	return meta.map((row) => ({
		...row,
		status: 'WARNING',
		statusText: '진단 대기',
		detectedCause: '최근 진단 데이터를 불러오면 실측 원인과 조치가 채워집니다.',
		actionItems: ['관리자에서 [진단 목록에서 선택]을 실행하세요.'],
	}));
}

export function GuideReportTemplate({ data: incoming }: GuideReportTemplateProps) {
	const data = ensureGuideData(incoming);
	const brand = display(data.brandName, '해당 브랜드');
	const brandEng = display(data.brandNameEng, '');
	const industry = display(data.industry, '핵심 서비스');
	const region = display(data.region, '');
	const address = (data.address || '').trim();
	const telephone = (data.telephone || '').trim();
	const features = (data.coreFeatures || []).map((item) => String(item || '').trim()).filter(Boolean);
	const f0 = featureOr(features, 0, '주력 서비스');
	const f1 = featureOr(features, 1, '핵심 장비/상품');
	const f2 = featureOr(features, 2, '대표 시술/솔루션');
	const featureJoin = features.slice(0, 3).join('·') || f0;
	const chips = reportHashtags(data, brand, features);
	const handle = isFilled(data.brandNameEng) || isFilled(data.slug) ? instagramHandle(data.brandNameEng, data.slug) : '';
	const urls = sameAsUrls(data.socialLinks);
	const faq: GuideFaq = {
		question: display(data.faq?.question, `${region || '해당 지역'}에서 ${withJosa(f0, '을/를')} 받을 수 있는 곳은 어디인가요?`),
		answer: display(
			data.faq?.answer,
			`${address || region || '공식 사업장'}에 위치한 ${withJosa(brand, '은/는')} ${withJosa(f0, '을/를')} 중심으로 ${withJosa(industry, '을/를')} 제공합니다.`,
		),
	};
	const videoTitle = `${region || brand} ${f0} 원리 및 효과 분석 | ${brand}`;
	const videoFile = `${fileSlug(data.slug || region || brand)}-${fileSlug(f0) || 'service'}.mp4`;
	const photoFile = `${fileSlug(data.slug || region || brand)}-${fileSlug(f0) || 'service'}.jpg`;
	const sameAsJson = urls.length ? JSON.stringify(urls, null, 2) : '';
	const addressDisplay = address || emptyLabel('도로명 주소');
	const phoneDisplay = telephone || emptyLabel('대표 전화');
	const diagnoses = data.aiEngineDiagnoses?.length ? data.aiEngineDiagnoses : fallbackDiagnoses();
	const seoMax = data.seoMaxScore && data.seoMaxScore > 0 ? data.seoMaxScore : GUIDE_SEO_MAX_DEFAULT;
	const seoScore = clampDisplay(data.observedSeoScore, seoMax);
	const trustScore = clampDisplay(data.aiTrustScore);
	const potentialScore = clampDisplay(data.aiPotentialScore);
	const subScores: SubScores = {
		specialty: clampDisplay(data.subScores?.specialty),
		localPresence: clampDisplay(data.subScores?.localPresence),
		authority: clampDisplay(data.subScores?.authority),
		uniqueness: clampDisplay(data.subScores?.uniqueness),
		awareness: clampDisplay(data.subScores?.awareness),
	};
	const briefing = data.channelBriefing;

	return (
		<div className="guide-report" id="guide-print-root">
			{/* Raw CSS injected via dangerouslySetInnerHTML — a `{GUIDE_REPORT_CSS}` text
			    child gets HTML-entity-escaped (", ') during SSR but left raw on the
			    client's re-render, causing a hydration text mismatch. __html bypasses
			    React's text-node escaping on both sides, so server and client markup
			    always match byte-for-byte. */}
			<style dangerouslySetInnerHTML={{ __html: GUIDE_REPORT_CSS }} />
			<div className="guide-report__container">
				{/* ============================================================ */}
				{/* [리포트 제1섹션: 문서 표제부 + 진단 실측 종합 점수]              */}
				{/* 히어로 배너를 별도 컨테이너로 분리하지 않고, 이 카드 섹션의      */}
				{/* 최상단 내부 요소로 통합해 PDF 인쇄 시 외곽 컨테이너가 잘려도    */}
				{/* 표제부가 함께 누락되는 사고를 원천적으로 방지한다.              */}
				{/* ============================================================ */}
				<section className="guide-report__section section guide-report__section--intro">
					<div className="guide-report__doc-header">
						<div className="guide-report__badge-wrap">
							<span className="guide-report__badge guide-report__badge--primary">REDUE AI SEO & GEO STUDIO</span>
							<span className="guide-report__badge guide-report__badge--accent">전 채널 통합 최적화</span>
							<span className="guide-report__badge guide-report__badge--rose">유튜브 · SNS · AI 인용 마스터 플랜</span>
						</div>
						<h1 className="guide-report__main-title">
							{brand} AI(GEO) · 포털 · 유튜브 & SNS 상위 노출 전략
						</h1>
						<p className="guide-report__main-desc">
							{withJosa(brand, '은/는')} {region ? `${region}에서 ` : ''}
							<strong>{withJosa(featureJoin, '을/를')}</strong> 전문으로 하는 브랜드 인식을 만들고,
							구글·네이버·유튜브 검색 상위 및 멀티모달 AI(ChatGPT, Perplexity, Gemini, Claude, Copilot)
							인용을 선점하기 위한 실행 가이드입니다.
							{region ? <> 상권 기준: <strong>{region}</strong></> : <span className="guide-report__empty"> · 지역 미등록</span>}
						</p>
					</div>

					<div className="guide-report__divider" />

					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon guide-report__section-icon--score">📊</span>
						진단 실측 종합 점수 & 채널별 현주소 브리핑
					</h2>
					<div className="guide-report__score-hero score-hero-grid">
						<article className="guide-report__kpi">
							<span className="guide-report__kpi-type">OBSERVED · 진단 실측</span>
							<div className="guide-report__kpi-val">
								{seoScore} <span>/ {seoMax}</span>
							</div>
							<p className="guide-report__kpi-desc">{seoKpiCopy(seoScore, seoMax, brand)}</p>
						</article>
						<article className="guide-report__kpi guide-report__kpi--trust">
							<span className="guide-report__kpi-type">DERIVED · AI 분석 추정</span>
							<div className="guide-report__kpi-val guide-report__kpi-val--primary">
								{trustScore} <span>/ 100</span>
							</div>
							<p className="guide-report__kpi-desc">{trustKpiCopy(trustScore, brand)}</p>
						</article>
						<article className="guide-report__kpi guide-report__kpi--potential">
							<span className="guide-report__kpi-type">DERIVED · AI 분석 추정</span>
							<div className="guide-report__kpi-val guide-report__kpi-val--purple">
								{potentialScore} <span>/ 100</span>
							</div>
							<p className="guide-report__kpi-desc">{potentialKpiCopy(potentialScore)}</p>
						</article>
					</div>
					<div className="guide-report__sub-strip sub-scores-strip">
						{SUB_SCORE_LABELS.map(({ key, label }) => (
							<div key={key} className="guide-report__sub-item sub-score-item">
								<div className="guide-report__sub-label sub-score-label">{label}</div>
								<div className="guide-report__sub-num sub-score-num">
									{subScores[key]} <span>/100</span>
								</div>
							</div>
						))}
					</div>
					<div className="guide-report__channel-grid">
						<ChannelBriefingCard title="🤖 생성형 AI 검색 (GEO)" item={briefing?.aiSearch} />
						<ChannelBriefingCard title="🌐 구글 검색 & GBP" item={briefing?.googleSearch} />
						<ChannelBriefingCard title="🟢 네이버 스마트플레이스" item={briefing?.naverPlace} />
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon guide-report__section-icon--youtube">▶️</span>
						1. 유튜브 영상 SEO & 멀티모달 AI 인용 극대화 전략
					</h2>
					<p className="guide-report__lead">
						구글 검색 결과 상단의 <strong>추천 영상 모음(동영상 캐러셀)</strong>과 네이버{' '}
						<strong>맞춤형 영상 검색 결과(스마트블록 동영상 영역)</strong>에 가장 먼저 나타나도록 만들고, 글자뿐만
						아니라 영상의 소리와 화면까지 이해하는 최신 AI가 영상 속 <strong>자막</strong>을 직접 읽고 {withJosa(brand, '을/를')}{' '}
						추천하도록 유도합니다.
					</p>
					<div className="guide-report__ai-alert">
						<div className="guide-report__ai-alert-title">💡 멀티모달 AI & 구글의 유튜브 색인 원리</div>
						<p>
							최신 AI 검색 엔진(Gemini, Perplexity, 구글 AI 오버뷰)은 유튜브의 <strong>자동 자막(CC) 및 타임라인
							챕터 텍스트</strong>를 텍스트 데이터로 변환하여 학습·인용합니다. 영상 내에서{' '}
							<em>
								“{region} {brand}에서는 {f0}로…”
							</em>
							이라고 구두로 언급하고 자막을 등록하는 것만으로 AI 인용 확률이 크게 올라갑니다.
						</p>
					</div>
					<div className="guide-report__grid-2">
						<div className="guide-report__card">
							<span className="guide-report__card-tag guide-report__card-tag--hot">도달율 극대화</span>
							<div className="guide-report__card-header">
								<h3 className="guide-report__card-title">🎥 숏폼(Shorts) — 30~60초 직관적 소개</h3>
							</div>
							<ul className="guide-report__list">
								{features.slice(0, 3).map((item) => (
									<li key={item}>
										<strong>{item} 작동/현장 샷:</strong> {region} {brand}의 핵심 차별점을 30초 내 시각화.
									</li>
								))}
								{features.length === 0 ? (
									<li>
										<strong>주력 서비스 샷:</strong> 다운타임·효과·현장감을 30초 내 시각화.
									</li>
								) : null}
							</ul>
						</div>
						<div className="guide-report__card">
							<span className="guide-report__card-tag guide-report__card-tag--recommend">신뢰도 & AI 인용 1순위</span>
							<div className="guide-report__card-header">
								<h3 className="guide-report__card-title">🔬 롱폼(5~8분) — 심층 해설</h3>
							</div>
							<ul className="guide-report__list">
								<li>
									<strong>[칼럼형 영상]:</strong> “기존 방식과 {f0}의 차이점 ({region} {brand})”
								</li>
								<li>
									<strong>[복합 케어]:</strong> “{f1}과 {f2}, 언제 어떻게 결합해야 결과가 좋아질까?”
								</li>
								<li>
									<strong>챕터(타임스탬프) 표기:</strong> 00:00 인트로 / 01:20 {f0} 원리 / 03:40 맞춤 플랜 등
									구글이 챕터별로 검색 결과에 매핑하도록 구성.
								</li>
							</ul>
						</div>
					</div>
					<div className="guide-report__card" style={{ marginTop: 18 }}>
						<h3 className="guide-report__card-title" style={{ marginBottom: 10 }}>
							⚙️ 유튜브 업로드 시 필수 SEO 체크리스트
						</h3>
						<ol className="guide-report__steps">
							<li>
								<strong>제목 최적화:</strong> <code>{videoTitle}</code>
							</li>
							<li>
								<strong>설명란 텍스트 충실화:</strong> 첫 3줄에 핵심 키워드, {region} 위치, 공식 웹사이트 링크 및
								NAP 정보 삽입.
							</li>
							<li>
								<strong>정확한 자막(CC / .srt) 직접 업로드:</strong> AI 엔진이 오탈자 없이 {brand}, {f0}, {withJosa(f1, '을/를')}{' '}
								텍스트로 인식하도록 보장.
							</li>
							<li>
								<strong>영상 파일명 및 썸네일 파일명:</strong> <code>{videoFile}</code> 형식으로 키워드 삽입 후
								업로드.
							</li>
						</ol>
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon guide-report__section-icon--sns">📱</span>
						2. 멀티 SNS (인스타그램·페이스북·스레드) 시그널 & 검색 선점
					</h2>
					<p className="guide-report__lead">
						네이버 뷰(VIEW)/스마트블록, 구글 소셜 검색, 인스타그램 검색 탭뿐만 아니라{' '}
						<strong>소셜 브랜드 시그널(Social Mentions)</strong>을 통해 AI 검색 신뢰도 지표를 끌어올립니다.
					</p>
					<div className="guide-report__grid-3">
						<div className="guide-report__card">
							<span className="guide-report__card-tag" style={{ background: '#fce7f3', color: '#9d174d' }}>
								비주얼 & 프리미엄 브랜딩
							</span>
							<h3 className="guide-report__card-title">📸 인스타그램 & 스레드</h3>
							<ul className="guide-report__list">
								<li>
									<strong>위치 태그 고정:</strong> 모든 피드 및 릴스에 <code>{brand}</code> 및 <code>{region}</code>{' '}
									위치 태그 필수 적용.
								</li>
								<li>
									<strong>프로필 소개 최적화:</strong> “{region || '지역'} {industry} 전문 | {brand}”
								</li>
								{!data.socialLinks.instagram ? (
									<li className="guide-report__empty">인스타그램 URL 미등록 — 관리자에서 입력하면 sameAs와 NAP에 반영됩니다.</li>
								) : null}
								<li>
									<strong>스레드(Threads) Q&A:</strong> 텍스트 중심의 짧은 상식을 연재하여 구글 모바일 검색
									인덱싱 확보.
								</li>
							</ul>
						</div>
						<div className="guide-report__card">
							<span className="guide-report__card-tag" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
								지역 메타 그래프 신뢰도
							</span>
							<h3 className="guide-report__card-title">👥 페이스북 페이지</h3>
							<ul className="guide-report__list">
								<li>
									<strong>비즈니스 페이지 인증:</strong> 주소, 운영시간, 홈페이지 링크를 웹사이트와 100% 동일하게
									일치.
								</li>
								<li>
									<strong>블로그/유튜브 크로스 포스팅:</strong> 공식 칼럼과 유튜브 링크를 정기 공유하여 백링크 및
									소셜 시그널 형성.
								</li>
								<li>
									<strong>메타 로컬 검색 노출:</strong> 로컬 비즈니스 리뷰 및 체크인 데이터 축적.
								</li>
							</ul>
						</div>
						<div className="guide-report__card">
							<span className="guide-report__card-tag" style={{ background: '#ecfdf5', color: '#047857' }}>
								검색 알고리즘 연동
							</span>
							<h3 className="guide-report__card-title">🏷️ 타깃 해시태그 공식</h3>
							<div className="guide-report__tags">
								{chips.map((chip) => (
									<span key={chip} className="guide-report__chip">
										{chip}
									</span>
								))}
							</div>
						</div>
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon guide-report__section-icon--pr">🚀</span>
						3. AI 상위 인용을 위한 3대 추가 핵심 수단
					</h2>
					<div className="guide-report__grid-3">
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">📰 1. 언론 보도자료(PR) 송출</h3>
							<p className="guide-report__muted">
								<strong>Perplexity 및 SearchGPT의 1순위 데이터 소스는 공신력 있는 언론 기사입니다.</strong>
							</p>
							<ul className="guide-report__list">
								<li>
									<strong>기사 주제:</strong> “{region} {brand}, {industry} 경쟁력을 위한 {f0}·{f1} 도입”
								</li>
								<li>포털 뉴스 제휴 언론사를 통해 분기별/월별 1회 정보성 기사 배포.</li>
							</ul>
						</div>
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">🌐 2. 웹사이트 Schema sameAs</h3>
							<p className="guide-report__muted">
								<strong>모든 SNS 채널을 AI에게 하나의 동일 기관으로 묶어줍니다.</strong>
							</p>
							<ul className="guide-report__list">
								<li>
									웹사이트 JSON-LD의 <code>sameAs</code>에 유튜브, 인스타, 페이스북, 블로그 URL을 모두 선언.
								</li>
								<li>구글 지식 패널(Knowledge Panel) 생성 촉진.</li>
							</ul>
							{sameAsJson ? (
								<pre>{sameAsJson}</pre>
							) : (
								<p className="guide-report__empty">등록된 SNS·웹사이트 URL이 없습니다. 관리자에서 유튜브·인스타·페이스북·블로그를 입력하면 sameAs 예시가 채워집니다.</p>
							)}
						</div>
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">💬 3. 네이버 지식iN & 커뮤니티</h3>
							<p className="guide-report__muted">
								<strong>네이버 AI 큐(Cue:) 및 스마트블록 Q&A 영역을 직접 방어합니다.</strong>
							</p>
							<ul className="guide-report__list">
								<li>전문 답변 활동을 통해 {industry} 전문성 공인 획득.</li>
								<li>
									지역 커뮤니티에서 {f0} 관련 질의에 대한 브랜드 인지도 방어.
								</li>
							</ul>
						</div>
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon">🧠</span>
						4. 6대 AI 엔진 실측 진단 — 누락 원인과 처방
					</h2>
					<p className="guide-report__lead">
						이미 충족된 긍정 신호는 제외하고, {withJosa(brand, '이/가')}{' '}
						<strong>ChatGPT · Gemini · Perplexity · Claude · Copilot · Naver Cue</strong>에서
						실제 개선이 필요한 결함과 1:1 조치만 엔진별로 표시합니다.
					</p>
					<div className="guide-report__engine-grid">
						{diagnoses.map((row) => (
							<AiEngineDiagnosisCard key={row.engine} row={row} />
						))}
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon">📍</span>
						5. Bing Places 등록 절차 및 동기화 (Copilot AI 연동)
					</h2>
					<div className="guide-report__grid-2">
						<div className="guide-report__card">
							<div className="guide-report__card-header">
								<h3 className="guide-report__card-title">방법 1. 구글 프로필 동기화</h3>
								<span className="guide-report__card-tag guide-report__card-tag--recommend">가장 추천 · 1분</span>
							</div>
							<ol className="guide-report__steps">
								<li>
									<strong>bingplaces.com</strong> 공식 사이트 접속
								</li>
								<li>
									<strong>[Existing user]</strong> 또는 <strong>[Get started]</strong> 클릭
								</li>
								<li>
									<strong>&quot;Import from Google My Business&quot;</strong> 옵션 선택
								</li>
								<li>구글 계정 로그인 후 {brand} 사업장 데이터 일괄 동기화 완료</li>
							</ol>
						</div>
						<div className="guide-report__card">
							<div className="guide-report__card-header">
								<h3 className="guide-report__card-title">방법 2. 수동 직접 등록</h3>
								<span className="guide-report__card-tag">정밀 설정</span>
							</div>
							<ol className="guide-report__steps">
								<li>
									<strong>bingplaces.com</strong> 접속 후 MS 계정 로그인
								</li>
								<li>사업장 유형 및 국가(South Korea) 선택</li>
								<li>
									상호명 <strong>{brand}</strong>, 업종 <strong>{industry}</strong>, 전화번호{' '}
									<strong>{phoneDisplay}</strong> 입력
								</li>
								<li>
									도로명 주소 <strong>{addressDisplay}</strong> 입력 후 지도 핀 위치 확인 및 인증
								</li>
							</ol>
						</div>
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon">🤖</span>
						6. AI 상위 노출을 위한 Entity 정의 & Q&A
					</h2>
					<div className="guide-report__highlight">
						<div className="guide-report__highlight-title">💡 브랜드 Entity 서술 표준안</div>
						<p>
							{withJosa(brand, '은/는')} {region ? `${region}에서 ` : ''}
							<strong>{withJosa(featureJoin, '을/를')}</strong> 전문으로 제공하는 로컬 엔티티입니다.
							{address ? (
								<>
									{' '}공식 주소는 <strong>{address}</strong>입니다.
								</>
							) : (
								<> 공식 주소는 아직 등록되지 않았습니다.</>
							)}
							{telephone ? (
								<>
									{' '}대표 전화는 <strong>{telephone}</strong>입니다.
								</>
							) : null}
						</p>
					</div>
					<div className="guide-report__qa">
						<div className="guide-report__qa-q">Q. {faq.question}</div>
						<div className="guide-report__qa-a">
							<strong>A.</strong> {faq.answer}
						</div>
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon">🌐</span>
						7. 구글 검색 & 구글 비즈니스 프로필(GBP) 상위 노출
					</h2>
					<div className="guide-report__grid-2">
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">🏷️ 카테고리 다각화</h3>
							<ul className="guide-report__list">
								<li>
									<strong>기본 카테고리:</strong> {industry}
								</li>
								<li>
									<strong>보조 카테고리:</strong> {f0}, {f1}
								</li>
							</ul>
						</div>
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">🛠️ 서비스 탭 전면 등록</h3>
							<ul className="guide-report__list">
								{(features.length ? features : [f0, f1, f2]).map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">📸 현장 사진 & 메타데이터</h3>
							<ul className="guide-report__list">
								<li>원내/매장 실물 및 인증 자료 고화질 업로드</li>
								<li>
									파일명: <code>{photoFile}</code>
								</li>
							</ul>
						</div>
						<div className="guide-report__card">
							<h3 className="guide-report__card-title">📝 구글 소식 정기 발행</h3>
							<ul className="guide-report__list">
								<li>
									주 1~2회 {f0} 원리 및 {industry} 요약 포스팅
								</li>
								<li>예약/문의 CTA 링크 포함</li>
							</ul>
						</div>
					</div>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon">🟢</span>
						8. 네이버 스마트플레이스 & 브랜드 블로그 전략
					</h2>
					<h3 className="guide-report__subhead">① 네이버 스마트플레이스 최적화</h3>
					<div>
						<span className="guide-report__label">대표 키워드 5개 설정:</span>
						<div className="guide-report__tags">
							{chips.slice(0, 5).map((chip) => (
								<span key={chip} className="guide-report__chip">
									{chip}
								</span>
							))}
						</div>
					</div>
					<div className="guide-report__quote">
						<strong>소개글 및 상세설명 개편 첫 문장:</strong>
						<br />
						“{withJosa(industry, '을/를')} 넘어, {withJosa(features.slice(0, 2).join('·') || f0, '을/를')} 기반으로 {region || '지역'} 고객에게 정밀 서비스를
						제공하는 {brand}입니다.”
					</div>
					<ul className="guide-report__list">
						<li>
							<strong>메뉴 등록:</strong> {f0}, {f1} 등 상세 설명 포함
						</li>
						<li>
							<strong>네이버 예약 & 톡톡 연동:</strong> 세부 예약 항목을 분리하여 플레이스 검색 가산점 확보
						</li>
					</ul>
					<hr className="guide-report__hr" />
					<h3 className="guide-report__subhead">② 공식 브랜드 블로그</h3>
					<ul className="guide-report__list">
						<li>
							<strong>신뢰성 중심 설명:</strong> 단순 전후 나열을 지양하고 원리와 과정 중심의 설명 제공
						</li>
						<li>
							<strong>핵심 연재 주제:</strong>
							<ol className="guide-report__nested">
								<li>
									“{region} {f0}, 왜 {brand}에서 효과적인가?”
								</li>
								<li>
									“{f1}과 {f2}의 차이점과 결합 플랜”
								</li>
								<li>
									“{industry} 고객이 처음 상담에서 확인해야 할 체크리스트”
								</li>
							</ol>
						</li>
					</ul>
				</section>

				<section className="guide-report__section section">
					<h2 className="guide-report__section-title">
						<span className="guide-report__section-icon">🔗</span>
						9. 이름·주소·전화번호(NAP) 일관성 확보 매트릭스
					</h2>
					<p className="guide-report__lead">
						모든 검색 엔진, AI 모델, SNS 플랫폼이 {withJosa(brand, '을/를')} <strong>독립된 하나의 개체</strong>로 식별할 수 있도록
						채널 간 정보를 100% 일치시켜야 합니다.
					</p>
					<div className="guide-report__table-wrap">
						<table>
							<thead>
								<tr>
									<th>채널 구분</th>
									<th>상호명 표기</th>
									<th>주소 표기 (100% 동일 유지)</th>
									<th>대표 전화</th>
								</tr>
							</thead>
							<tbody>
								{[
									['공식 홈페이지', brand],
									['네이버 플레이스', brand],
									['구글 비즈니스 프로필', brandEng ? `${brand} (${brandEng})` : brand],
									['유튜브 공식 채널', data.socialLinks.youtube ? `${brand} (${brandEng || '공식'})` : `${brand} · ${emptyLabel('유튜브')}`],
									['인스타그램 / 페이스북', handle ? `${brand} (${handle})` : `${brand} · ${emptyLabel('SNS')}`],
									['Bing Places', brand],
									['카카오맵 / T맵', brand],
								].map(([channel, name]) => (
									<tr key={channel}>
										<td>
											<span className="guide-report__channel">{channel}</span>
										</td>
										<td>{name}</td>
										<td>
											<span className={address ? 'guide-report__exact' : 'guide-report__empty'}>{addressDisplay}</span>
										</td>
										<td>
											<span className={telephone ? 'guide-report__exact' : 'guide-report__empty'}>{phoneDisplay}</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				<footer className="guide-report__footer">
					© REDUE AI SEO & GEO Studio • Omnichannel AI & Search Entity Optimization Framework
				</footer>
			</div>
		</div>
	);
}

const GUIDE_REPORT_CSS = `
.guide-report {
  --guide-primary: #2563eb;
  --guide-primary-dark: #1d4ed8;
  --guide-primary-light: #eff6ff;
  --guide-accent: #0d9488;
  --guide-rose: #e11d48;
  --guide-rose-light: #fff1f2;
  --guide-amber: #d97706;
  --guide-amber-light: #fffbeb;
  --guide-purple: #7c3aed;
  --guide-purple-light: #f5f3ff;
  --guide-slate-900: #0f172a;
  --guide-slate-800: #1e293b;
  --guide-slate-700: #334155;
  --guide-slate-600: #475569;
  --guide-slate-500: #64748b;
  --guide-slate-200: #e2e8f0;
  --guide-slate-100: #f1f5f9;
  --guide-slate-50: #f8fafc;
  --guide-radius: 14px;
  color: var(--guide-slate-800);
  line-height: 1.7;
  background: #f1f5f9;
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.guide-report * { box-sizing: border-box; }
.guide-report__container { max-width: 1140px; margin: 0 auto; padding: 28px 20px 16px; }
/* 문서 표제부: 더 이상 독립된 다크 히어로 컨테이너가 아니라, 제1섹션(진단 실측
   종합 점수) 카드 내부 최상단 요소다. 인쇄 시 섹션 카드 자체가 뜯겨도 표제부가
   함께 살아있도록, 별도 배경/그림자 없이 섹션의 흰 배경 위에 얹힌 형태로 둔다. */
.guide-report__doc-header { margin-bottom: 4px; }
.guide-report__badge-wrap { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.guide-report__badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 13px; border-radius: 9999px;
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.02em;
}
.guide-report__badge--primary { background: var(--guide-primary-light); color: var(--guide-primary-dark); border: 1px solid #bfdbfe; }
.guide-report__badge--accent { background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; }
.guide-report__badge--rose { background: var(--guide-rose-light); color: #be123c; border: 1px solid #fecdd3; }
.guide-report__main-title {
  font-size: 1.85rem; font-weight: 800; line-height: 1.35;
  margin: 0 0 12px; letter-spacing: -0.025em; color: var(--guide-slate-900);
}
.guide-report__main-desc { color: var(--guide-slate-600); font-size: 0.98rem; max-width: 860px; margin: 0; line-height: 1.65; }
.guide-report__main-desc strong { color: var(--guide-slate-900); }
.guide-report__divider { height: 1px; background: var(--guide-slate-200); margin: 20px 0 24px; }
.guide-report__section--intro { padding-top: 30px; }
.guide-report__section {
  background: #fff;
  border-radius: var(--guide-radius);
  border: 1px solid var(--guide-slate-200);
  padding: 34px 30px;
  margin-bottom: 28px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  page-break-inside: avoid;
  break-inside: avoid;
}
.guide-report .section { page-break-inside: avoid; break-inside: avoid; }
.guide-report__section-title {
  display: flex; align-items: center; gap: 12px;
  font-size: 1.35rem; font-weight: 700; color: var(--guide-slate-900);
  margin: 0 0 20px; padding-bottom: 14px; border-bottom: 2px solid var(--guide-slate-100);
}
.guide-report__section-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.15rem; background: var(--guide-primary-light); color: var(--guide-primary);
  flex-shrink: 0;
}
.guide-report__section-icon--score { background: #dbeafe; color: #1e40af; }
.guide-report__section-icon--youtube { background: var(--guide-rose-light); color: var(--guide-rose); }
.guide-report__section-icon--sns { background: var(--guide-purple-light); color: var(--guide-purple); }
.guide-report__section-icon--pr { background: var(--guide-amber-light); color: var(--guide-amber); }
.guide-report__score-hero {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;
}
.guide-report__kpi {
  background: var(--guide-slate-50); border: 1px solid var(--guide-slate-200);
  border-radius: 12px; padding: 22px; page-break-inside: avoid; break-inside: avoid;
}
.guide-report__kpi--trust, .guide-report__kpi--potential {
  background: linear-gradient(145deg, #eff6ff, #f8fafc); border-color: #bfdbfe;
}
.guide-report__kpi-type {
  font-size: 0.76rem; font-weight: 800; color: var(--guide-slate-500);
  letter-spacing: 0.05em; text-transform: uppercase; display: block; margin-bottom: 4px;
}
.guide-report__kpi-val {
  font-size: 2.2rem; font-weight: 900; color: var(--guide-slate-900); line-height: 1.15;
}
.guide-report__kpi-val span { font-size: 1.1rem; color: var(--guide-slate-500); font-weight: 600; }
.guide-report__kpi-val--primary { color: var(--guide-primary); }
.guide-report__kpi-val--purple { color: var(--guide-purple); }
.guide-report__kpi-desc { font-size: 0.88rem; color: var(--guide-slate-600); margin: 6px 0 0; line-height: 1.5; }
.guide-report__sub-strip {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
  background: #f8fafc; padding: 16px; border-radius: 12px;
  border: 1px solid var(--guide-slate-200); margin-bottom: 22px;
}
.guide-report__sub-item { text-align: center; padding: 8px 4px; border-right: 1px solid var(--guide-slate-200); }
.guide-report__sub-item:last-child { border-right: none; }
.guide-report__sub-label { font-size: 0.82rem; color: var(--guide-slate-600); font-weight: 700; margin-bottom: 2px; }
.guide-report__sub-num { font-size: 1.25rem; font-weight: 900; color: var(--guide-primary); }
.guide-report__sub-num span { font-size: 0.75rem; color: var(--guide-slate-400); font-weight: 600; }
.guide-report__channel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.guide-report__channel-card {
  background: #fff; border: 1px solid var(--guide-slate-200); border-radius: 12px;
  padding: 18px 20px; page-break-inside: avoid; break-inside: avoid;
}
.guide-report__channel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.guide-report__channel-title { font-size: 1rem; font-weight: 800; color: var(--guide-slate-900); margin: 0; }
.guide-report__channel-badge {
  font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
}
.guide-report__channel-badge--amber { background: var(--guide-amber-light); color: var(--guide-amber); border: 1px solid #fde68a; }
.guide-report__channel-badge--green { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
.guide-report__channel-badge--blue { background: var(--guide-primary-light); color: var(--guide-primary); border: 1px solid #bfdbfe; }
.guide-report__channel-desc { font-size: 0.88rem; color: var(--guide-slate-600); line-height: 1.6; margin: 0; }
.guide-report__lead { color: var(--guide-slate-600); font-size: 0.95rem; margin: 0 0 8px; }
.guide-report__muted { font-size: 0.88rem; color: var(--guide-slate-600); margin: 8px 0; }
.guide-report__empty { font-size: 0.88rem; color: var(--guide-slate-500); font-style: italic; }
.guide-report__grid-2, .guide-report__grid-3 {
  display: grid; gap: 18px; margin-top: 16px;
}
.guide-report__grid-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.guide-report__grid-3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.guide-report__card {
  background: var(--guide-slate-50);
  border: 1px solid var(--guide-slate-200);
  border-radius: 11px;
  padding: 22px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.guide-report__card-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.guide-report__card-title { font-size: 1.05rem; font-weight: 700; color: var(--guide-slate-900); display: flex; align-items: center; gap: 8px; margin: 8px 0 10px; }
.guide-report__card-tag {
  display: inline-block; font-size: 0.75rem; font-weight: 700;
  padding: 3px 8px; border-radius: 6px; background: #e2e8f0; color: var(--guide-slate-700);
}
.guide-report__card-tag--recommend { background: #dbeafe; color: #1e40af; }
.guide-report__card-tag--hot { background: #fee2e2; color: #b91c1c; }
.guide-report__list { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; }
.guide-report__list li { position: relative; padding-left: 20px; font-size: 0.95rem; color: var(--guide-slate-700); }
.guide-report__list li::before { content: "•"; position: absolute; left: 6px; color: var(--guide-primary); font-weight: bold; }
.guide-report__steps { list-style: none; counter-reset: step-counter; display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; }
.guide-report__steps li { position: relative; padding-left: 32px; font-size: 0.95rem; color: var(--guide-slate-700); }
.guide-report__steps li::before {
  counter-increment: step-counter; content: counter(step-counter);
  position: absolute; left: 0; top: 2px; width: 22px; height: 22px;
  background: var(--guide-primary); color: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700;
}
.guide-report__highlight {
  background: #f0fdf4; border-left: 4px solid #16a34a;
  padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0;
}
.guide-report__highlight-title { font-weight: 700; color: #15803d; margin-bottom: 6px; font-size: 0.95rem; }
.guide-report__highlight p { font-size: 0.92rem; color: #166534; margin: 0; }
.guide-report__quote {
  background: #f8fafc; border-left: 4px solid var(--guide-primary);
  padding: 14px 18px; margin: 12px 0; border-radius: 0 8px 8px 0;
  color: var(--guide-slate-700); font-size: 0.95rem;
}
.guide-report__ai-alert {
  background: #faf5ff; border: 1px solid #e9d5ff; border-left: 4px solid var(--guide-purple);
  padding: 16px 20px; border-radius: 0 10px 10px 0; margin: 16px 0;
}
.guide-report__ai-alert-title { font-weight: 700; color: #6b21a8; margin-bottom: 6px; font-size: 0.95rem; }
.guide-report__ai-alert p { font-size: 0.92rem; color: #581c87; margin: 0; }
.guide-report__qa {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 12px;
}
.guide-report__qa-q { font-weight: 700; color: var(--guide-primary-dark); margin-bottom: 6px; }
.guide-report__qa-a { color: var(--guide-slate-700); font-size: 0.93rem; padding-left: 8px; }
.guide-report__tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.guide-report__chip {
  background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 20px;
  font-size: 0.85rem; font-weight: 600; border: 1px solid #bae6fd;
}
.guide-report__table-wrap { overflow-x: auto; margin-top: 16px; border-radius: 8px; border: 1px solid var(--guide-slate-200); }
.guide-report table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.92rem; }
.guide-report thead th {
  background: var(--guide-slate-100); color: var(--guide-slate-900); font-weight: 700;
  padding: 14px 18px; border-bottom: 2px solid var(--guide-slate-200); white-space: nowrap;
}
.guide-report tbody td { padding: 14px 18px; border-bottom: 1px solid var(--guide-slate-200); color: var(--guide-slate-700); }
.guide-report tbody tr:last-child td { border-bottom: none; }
.guide-report tbody tr:nth-child(even) { background: #fbfcfe; }
.guide-report__channel { font-weight: 700; color: var(--guide-slate-900); }
.guide-report__exact {
  color: #0f766e; font-weight: 600; font-family: ui-monospace, Consolas, monospace;
  background: #f0fdfa; padding: 3px 8px; border-radius: 4px; display: inline-block;
}
.guide-report pre {
  background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px;
  font-size: 0.82rem; overflow-x: auto; margin-top: 12px;
  font-family: Consolas, Monaco, monospace; white-space: pre-wrap;
}
.guide-report code {
  font-family: Consolas, Monaco, monospace; font-size: 0.86em;
  background: #e2e8f0; padding: 1px 5px; border-radius: 4px;
}
.guide-report__subhead { font-size: 1.1rem; font-weight: 700; color: var(--guide-slate-900); margin: 0 0 8px; }
.guide-report__label { font-size: 0.9rem; font-weight: 700; color: var(--guide-slate-700); }
.guide-report__hr { border: 0; border-top: 1px solid var(--guide-slate-200); margin: 24px 0; }
.guide-report__nested { margin: 6px 0 0 20px; padding: 0; font-size: 0.92rem; color: var(--guide-slate-700); display: flex; flex-direction: column; gap: 4px; }
.guide-report__engine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.guide-report__engine-card {
  background: #fff;
  border: 1px solid var(--guide-slate-200);
  border-radius: 12px;
  padding: 18px 18px 16px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.guide-report__engine-card--optimal { border: 2px solid #22c55e; background: #f0fdf4; }
.guide-report__engine-card--warning { border-color: #fcd34d; background: #fffbeb; }
.guide-report__engine-card--critical { border-color: #fda4af; background: #fff1f2; }
.guide-report__engine-head {
  display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
}
.guide-report__engine-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.guide-report__engine-icon {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 0.78rem; flex-shrink: 0;
  background: #fff; border: 1px solid var(--guide-slate-200);
}
.guide-report__engine-icon--chatgpt { background: #e6f7ef; color: #10a37f; border-color: #bbf7d0; }
.guide-report__engine-icon--gemini { background: #eef2ff; color: #4285f4; border-color: #c7d2fe; }
.guide-report__engine-icon--perplexity { background: #e0f2fe; color: #0284c7; border-color: #bae6fd; }
.guide-report__engine-icon--claude { background: #fbf0ea; color: #d97706; border-color: #fed7aa; }
.guide-report__engine-icon--copilot { background: #eff6ff; color: #0078d4; border-color: #bfdbfe; }
.guide-report__engine-icon--navercue { background: #eafaf1; color: #03c75a; border-color: #bbf7d0; }
.guide-report__signal {
  margin-bottom: 12px; padding: 14px 16px; border-radius: 10px;
  font-size: 0.9rem; line-height: 1.6; color: var(--guide-slate-700);
}
.guide-report__signal strong { display: block; margin-bottom: 6px; font-size: 0.82rem; }
.guide-report__signal-text { margin: 0; }
.guide-report__signal--cause { background: #fff5f5; border-left: 4px solid var(--guide-rose); }
.guide-report__signal--cause strong { color: #991b1b; }
.guide-report__signal--action { background: #f0fdf4; border-left: 4px solid #16a34a; margin-bottom: 0; }
.guide-report__signal--action strong { color: #166534; }
.guide-report__signal--cause .guide-report__list li::before { content: "⚠"; left: 0; color: #be123c; font-size: 0.75rem; }
.guide-report__signal--action .guide-report__list li::before { content: "✓"; left: 2px; color: #15803d; }
.guide-report__engine-cat { margin: 2px 0 0; font-size: 0.78rem; color: var(--guide-slate-500); }
.guide-report__status {
  margin-left: auto; font-size: 0.72rem; font-weight: 800;
  padding: 4px 9px; border-radius: 999px; white-space: nowrap;
}
.guide-report__status--ok { background: #dcfce7; color: #166534; }
.guide-report__status--warn { background: #fef3c7; color: #92400e; }
.guide-report__status--critical { background: #fee2e2; color: #9f1239; }
.guide-report__engine-cause {
  font-size: 0.9rem; color: var(--guide-slate-700); margin: 0 0 10px; line-height: 1.65;
}
.guide-report__engine-cause strong { display: block; font-size: 0.75rem; letter-spacing: 0.02em; color: var(--guide-slate-500); margin-bottom: 4px; }
.guide-report__footer { text-align: center; padding: 30px 0 10px; color: var(--guide-slate-500); font-size: 0.88rem; }
@media screen and (max-width: 900px) {
  .guide-report__score-hero, .guide-report__channel-grid { grid-template-columns: 1fr; }
  .guide-report__sub-strip { grid-template-columns: repeat(3, 1fr); }
  .guide-report__sub-item:nth-child(3) { border-right: none; }
}
@media screen and (max-width: 768px) {
  .guide-report__container { padding: 16px 10px; }
  .guide-report__main-title { font-size: 1.4rem; }
  .guide-report__section { padding: 24px 18px; }
  .guide-report__grid-2, .guide-report__grid-3 { grid-template-columns: 1fr; }
  .guide-report__sub-strip { grid-template-columns: repeat(2, 1fr); }
}
@media print {
  .guide-report {
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .guide-report__container { max-width: none; padding: 0; }
  .guide-report__section, .guide-report__card, .guide-report__chip,
  .guide-report__highlight, .guide-report__ai-alert, .guide-report__exact, .guide-report thead th,
  .guide-report__engine-card, .guide-report__status, .guide-report__kpi, .guide-report__sub-strip,
  .guide-report__channel-card, .guide-report__channel-badge, .guide-report__signal, .guide-report__badge {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .guide-report__section, .guide-report__card, .section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* 문서 표제부: 별도 컨테이너가 아니라 제1섹션(진단 실측 종합 점수) 카드
     내부 최상단 요소다. 섹션이 흰 배경 + page-break-inside:avoid를 그대로
     물려주므로, 표제부만 추가로 페이지 경계에서 잘리지 않도록 한 번 더 못박는다. */
  .guide-report__section--intro {
    break-before: avoid !important;
    page-break-before: avoid !important;
  }
  .guide-report__doc-header {
    display: block !important;
    margin-bottom: 2px !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .guide-report__main-title {
    color: #020617 !important;
    font-size: 19px !important;
    font-weight: 900 !important;
    line-height: 1.35 !important;
    margin-bottom: 8px !important;
  }
  .guide-report__main-desc {
    color: #334155 !important;
    font-size: 11.5px !important;
    line-height: 1.55 !important;
    max-width: none !important;
  }
  .guide-report__main-desc strong {
    color: #0f172a !important;
  }
  .guide-report__doc-header .guide-report__empty {
    color: #64748b !important;
  }
  .guide-report__divider {
    margin: 14px 0 18px !important;
    background: #cbd5e1 !important;
  }

  /* 상단 뱃지 칩: 흰 섹션 카드 위에서도 또렷하게 보이도록 라이트 팔레트로 고정 */
  .guide-report__badge {
    background: #f1f5f9 !important;
    border: 1px solid #cbd5e1 !important;
  }
  .guide-report__badge--primary {
    background: #eff6ff !important;
    color: #1d4ed8 !important;
    border-color: #bfdbfe !important;
  }
  .guide-report__badge--accent,
  .guide-report__badge--rose {
    color: #334155 !important;
  }

  .guide-report__section { margin-bottom: 16px; box-shadow: none; }

  /* 상단 3대 종합 점수: 인쇄 시 가로 3열 유지 (모바일 1열 덮어쓰기) */
  .guide-report__score-hero,
  .score-hero-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 10px !important;
    margin-bottom: 14px !important;
  }

  /* 5대 세부 지표: 인쇄 폭과 무관하게 1줄 5열 고정 */
  .guide-report__sub-strip,
  .sub-scores-strip {
    display: grid !important;
    grid-template-columns: repeat(5, 1fr) !important;
    gap: 6px !important;
    padding: 10px 12px !important;
    margin-bottom: 16px !important;
    background: #f8fafc !important;
    border: 1px solid #cbd5e1 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .guide-report__sub-item,
  .sub-score-item {
    text-align: center !important;
    padding: 4px 2px !important;
    border-right: 1px solid #e2e8f0 !important;
  }

  .guide-report__sub-item:last-child,
  .sub-score-item:last-child {
    border-right: none !important;
  }

  .guide-report__sub-item:nth-child(3),
  .sub-score-item:nth-child(3) {
    border-right: 1px solid #e2e8f0 !important;
  }

  .guide-report__sub-label,
  .sub-score-label {
    font-size: 11px !important;
    white-space: nowrap !important;
    margin-bottom: 2px !important;
  }

  .guide-report__sub-num,
  .sub-score-num {
    font-size: 16px !important;
    white-space: nowrap !important;
  }

  .guide-report__sub-num span,
  .sub-score-num span {
    font-size: 10px !important;
  }

  .guide-report__channel-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 10px !important;
  }

  /* 3대 채널 브리핑 헤더: 인쇄 시 [타이틀] / [상태 뱃지] 세로 2줄로 분리 */
  .guide-report__channel-head {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    gap: 4px !important;
    margin-bottom: 8px !important;
  }

  .guide-report__channel-title {
    font-size: 13px !important;
    line-height: 1.3 !important;
  }

  .guide-report__channel-badge {
    align-self: flex-start !important;
    margin-top: 2px !important;
    font-size: 11px !important;
    padding: 2px 8px !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

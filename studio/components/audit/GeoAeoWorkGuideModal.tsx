'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { resolveGeoWorkGuideModel } from '@/lib/audit/geo-work-guide';
import type { AuditReport } from '@/lib/site-auditor';
import { withKoreanParticle } from '@/lib/utils/korean';
import './geo-aeo-work-guide.css';

const GUIDE_FONTS_ID = 'geo-aeo-guide-fonts';
const GUIDE_THEME_KEY = 'geoGuideTheme';
const GUIDE_FONT_HREF =
	'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans+KR:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

type GuideTheme = 'dark' | 'light';

function readStoredGuideTheme(): GuideTheme {
	if (typeof window === 'undefined') return 'dark';
	try {
		return window.localStorage.getItem(GUIDE_THEME_KEY) === 'light' ? 'light' : 'dark';
	} catch {
		return 'dark';
	}
}

function ensureGuideFonts() {
	if (typeof document === 'undefined' || document.getElementById(GUIDE_FONTS_ID)) return;

	const preconnectGstatic = document.createElement('link');
	preconnectGstatic.rel = 'preconnect';
	preconnectGstatic.href = 'https://fonts.gstatic.com';
	preconnectGstatic.crossOrigin = 'anonymous';
	document.head.appendChild(preconnectGstatic);

	const preconnectGoogle = document.createElement('link');
	preconnectGoogle.rel = 'preconnect';
	preconnectGoogle.href = 'https://fonts.googleapis.com';
	document.head.appendChild(preconnectGoogle);

	const stylesheet = document.createElement('link');
	stylesheet.id = GUIDE_FONTS_ID;
	stylesheet.rel = 'stylesheet';
	stylesheet.href = GUIDE_FONT_HREF;
	document.head.appendChild(stylesheet);
}

interface EntityGraphLabels {
	core: string;
	person: string;
	asset: string;
	location: string;
	service: string;
}

function EntityGraph({ playKey, labels }: { playKey: number; labels: EntityGraphLabels }) {
	return (
		<svg key={playKey} id="entityGraph" viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" aria-hidden>
			<path className="g-edge" d="M400,105 L180,60" style={{ animationDelay: '.15s' }} />
			<path className="g-edge" d="M400,105 L620,60" style={{ animationDelay: '.28s' }} />
			<path className="g-edge" d="M400,105 L180,155" style={{ animationDelay: '.41s' }} />
			<path className="g-edge" d="M400,105 L620,155" style={{ animationDelay: '.54s' }} />
			<path className="g-edge" d="M180,60 L180,155" style={{ animationDelay: '.67s' }} />
			<path className="g-edge" d="M620,60 L620,155" style={{ animationDelay: '.67s' }} />

			<g className="g-node core" style={{ animationDelay: '.05s' }} transform="translate(400,105)">
				<g className="g-node-inner" style={{ animationDelay: '.05s' }}>
					<circle r="34" />
					<text textAnchor="middle" dy="4">
						{labels.core}
					</text>
				</g>
			</g>
			<g className="g-node" style={{ animationDelay: '.3s' }} transform="translate(180,60)">
				<g className="g-node-inner" style={{ animationDelay: '.3s' }}>
					<circle r="26" />
					<text textAnchor="middle" dy="4">
						{labels.person}
					</text>
				</g>
			</g>
			<g className="g-node" style={{ animationDelay: '.45s' }} transform="translate(620,60)">
				<g className="g-node-inner" style={{ animationDelay: '.45s' }}>
					<circle r="26" />
					<text textAnchor="middle" dy="4">
						{labels.asset}
					</text>
				</g>
			</g>
			<g className="g-node" style={{ animationDelay: '.6s' }} transform="translate(180,155)">
				<g className="g-node-inner" style={{ animationDelay: '.6s' }}>
					<circle r="26" />
					<text textAnchor="middle" dy="4">
						{labels.location}
					</text>
				</g>
			</g>
			<g className="g-node" style={{ animationDelay: '.75s' }} transform="translate(620,155)">
				<g className="g-node-inner" style={{ animationDelay: '.75s' }}>
					<circle r="26" />
					<text textAnchor="middle" dy="4">
						{labels.service}
					</text>
				</g>
			</g>
		</svg>
	);
}

export function GeoAeoWorkGuideModal({
	open,
	onClose,
	report,
}: {
	open: boolean;
	onClose: () => void;
	/** Currently diagnosed audit — every guide string binds to its live brand/industry/NAP data. */
	report: AuditReport | null;
}) {
	const t = useTranslations('audit.share');
	const [mounted, setMounted] = useState(false);
	const [graphKey, setGraphKey] = useState(0);
	const [doneIds, setDoneIds] = useState<string[]>([]);
	const [theme, setTheme] = useState<GuideTheme>('dark');

	const model = useMemo(() => (report ? resolveGeoWorkGuideModel(report, 'ko') : null), [report]);

	useEffect(() => {
		setMounted(true);
		setTheme(readStoredGuideTheme());
	}, []);

	useLayoutEffect(() => {
		if (!open) return;
		setGraphKey((key) => key + 1);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		ensureGuideFonts();

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [open, onClose]);

	if (!mounted || !model) return null;

	const doneCount = doneIds.length;
	const total = model.checklistItems.length;

	function toggleCheck(id: string) {
		setDoneIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
	}

	function applyTheme(next: GuideTheme) {
		setTheme(next);
		try {
			window.localStorage.setItem(GUIDE_THEME_KEY, next);
		} catch {
			/* private mode / blocked storage */
		}
	}

	return createPortal(
		<div
			id="geoGuideModal"
			className={`geo-guide-modal-root print:hidden${open ? ' open' : ''}`}
			role="dialog"
			aria-modal="true"
			aria-hidden={open ? 'false' : 'true'}
			aria-labelledby="geo-guide-modal-title"
			onClick={onClose}
		>
			<div className="geo-guide-modal-panel" onClick={(event) => event.stopPropagation()}>
				<div className="geo-guide-modal-wrap" data-theme={theme}>
					<div className="geo-guide-toolbar">
						<div className="theme-switch-group" role="group" aria-label="가이드 테마">
							<button
								type="button"
								className={`theme-btn${theme === 'light' ? ' active' : ''}`}
								data-theme-target="light"
								aria-pressed={theme === 'light'}
								onClick={() => applyTheme('light')}
							>
								☀️ 밝은톤
							</button>
							<button
								type="button"
								className={`theme-btn${theme === 'dark' ? ' active' : ''}`}
								data-theme-target="dark"
								aria-pressed={theme === 'dark'}
								onClick={() => applyTheme('dark')}
							>
								🌙 어두운톤
							</button>
						</div>
						<button
							type="button"
							className="geo-guide-modal-close"
							onClick={onClose}
							aria-label={t('geoAeoGuideClose')}
						>
							×
						</button>
					</div>
					<div className="wrap">
						<section className="hero" style={{ borderBottom: 'none', paddingBottom: 0 }}>
							<div className="hero-kicker">GEO / AEO WORKING GUIDE</div>
							<h1 id="geo-guide-modal-title">
								생성형 AI 검색엔진, {withKoreanParticle(model.brandName, '을/를')} 어떻게 인용하는가
							</h1>
							<p className="hero-sub">
								6대 AI 검색엔진은 각기 다른 크롤러와 지식 그래프를 기준으로 인용 여부를 판단합니다. {model.brandName}{' '}
								실측 데이터를 바탕으로, 온페이지 기술 구축과 외부 데이터 동기화를 함께 진행하기 위한 표준 작업
								가이드입니다.
							</p>
							<div className="hero-meta">
								<span>
									대상 <b>Gemini · ChatGPT · Perplexity · Claude · Copilot · Clova</b>
								</span>
								<span>
									기준 데이터 <b>{model.brandName} 실측</b>
								</span>
							</div>
							<div className="graph-holder">
								{open ? <EntityGraph playKey={graphKey} labels={model.entityLabels} /> : null}
							</div>
						</section>

						<section>
							<div className="part-label">01 — 인용 메커니즘</div>
							<h2>6대 AI 엔진별 인용 기준</h2>
							<p className="section-intro">
								엔진마다 참조하는 인덱스와 채택 기준이 다르므로, 한 채널만 최적화해서는 전체 노출을 담보할 수 없습니다.
							</p>
							<div className="engine-grid">
								{model.engines.map((engine) => (
									<div key={engine.name} className="engine-card">
										<p className="engine-name">{engine.name}</p>
										<div className="engine-row">
											<span className="k">SOURCE</span>
											<span className="v">{engine.source}</span>
										</div>
										<div className="engine-row">
											<span className="k">CRITERIA</span>
											<span className="v">{engine.criteria}</span>
										</div>
										<div className="engine-row">
											<span className="k">ACTION</span>
											<span className="v">{engine.action}</span>
										</div>
									</div>
								))}
							</div>
						</section>

						<section>
							<div className="part-label">02 — 온페이지</div>
							<h2>온페이지 기술 표준화</h2>
							<p className="section-intro">
								공식 사이트(Official Site) 기준. 크롤러가 텍스트를 읽기 전에 엔티티를 기계 판독할 수 있어야 합니다.
							</p>
							<div className="stack">
								<div className="item">
									<div className="item-title">
										Title / Meta / H1
										<br />
										구성 예시
									</div>
									<div className="item-body">
										<p>
											{model.brandName}과 {model.mainService} 키워드를 Title / Meta Description / H1에 일관되게
											바인딩하면 크롤러와 AI가 동일한 엔티티로 식별합니다.
										</p>
										<span className="schema-line">Title — {model.titleExample}</span>
										<span className="schema-line">Meta Description — {model.metaExample}</span>
										<span className="schema-line">H1 — {model.h1Example}</span>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										완전체 구조화 데이터
										<br />
										(JSON-LD) 구축
									</div>
									<div className="item-body">
										<p>
											단일 페이지만 등록하지 않고, {model.schemaType}을 최상위에 둔 뒤 하위 페이지별로 스키마를
											분기합니다.
										</p>
										<span className="schema-line">
											메인 페이지 — {model.schemaType} · PostalAddress · GeoCoordinates · {model.personSchemaType} ·
											sameAs
										</span>
										<span className="schema-line">
											{model.mainService} 상세 페이지 — {model.detailSchemaType} · FAQPage (본문 문답과 100% 일치)
										</span>
										<pre className="code-block">{model.jsonLdSample}</pre>
										<p className="dim">sameAs에는 네이버 플레이스, 인스타그램, 유튜브, 블로그 등 공식 채널 URL을 연결합니다.</p>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										텍스트 엔티티 및
										<br />
										정보 밀도 재설계
									</div>
									<div className="item-body">
										<p>
											이벤트 가격표나 &quot;최고의 맞춤 {model.mainService}&quot; 같은 마케팅 문구는 AI가 답변 근거로
											채택하지 않습니다.
										</p>
										<p className="dim">
											핵심 서비스명({model.servicesLabel}), 세부 사양·구성 요소, 제공 절차를 객관적 서술문으로 기술해야
											Claude·ChatGPT의 텍스트 매칭 점수가 오릅니다.
										</p>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										AI 쿼리 매칭
										<br />
										FAQ 구조화 예시
									</div>
									<div className="item-body">
										<p>대화형 질의와 동일한 문장 구조의 Q/A를 FAQPage 스키마로 노출하면 AI 답변 채택률이 오릅니다.</p>
										<span className="schema-line">Q — {model.faq.question}</span>
										<span className="schema-line">A — {model.faq.answer}</span>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										모바일 접근성 및
										<br />
										SSR 보장
									</div>
									<div className="item-body">
										<p>Bingbot, GPTBot 등 AI 브라우징 봇은 무거운 자바스크립트 렌더링에 취약합니다.</p>
										<p className="dim">
											핵심 FAQ 텍스트와 {model.mainService} 정보는 클라이언트 사이드 스크립트 실행 없이 초기 HTML
											소스에 텍스트로 노출(SSR)되도록 구현합니다.
										</p>
									</div>
								</div>
							</div>
						</section>

						<section>
							<div className="part-label">03 — 로컬 인덱스</div>
							<h2>포털 로컬 인덱스 동기화</h2>
							<p className="section-intro">
								모든 검색 로봇은 비즈니스 실존성과 위치를 인증하기 위해 NAP(Name·Address·Phone) 일치율을 검증합니다.
							</p>
							{model.hasNap ? (
								<span className="schema-line">
									기준 NAP — {model.brandName}
									{model.address ? ` · ${model.address}` : ''}
									{model.phone ? ` · ${model.phone}` : ''}
								</span>
							) : null}
							<div className="stack">
								<div className="item">
									<div className="item-title">
										Bing Places
										<br />
										for Business
									</div>
									<div className="item-body">
										<span className="target-tag">TARGET · ChatGPT / Copilot</span>
										<p>
											ChatGPT 실측 미노출의 가장 주된 원인입니다. 사업자등록증 기준으로 {model.brandName}을 등록하고
											사이트 URL, 운영시간, {model.mainService} 항목을 입력합니다.
										</p>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										Google
										<br />
										비즈니스 프로필
									</div>
									<div className="item-body">
										<span className="target-tag">TARGET · Gemini</span>
										<p>
											카테고리를 &apos;{model.defaultCategory}&apos;로 설정하고, 서비스 항목에 {model.servicesLabel} 등
											세부 항목을 개별 등록합니다.
										</p>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										네이버
										<br />
										스마트플레이스
									</div>
									<div className="item-body">
										<span className="target-tag">TARGET · Clova</span>
										<p>
											상세 소개란에 핵심 강점({model.servicesLabel})을 빠짐없이 기재하고, 네이버 예약 및 톡톡 기능을
											활성화해 사용자 상호작용 지수를 확보합니다.
										</p>
									</div>
								</div>
							</div>
						</section>

						<section>
							<div className="part-label">04 — 외부 채널</div>
							<h2>분산 인용 풋프린트 확장</h2>
							<p className="section-intro">
								Perplexity가 {withKoreanParticle(model.brandName, '을/를')} 빠르게 인용하려면 공식 사이트 외 여러
								3rd Party 플랫폼에서 동일 엔티티 정보가 누적 감지되어야 합니다.
							</p>
							<div className="stack">
								<div className="item">
									<div className="item-title">
										업종별 평가 플랫폼
										<br />
										데이터 보강
									</div>
									<div className="item-body">
										<span className="target-tag">핵심 · Gemini</span>
										<p>
											Gemini는 로컬 추천 질의 시 {model.platformsLabel}의 텍스트 데이터를 핵심 출처로 참조합니다.
											{model.brandName} 상세 정보, 핵심 강점, {model.representativeTitle} 프로필을 빠짐없이 등록하고{' '}
											{model.mainService} 키워드가 포함된 리뷰가 누적되도록 유도합니다.
										</p>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										기업 신뢰도 및
										<br />
										공공 엔티티 구축
									</div>
									<div className="item-body">
										<p>
											사람인, 잡코리아 등 채용 플랫폼에 공식 사업자명과 {model.brandName} 소개가 등록되어 있으면
											LLM은 이를 실제 운영 중인 정상 법인·사업체로 강하게 판별합니다.
										</p>
										<p className="dim">
											보도자료 배포 시 {model.representativeTitle}의 대외 활동(강연, 수상, 세미나 등)을 &apos;
											{model.representativeTitle}명 + {model.brandName} + 지역명 + {model.mainService}명&apos;으로
											명시해 주요 포털 뉴스 탭에 남깁니다.
										</p>
									</div>
								</div>
								<div className="item">
									<div className="item-title">
										SNS 및
										<br />
										비디오 스키마 연동
									</div>
									<div className="item-body">
										<p>유튜브 채널 설명란과 영상 본문에 공식 도메인, 주소, {model.mainService} 항목을 기재합니다.</p>
										<p className="dim">
											공식 블로그와 인스타그램 프로필 링크를 공식 사이트와 상호 백링크로 연결해 하나의 견고한 지식 그래프
											클러스터를 만듭니다.
										</p>
									</div>
								</div>
							</div>
						</section>

						<section>
							<div className="part-label">05 — 실행</div>
							<div className="checklist-head">
								<h2 style={{ margin: 0 }}>현장 적용 체크리스트</h2>
								<span className="progress-text" id="progressText">
									{doneCount} / {total} 완료
								</span>
							</div>
							<div className="progress-track">
								<div
									className="progress-fill"
									id="progressFill"
									style={{ width: `${(doneCount / total) * 100}%` }}
								/>
							</div>
							<div id="checklist">
								{model.checklistItems.map((item) => {
									const done = doneIds.includes(item.id);
									return (
										<button
											key={item.id}
											type="button"
											className={`check-item${done ? ' done' : ''}`}
											data-id={item.id}
											aria-pressed={done}
											onClick={() => toggleCheck(item.id)}
										>
											<span className="box" aria-hidden>
												<svg viewBox="0 0 20 20">
													<path d="M4 10.5l4 4 8-9" />
												</svg>
											</span>
											<span className="check-copy">
												<span className="k">{item.kicker}</span>
												<span className="v">{item.copy}</span>
											</span>
										</button>
									);
								})}
							</div>
						</section>

						<footer>{model.brandName} GEO / AEO 실측 기반 표준 작업 가이드</footer>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}

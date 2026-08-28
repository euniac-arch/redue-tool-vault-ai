import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

/* [ARCHIVE] 기존 "GEO 최적화" 섹션 START ─────────────────────────────────
 * 아래 페이지 전체는 신규 "AEO · GEO" 메뉴/페이지(studio/app/aeo-geo/page.tsx)로
 * 대체되었습니다. 요청에 따라 기존 코드는 삭제하지 않고 그대로 보존합니다.
 * (GNB 링크 아카이브는 studio/components/Header.tsx 참고) */

export const metadata: Metadata = {
	title: 'GEO 최적화 | REDUE',
	description:
		'ChatGPT · Perplexity · Gemini 등 주요 생성형 AI가 사이트를 정확히 식별하고 공식 답변 출처(Source)로 채택하도록 SEO · GEO · Schema 구조를 정밀 최적화합니다.',
};

/* ─── Design tokens (라이트/다크 겸용 · 메인페이지 톤 참고) ─────────────────
 * `_BASE` 토큰은 배경/모서리만 담당하고 테두리·그림자는 항상 사용처에서 직접
 * 지정한다 — 동일 속성(border-color 등)에 두 개의 일반 유틸리티가 겹치면
 * Tailwind 출력 순서에 따라 승자가 갈릴 수 있어, 하이라이트 카드마다 매번
 * 전체 테두리 클래스를 새로 쓰는 편이 안전하다. */
const CARD_BASE = 'rounded-2xl bg-white dark:bg-[#0b1726]';
const CARD = `${CARD_BASE} border border-slate-200 shadow-sm dark:border-[#1f3a5a] dark:shadow-none`;
const CARD_HOVER =
	'transition-all duration-300 hover:border-cyan-400 hover:shadow-md dark:hover:border-[rgba(12,154,167,0.45)] dark:hover:shadow-none';
const GRADIENT_TEXT = 'bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] bg-clip-text text-transparent';
const KICKER =
	'inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-[#4fd1d9]';
const CTA_CLASS =
	'group relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(12,154,167,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_44px_-8px_rgba(12,154,167,0.6)] sm:px-7 sm:text-base';

function SectionKicker({ children }: { children: ReactNode }) {
	return (
		<span className={KICKER}>
			<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
			{children}
		</span>
	);
}

function WindowDots() {
	return (
		<div className="flex items-center gap-1.5" aria-hidden>
			<span className="h-2.5 w-2.5 rounded-full bg-[#EF4023]/80" />
			<span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
			<span className="h-2.5 w-2.5 rounded-full bg-[#10B981]/80" />
		</div>
	);
}

/* ─── ② Paradigm Shift data ──────────────────────────────────────────── */
const LEGACY_RESULTS = [
	{ label: 'A의원', badge: '광고', note: '클릭당 비용 과금 · 높은 이탈' },
	{ label: 'B의원 후기 블로그', badge: '광고', note: '협찬 후기 · 신뢰도 불명' },
];

const LEGACY_LINKS = [
	{ title: '청담 ○○피부과 후기 총정리', url: 'blog.naver.com › post › ...' },
	{ title: '강남 피부과 순위 TOP10 비교', url: 'tistory.com › review › ...' },
	{ title: '청담역 피부시술 잘하는곳 모음', url: 'cafe.naver.com › board › ...' },
];

/* ─── ③ 4-Step GEO Engine (Bento Grid) ───────────────────────────────── */
const BENTO_CARDS = [
	{
		no: '01',
		stage: '발견',
		label: 'Discoverability',
		tag: '[200 OK] /llms.txt',
		tagClass:
			'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
		title: 'AI 크롤러 전용 수집 통로 구축',
		bullets: [
			'/llms.txt 루트 인덱스 배포 및 robots.txt / Sitemap 동기화',
			'GPTBot, PerplexityBot, ClaudeBot 수집 누락(404) 원천 차단',
		],
	},
	{
		no: '02',
		stage: '이해',
		label: 'Semantic Structure',
		tag: '[JSON-LD] Schema.org',
		tagClass: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-[#0E89DB]/30 dark:bg-[#0E89DB]/10 dark:text-[#5fb8ef]',
		title: '공식 엔티티 식별 지식그래프',
		bullets: [
			'Organization, LocalBusiness, MedicalClinic 등 업종별 표준 Schema 주입',
			"단순 텍스트 사이트가 아닌 '신뢰할 수 있는 공식 기관'으로 인식",
		],
	},
	{
		no: '03',
		stage: '신뢰',
		label: 'Trust Signals',
		tag: '[E-E-A-T] Geo Sync',
		tagClass:
			'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-[#5565C7]/30 dark:bg-[#5565C7]/10 dark:text-[#a3aced]',
		title: '지도 & 로컬 데이터 정합성',
		bullets: [
			'대표자 프로필, 위경도 좌표(WGS84), 4대 지도 NAP 데이터 일치',
			'네이버 · 구글 · Bing 지식그래프 연계를 통한 로컬 추천 신호 확보',
		],
	},
	{
		no: '04',
		stage: '인용',
		label: 'Citation Ready',
		tag: '[FAQPage] Speakable',
		tagClass: 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-[#0C9AA7]/30 dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]',
		title: '대화형 정답 카드 1순위 인용',
		bullets: [
			'AI가 즉시 발췌 가능한 단문 FAQPage 마크업 및 Speakable 셀렉터 배치',
			'Perplexity · ChatGPT 상단 정답 카드 출처 링크 1순위 노출 유도',
		],
	},
] as const;

/* ─── ④ Core Advantage — 5대 처방 chips ──────────────────────────────── */
const PRESCRIPTION_CHIPS = ['엔티티', '스키마', '/llms.txt', 'FAQPage', 'E-E-A-T'] as const;

export default function GeoOptimizationPage() {
	return (
		<div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-hidden bg-slate-50 text-slate-900 transition-colors duration-300 -mt-10 -mb-10 pb-20 dark:bg-[#04101b] dark:text-slate-100">
			{/* Ambient glow */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
				<div className="absolute -top-32 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#5565C7]/10 to-[#0C9AA7]/10 blur-[110px] dark:from-[#5565C7]/15 dark:to-[#0C9AA7]/15" />
			</div>

			<main className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col gap-20 px-6 pt-16 sm:gap-28">
				{/* ① Hero Header */}
				<section className="flex flex-col items-center gap-6 text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] shadow-sm dark:border-[rgba(12,154,167,0.35)] dark:bg-[#0b1726] dark:shadow-[0_0_28px_-8px_rgba(12,154,167,0.65)]">
						<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
						<span className={GRADIENT_TEXT}>GEO OPTIMIZATION</span>
					</span>

					<h1 className="max-w-4xl text-3xl font-extrabold leading-[1.35] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl lg:leading-[1.3] dark:text-white">
						검색되는 회사를 넘어,
						<br />
						<span className={GRADIENT_TEXT}>AI가 1순위로 추천하는 회사로.</span>
					</h1>

					<p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
						ChatGPT · Perplexity · Gemini 등 주요 생성형 AI가 사이트를 정확히 식별하고 공식 답변 출처(Source)로
						채택하도록 SEO · GEO · Schema 구조를 정밀 최적화합니다.
					</p>

					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						<span aria-hidden>⚡</span>
						AI 검색 · 스키마 · 웹 성능 통합 진단
						<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
							➔
						</span>
					</Link>
				</section>

				{/* ② Paradigm Shift — Split Comparison Card */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-3 text-center">
						<SectionKicker>PARADIGM SHIFT</SectionKicker>
						<h2 className="max-w-2xl text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
							검색의 패러다임이 완전히 바뀌었습니다
						</h2>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						{/* Legacy Search */}
						<article className={`${CARD} flex flex-col gap-5 p-6 sm:p-7`}>
							<div className="flex items-center justify-between">
								<span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
									Legacy Search
								</span>
								<span className="text-[11px] font-semibold text-slate-500">키워드 매칭</span>
							</div>

							<div>
								<h3 className="text-base font-bold text-slate-900 dark:text-white">🔍 구글 검색창 목업</h3>
								<div className="mt-3 flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 dark:border-slate-700/70 dark:bg-[#04101b]">
									<span aria-hidden className="text-slate-400 dark:text-slate-500">
										🔍
									</span>
									<span className="text-sm text-slate-700 dark:text-slate-300">청담 피부과 추천</span>
								</div>
							</div>

							<div className="flex flex-col gap-2">
								{LEGACY_RESULTS.map((result) => (
									<div
										key={result.label}
										className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-[#04101b]/70"
									>
										<div className="flex items-center gap-2">
											<span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
												{result.badge}
											</span>
											<span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{result.label}</span>
										</div>
										<p className="mt-1 text-xs text-slate-500">{result.note}</p>
									</div>
								))}
							</div>

							<ul className="flex flex-col gap-2.5">
								{LEGACY_LINKS.map((link) => (
									<li key={link.title} className="border-b border-slate-200 pb-2 last:border-0 dark:border-slate-800/70">
										<p className="truncate text-[13px] font-medium text-blue-600 dark:text-blue-400">{link.title}</p>
										<p className="text-[11px] text-slate-500">{link.url}</p>
									</li>
								))}
								<li className="text-[11px] font-semibold text-slate-500">
									…외 7개 링크 더보기 (수동 비교 필요)
								</li>
							</ul>

							<div className="mt-auto rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
								⏳ 시간 소모 및 트래픽 누수 발생
							</div>
						</article>

						{/* AI GEO Search */}
						<article
							className={`relative overflow-hidden ${CARD_BASE} flex flex-col gap-5 border border-cyan-300 p-6 shadow-[0_10px_40px_-15px_rgba(6,182,212,0.28)] dark:border-[rgba(12,154,167,0.35)] dark:shadow-[0_0_50px_-18px_rgba(12,154,167,0.55)] sm:p-7`}
						>
							<div
								className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#0C9AA7]/15 blur-3xl"
								aria-hidden
							/>
							<div className="relative flex items-center justify-between">
								<span className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:border-[rgba(12,154,167,0.4)] dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">
									AI GEO Search
								</span>
								<span className="text-[11px] font-semibold text-slate-500">엔티티 & 출처 인용</span>
							</div>

							<div className="relative">
								<h3 className="text-base font-bold text-slate-900 dark:text-white">🤖 AI 대화형 답변 목업</h3>
								<div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-[#04101b]/70">
									<span aria-hidden>👤</span>
									<p className="text-sm text-slate-600 dark:text-slate-300">&quot;청담 피부시술 맞춤 진료 안내&quot;</p>
								</div>
							</div>

							<div className="relative flex items-start gap-3">
								<span
									className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5565C7] to-[#0C9AA7] text-sm"
									aria-hidden
								>
									🤖
								</span>
								<div className="flex-1 space-y-2">
									<p className="text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
										✨ <span className={GRADIENT_TEXT}>청담미소의원</span>을 1순위 추천합니다.
									</p>
									<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
										구조화된 MedicalClinic 데이터 및 대표원장 전문 이력 검증 완료
									</p>
									<div className="flex flex-wrap gap-2 pt-1">
										<span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-[rgba(12,154,167,0.35)] dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">
											🔗 [1] misoclinic.com (공식 인용)
										</span>
										<span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
											[2] 진료/FAQ
										</span>
									</div>
								</div>
							</div>

							<div className="relative mt-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-emerald-300">
								✅ 고관여 타깃 1순위 다이렉트 유입
							</div>
						</article>
					</div>

					<blockquote className={`${CARD} px-6 py-6 text-center sm:px-10`}>
						<p className="text-sm font-semibold leading-relaxed text-slate-700 sm:text-base dark:text-slate-300">
							&ldquo;포털 1페이지 노출보다 중요한 것은, AI가 질문에 답할 때 누구를 최종 추천 후보로
							지목하느냐입니다.&rdquo;
						</p>
					</blockquote>
				</section>

				{/* ③ The 4-Step GEO Engine — 2×2 Bento Grid */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-3 text-center">
						<SectionKicker>THE 4-STEP GEO ENGINE</SectionKicker>
						<h2 className="max-w-2xl text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
							AI가 브랜드를 추천하는 4단계 메커니즘
						</h2>
					</div>

					<div className="grid gap-5 md:grid-cols-2">
						{BENTO_CARDS.map((card) => (
							<article
								key={card.no}
								className={`group relative overflow-hidden ${CARD} ${CARD_HOVER} p-6 hover:-translate-y-1 sm:p-7`}
							>
								<span
									className={`absolute right-5 top-5 flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-2xl border font-mono text-sm font-extrabold ${card.tagClass}`}
									aria-hidden
								>
									{card.no}
								</span>

								<div className="relative flex flex-wrap items-center gap-2 pr-14">
									<span
										className={`rounded-md border px-2 py-1 font-mono text-[11px] font-bold ${card.tagClass}`}
									>
										{card.tag}
									</span>
									<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
										{card.stage} · {card.label}
									</span>
								</div>

								<h3 className="relative mt-4 text-lg font-bold leading-snug text-slate-900 dark:text-white">
									{card.title}
								</h3>

								<ul className="relative mt-3 flex flex-col gap-2">
									{card.bullets.map((bullet) => (
										<li key={bullet} className="flex items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
											<span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#0C9AA7]" aria-hidden />
											{bullet}
										</li>
									))}
								</ul>
							</article>
						))}
					</div>
				</section>

				{/* ④ Core Advantage — Terminal Style Box */}
				<section className="flex flex-col items-center gap-8">
					<div className="flex flex-col items-center gap-3 text-center">
						<SectionKicker>CORE ADVANTAGE</SectionKicker>
						<h2 className="max-w-2xl text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
							사이트 리뉴얼 제로, 단 1회의 온페이지 스크립트 주입
						</h2>
						<p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
							기존 소스코드 전면 재구축 없이, REDUE 경량 스키마 엔진 1회 연동만으로 5대 처방이 즉시
							활성화됩니다.
						</p>
					</div>

					<div className={`w-full max-w-3xl overflow-hidden ${CARD_BASE} border border-slate-200 shadow-lg dark:border-[#1f3a5a] dark:shadow-[0_24px_64px_-24px_rgba(0,0,0,0.65)]`}>
						<div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#1f3a5a] dark:bg-[#04101b]/70">
							<WindowDots />
							<span className="ml-3 text-[11px] font-semibold text-slate-500">head.sub.php</span>
						</div>
						<div className="p-5 sm:p-6">
							<p className="font-mono text-[12.5px] leading-relaxed text-slate-500 sm:text-[13px]">
								<span className="text-slate-400 dark:text-slate-600">// </span>테마 head.sub.php에 1줄 삽입으로
								엔티티·스키마· /llms.txt 즉시 활성화
							</p>
							<p className="mt-3 overflow-x-auto whitespace-pre font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
								<span className="text-slate-400 dark:text-slate-500">&lt;</span>
								<span className="text-[#0E89DB]">script</span>{' '}
								<span className="text-[#5565C7]">src</span>
								<span className="text-slate-400 dark:text-slate-500">=</span>
								<span className="text-[#0C9AA7]">
									&quot;https://engine.redue.kr/v30/universal.min.js&quot;
								</span>{' '}
								<span className="text-[#5565C7]">defer</span>
								<span className="text-slate-400 dark:text-slate-500">&gt;&lt;/</span>
								<span className="text-[#0E89DB]">script</span>
								<span className="text-slate-400 dark:text-slate-500">&gt;</span>
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center justify-center gap-2.5">
						{PRESCRIPTION_CHIPS.map((chip) => (
							<span
								key={chip}
								className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-slate-300 dark:shadow-none"
							>
								<span className="text-[#0C9AA7] dark:text-[#10B981]">✓</span>
								{chip}
							</span>
						))}
					</div>
				</section>

				{/* ⑤ Before & After — AI Chatbot Response Mockup */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-3 text-center">
						<SectionKicker>BEFORE & AFTER</SectionKicker>
						<h2 className="max-w-2xl text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
							AI 검색 답변 표출 시뮬레이션
						</h2>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						{/* BEFORE */}
						<article
							className={`flex flex-col gap-4 ${CARD_BASE} border border-rose-300 shadow-sm dark:border-[#EF4023]/40 dark:shadow-none p-6 sm:p-7`}
						>
							<div className="flex items-center gap-2">
								<span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:border-[#EF4023]/40 dark:bg-[#EF4023]/10 dark:text-[#ff7d68]">
									BEFORE
								</span>
								<span className="text-xs font-semibold text-slate-500">GEO 미적용</span>
							</div>

							<div className="flex flex-col gap-3">
								<div className="flex items-start justify-end gap-2">
									<div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-200 px-4 py-2.5 text-sm leading-relaxed text-slate-800 dark:bg-slate-800 dark:text-slate-200">
										청담 맞춤 피부시술 및 진료 시스템 안내해 줘
									</div>
									<span aria-hidden className="text-lg">
										👤
									</span>
								</div>
								<div className="flex items-start gap-2">
									<span aria-hidden className="text-lg">
										🤖
									</span>
									<div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-[#04101b] dark:text-slate-400">
										청담 지역에는 여러 피부과가 있으며, 주로 블로그 후기 및 포털 검색 상위 업체들이
										언급됩니다.
									</div>
								</div>
							</div>

							<div className="mt-auto rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-[#EF4023]/30 dark:bg-[#EF4023]/10 dark:text-[#ff7d68]">
								❌ 공식 출처 누락 · 타사 블로그로 트래픽 분산
							</div>
						</article>

						{/* AFTER */}
						<article
							className={`relative flex flex-col gap-4 overflow-hidden ${CARD_BASE} border border-cyan-400 shadow-[0_10px_44px_-14px_rgba(6,182,212,0.35)] dark:border-[#0C9AA7]/50 dark:shadow-[0_0_56px_-16px_rgba(12,154,167,0.6)] p-6 sm:p-7`}
						>
							<div
								className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#0C9AA7]/15 blur-3xl"
								aria-hidden
							/>
							<div className="relative flex items-center gap-2">
								<span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-[#10B981]/40 dark:bg-[#10B981]/10 dark:text-emerald-300">
									AFTER
								</span>
								<span className="text-xs font-semibold text-slate-500">REDUE 처방 적용</span>
							</div>

							<div className="relative flex flex-col gap-3">
								<div className="flex items-start justify-end gap-2">
									<div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-200 px-4 py-2.5 text-sm leading-relaxed text-slate-800 dark:bg-slate-800 dark:text-slate-200">
										청담 맞춤 피부시술 및 진료 시스템 안내해 줘
									</div>
									<span aria-hidden className="text-lg">
										👤
									</span>
								</div>
								<div className="flex items-start gap-2">
									<span
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5565C7] to-[#0C9AA7] text-sm"
										aria-hidden
									>
										🤖
									</span>
									<div className="flex-1 space-y-2 rounded-2xl rounded-tl-sm border border-cyan-200 bg-cyan-50/60 px-4 py-2.5 dark:border-[rgba(12,154,167,0.3)] dark:bg-[#04101b]">
										<p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
											<span className={GRADIENT_TEXT}>청담미소의원</span>을 추천합니다. 검증된 전문 진료
											시스템과 원장 이력, FAQ 기반 시술 가이드가 완비되어 있습니다.
										</p>
										<div className="flex flex-wrap gap-2 pt-1">
											<span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-[rgba(12,154,167,0.35)] dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">
												🔗 [1] 공식 홈페이지 (misoclinic.com)
											</span>
											<span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
												[2] 진료/FAQ 안내
											</span>
										</div>
									</div>
								</div>
							</div>

							<div className="relative mt-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-emerald-300">
								✓ 1순위 단독 지목 · 공식 사이트 다이렉트 인용
							</div>
						</article>
					</div>
				</section>

				{/* ⑥ Bottom Final CTA */}
				<section
					className={`${CARD} flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center sm:px-10`}
				>
					<h2 className="max-w-xl text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
						지금 귀사의 사이트는 AI에게 몇 점으로 평가받고 있을까요?
					</h2>
					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						<span aria-hidden>⚡</span>
						AI 검색 · 스키마 · 웹 성능 통합 진단
						<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
							➔
						</span>
					</Link>

					<div className="mt-8 w-full max-w-2xl space-y-1 border-t border-slate-200 px-3 pt-4 text-center max-sm:px-4 sm:px-2 dark:border-[#1f3a5a]">
						<p className="break-keep text-[11px] leading-relaxed text-slate-600 dark:text-slate-500">
							※ ChatGPT, Gemini, Perplexity, Claude, Copilot, Naver Cue: 등은 해당 기업의 등록 상표입니다.
						</p>
						<p className="break-keep text-[10.5px] leading-relaxed text-slate-400 dark:text-slate-600">
							※ AI 검색엔진의 인용 방식과 추천 결과는 각 플랫폼의 인덱싱 주기 및 자체 검색 알고리즘에 따라
							상이할 수 있으며, 특정 순위나 추천을 영구 보증하지 않습니다.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}
/* [ARCHIVE] 기존 "GEO 최적화" 섹션 END ─────────────────────────────────── */

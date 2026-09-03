'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

/* Extracted from studio/app/aeo-geo/page.tsx so the Insights hub can tab-switch. */

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
	{ label: 'A의원', badge: '광고', note: '클릭당 비용 과금 · 높은 이탈률' },
	{ label: 'B의원 후기 블로그', badge: '광고', note: '협찬성 리뷰 · 신뢰도 하락' },
];

const LEGACY_LINKS = [
	{ title: '청담 ○○피부과 후기 총정리', url: 'blog.naver.com › post › ...' },
	{ title: '강남 피부과 순위 TOP10 비교', url: 'tistory.com › review › ...' },
	{ title: '청담역 피부시술 잘하는곳 모음', url: 'cafe.naver.com › board › ...' },
];

/* ─── ③ 4-Step AEO & GEO Engine (Bento Grid) ─────────────────────────── */
const BENTO_CARDS = [
	{
		no: '01',
		stage: '발견',
		label: 'Discoverability',
		tag: '[200 OK] /llms.txt',
		tagClass:
			'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
		title: 'AI 크롤러 전용 인덱스 수집 통로 구축',
		bullets: [
			'/llms.txt 루트 인덱스 배포 및 robots.txt / Sitemap 동기화',
			'GPTBot, PerplexityBot, ClaudeBot의 크롤링 누락(404)을 원천 차단하고 사이트 핵심 정보를 즉시 전달',
		],
	},
	{
		no: '02',
		stage: '이해',
		label: 'Semantic Structure',
		tag: '[JSON-LD] Schema.org',
		tagClass: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-[#0E89DB]/30 dark:bg-[#0E89DB]/10 dark:text-[#5fb8ef]',
		title: '공식 엔티티 식별 및 지식그래프 구축',
		bullets: [
			'Organization, LocalBusiness, MedicalClinic 등 업종별 표준 시맨틱 Schema 주입',
			"AI가 단순 텍스트 웹페이지가 아닌 '공인된 실체(Entity)'로 해석",
		],
	},
	{
		no: '03',
		stage: '신뢰',
		label: 'Trust Signals',
		tag: '[E-E-A-T] Geo Sync',
		tagClass:
			'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-[#5565C7]/30 dark:bg-[#5565C7]/10 dark:text-[#a3aced]',
		title: '지도 & 공신력 메타데이터 정합성 동기화',
		bullets: [
			'대표자 공인 프로필, 위경도 좌표(WGS84), 4대 포털 지도 NAP(Name/Address/Phone) 데이터 일치',
			'네이버 · 구글 · Bing 지식그래프 연계를 통한 최상위 신뢰도 확보',
		],
	},
	{
		no: '04',
		stage: '인용',
		label: 'Answer Engine Citation (AEO)',
		tag: '[AEO Ready] FAQPage & Speakable',
		tagClass: 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-[#0C9AA7]/30 dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]',
		title: '질문-답변(Q&A) 구조화 및 1순위 다이렉트 앤서 채택',
		bullets: [
			'AI 답변 엔진(Perplexity, ChatGPT Search, AI Overview)이 즉각 발췌 가능한 단문 정답형 FAQPage 마크업 및 Speakable 셀렉터 배치',
			'AI 대화 상단 정답 카드 출처 링크를 독점 유도',
		],
	},
] as const;

export function AeoGeoGuideContent() {
	return (
		<div id="aeo-geo" className="relative overflow-x-hidden bg-transparent text-slate-900 transition-colors duration-300 dark:text-zinc-100">
			<main className="relative flex w-full flex-col gap-20 bg-transparent sm:gap-28">
				{/* ① Hero Header */}
				<section className="flex flex-col items-center gap-6 bg-transparent text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] dark:border-[#1f3a5a] dark:bg-[#0b1726]">
						<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
						<span className={GRADIENT_TEXT}>AI ANSWER &amp; GENERATIVE ENGINE OPTIMIZATION</span>
					</span>

					<h1 className="max-w-4xl break-keep text-balance text-3xl font-extrabold leading-[1.35] tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl lg:leading-[1.3] dark:text-zinc-100">
						검색되는 회사를 넘어,
						<br />
						AI가 <span className={GRADIENT_TEXT}>&apos;정답&apos;</span>으로 답변하고{' '}
						<span className={GRADIENT_TEXT}>&apos;1순위&apos;</span>로 추천하는 회사로.
					</h1>

					<p className="max-w-2xl break-keep text-pretty text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
						ChatGPT · Perplexity · Gemini · Claude 등 주요 생성형 AI와 답변 엔진이 사이트를 정확히 식별하고
						공식 정답 출처(Source)로 채택하도록 SEO · AEO · GEO · Schema 구조를 정밀 최적화합니다.
					</p>

					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						<span aria-hidden>⚡</span>
						AI 검색 · AEO/GEO · 스키마 통합 진단
						<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
							➔
						</span>
					</Link>
				</section>

				{/* ② Paradigm Shift — Split Comparison Card */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-3 text-center">
						<SectionKicker>PARADIGM SHIFT</SectionKicker>
						<h2 className="max-w-2xl break-keep text-balance text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
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
								<span className="break-keep text-[11px] font-semibold text-slate-500">키워드 랭킹 & 링크 나열</span>
							</div>

							<div>
								<h3 className="break-keep text-base font-bold text-slate-900 dark:text-white">🔍 포털 검색창 목업</h3>
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
										<p className="mt-1 break-keep text-xs text-slate-500">{result.note}</p>
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
								<li className="break-keep text-[11px] font-semibold text-slate-500">
									…외 7개 링크 더보기 (수동 탐색 및 비교 피로)
								</li>
							</ul>

							<div className="mt-auto break-keep rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
								⏳ 시간 소모 · 클릭 분산 · 트래픽 누수 발생
							</div>
						</article>

						{/* AI AEO · GEO Search */}
						<article
							className={`relative overflow-hidden ${CARD_BASE} flex flex-col gap-5 border border-cyan-300 p-6 shadow-[0_10px_40px_-15px_rgba(6,182,212,0.28)] dark:border-[rgba(12,154,167,0.35)] dark:shadow-[0_0_50px_-18px_rgba(12,154,167,0.55)] sm:p-7`}
						>
							<div
								className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#0C9AA7]/15 blur-3xl"
								aria-hidden
							/>
							<div className="relative flex items-center justify-between">
								<span className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:border-[rgba(12,154,167,0.4)] dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">
									AI AEO · GEO Search
								</span>
								<span className="break-keep text-[11px] font-semibold text-slate-500">다이렉트 답변 & 엔티티 추천</span>
							</div>

							<div className="relative">
								<h3 className="break-keep text-base font-bold text-slate-900 dark:text-white">🤖 생성형 AI 대화창 목업</h3>
								<div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-[#04101b]/70">
									<span aria-hidden>👤</span>
									<p className="break-keep text-pretty text-sm text-slate-600 dark:text-slate-300">
										&quot;청담 피부시술 맞춤 진료 시스템과 진료 시간 안내해 줘&quot;
									</p>
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
									<p className="break-keep text-pretty text-sm font-semibold leading-relaxed text-slate-900 dark:text-white">
										✨ <span className={GRADIENT_TEXT}>청담미소의원</span>을 1순위 정답 및 추천 기관으로
										안내합니다.
									</p>
									<p className="break-keep text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-300">
										구조화된 MedicalClinic 엔티티 데이터, FAQPage 기반 실시간 진료 정보 및 대표원장 전문 이력
										검증 완료.
									</p>
									<div className="flex flex-wrap gap-2 pt-1">
										<span className="inline-flex items-center gap-1 break-keep rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-[rgba(12,154,167,0.35)] dark:bg-[#0C9AA7]/10 dark:text-[#5fdbe3]">
											🔗 [1] misoclinic.com (공식 인용)
										</span>
										<span className="inline-flex items-center gap-1 break-keep rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
											[2] 맞춤진료/FAQ 안내
										</span>
									</div>
								</div>
							</div>

							<div className="relative mt-auto break-keep rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-emerald-300">
								✅ 사용자 질문에 대한 다이렉트 정답 채택 & 고관여 타깃 1순위 직유입
							</div>
						</article>
					</div>

					<blockquote className={`${CARD} px-6 py-6 text-center sm:px-10`}>
						<p className="break-keep text-pretty text-sm font-semibold leading-relaxed text-slate-700 sm:text-base dark:text-slate-300">
							&ldquo;포털 1페이지 링크 노출보다 중요한 것은, AI가 사용자의 질문에 답할 때 누구를 최종 정답
							출처로 인용하느냐입니다.&rdquo;
						</p>
					</blockquote>
				</section>

				{/* ③ The 4-Step AEO & GEO Engine — 2×2 Bento Grid */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-3 text-center">
						<SectionKicker>THE 4-STEP AEO &amp; GEO ENGINE</SectionKicker>
						<h2 className="max-w-2xl break-keep text-balance text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
							AI가 브랜드를 학습하고 정답으로 인용하는 4단계 메커니즘
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
									<span className="break-keep text-[11px] font-semibold uppercase tracking-wider text-slate-500">
										{card.stage} · {card.label}
									</span>
								</div>

								<h3 className="relative mt-4 break-keep text-balance text-lg font-bold leading-snug text-slate-900 dark:text-white">
									{card.title}
								</h3>

								<ul className="relative mt-3 flex flex-col gap-2">
									{card.bullets.map((bullet) => (
										<li key={bullet} className="flex items-start gap-2 break-keep text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-400">
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
						<h2 className="max-w-2xl break-keep text-balance text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
							사이트 리뉴얼 제로, 단 1회의 온페이지 스크립트 주입
						</h2>
						<p className="max-w-2xl break-keep text-pretty text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
							기존 소스코드의 전면 재구축 없이, REDUE 초경량 스키마 엔진 1회 연동만으로 AEO / GEO 핵심 처방이
							즉시 활성화됩니다.
						</p>
					</div>

					<div className={`w-full max-w-3xl overflow-hidden ${CARD_BASE} border border-slate-200 shadow-lg dark:border-[#1f3a5a] dark:shadow-[0_24px_64px_-24px_rgba(0,0,0,0.65)]`}>
						<div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#1f3a5a] dark:bg-[#04101b]/70">
							<WindowDots />
							<span className="ml-3 text-[11px] font-semibold text-slate-500">head.sub.php</span>
						</div>
						<div className="p-5 sm:p-6">
							<p className="break-keep text-pretty font-mono text-[12.5px] leading-relaxed text-slate-500 sm:text-[13px]">
								<span className="text-slate-400 dark:text-slate-600">// </span>테마 head.sub.php 또는 &lt;head&gt;에
								1줄 삽입으로 엔티티·스키마·/llms.txt·AEO 즉시 활성화
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
				</section>

				{/* ⑤ Bottom Final CTA */}
				<section
					className={`${CARD} flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center sm:px-10`}
				>
					<h2 className="max-w-xl break-keep text-balance text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
						지금 귀사의 사이트는 AI에게 &apos;정답&apos;으로 인용되고 있을까요?
					</h2>
					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						<span aria-hidden>⚡</span>
						AI 검색 · AEO/GEO · 스키마 통합 진단
						<span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
							➔
						</span>
					</Link>

					<div className="mt-8 w-full max-w-2xl space-y-1 border-t border-slate-200 px-3 pt-4 text-center max-sm:px-4 sm:px-2 dark:border-[#1f3a5a]">
						<p className="break-keep text-pretty text-[11px] leading-relaxed text-slate-600 dark:text-slate-500">
							※ ChatGPT, Gemini, Perplexity, Claude, Copilot, Naver Cue: 등은 해당 기업의 등록 상표입니다.
						</p>
						<p className="break-keep text-pretty text-[10.5px] leading-relaxed text-slate-400 dark:text-slate-600">
							※ AI 검색엔진 및 답변 엔진의 인용 방식과 추천 결과는 각 플랫폼의 인덱싱 주기 및 자체 검색
							알고리즘에 따라 상이할 수 있으며, 특정 순위나 추천을 영구 보증하지 않습니다.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}

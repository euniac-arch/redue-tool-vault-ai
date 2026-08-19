import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
	title: 'GEO 최적화 | REDUE',
	description:
		'ChatGPT · Gemini · Perplexity 등 생성형 AI가 우리 사이트를 발견하고, 이해하고, 신뢰하고, 인용할 수 있도록 SEO · GEO · Schema 구조를 정밀하게 최적화합니다.',
};

const GEO_PILLARS = [
	{
		step: '①',
		stage: '발견',
		title: 'AI 검색 노출 구조 분석',
		label: 'Discoverability',
		description:
			'robots.txt, Sitemap, Canonical 등 시맨틱 수집 규약을 정비하여 주요 AI 크롤러와 검색엔진의 기술적 접근성을 확보합니다.',
	},
	{
		step: '②',
		stage: '이해',
		title: 'Semantic & Schema 구조화',
		label: 'Semantic Structure',
		description:
			'Organization, LocalBusiness, Product, Service, FAQ 등 업종별 표준 구조화 데이터를 주입하여 AI 엔진이 기업 정보와 서비스 맥락을 정확히 파싱하도록 지원합니다.',
	},
	{
		step: '③',
		stage: '신뢰',
		title: 'E-E-A-T & AI 친화 콘텐츠',
		label: 'Trust Signals',
		description:
			'저자·발행자 프로필, E-E-A-T 신호, 공인 데이터 출처를 구조화하여 AI가 신뢰할 수 있는 공식 정보원(Grounding Source)으로 식별하도록 만듭니다.',
	},
	{
		step: '④',
		stage: '인용',
		title: 'AI 인용 친화 구조 최적화',
		label: 'Citation Ready',
		description:
			'Direct Answer 구조, 요약문, FAQ 포맷을 배치하여 AI 검색 답변 생성 시 신뢰도 높은 공식 출처(Source)로 인용되도록 최적화합니다.',
	},
] as const;

const GEO_BENEFITS = [
	{
		icon: '🤖',
		title: 'AI 추천 가능성 향상',
		description: '주요 생성형 AI 검색 답변 내 출처/인용 대상 선정 유도',
	},
	{
		icon: '🔎',
		title: '검색 노출 경쟁력 강화',
		description: '온페이지 기술 최적화와 시맨틱 태그 결합을 통한 기본 SEO 강화',
	},
	{
		icon: '🧠',
		title: '브랜드 신뢰 신호 강화',
		description: 'E-E-A-T 지표 및 엔티티(Entity) 데이터 명확화',
	},
	{
		icon: '📈',
		title: '신규 유입 채널 확보',
		description: '기존 검색엔진을 넘어 AI 추천을 통한 고품질 타겟 방문자 유입',
	},
] as const;

type FlowStep = {
	icon: string;
	title: string;
	description: string;
	tag: string;
};

const LEGACY_SEARCH_STEPS: readonly FlowStep[] = [
	{
		icon: '🔍',
		title: '키워드 검색',
		description: '사용자가 직접 키워드 입력',
		tag: '직접 입력',
	},
	{
		icon: '📄',
		title: '검색 결과 10개 노출',
		description: '광고 및 개별 링크 목록',
		tag: '광고 혼재',
	},
	{
		icon: '🖱️',
		title: '수많은 사이트 직접 방문',
		description: '일일이 클릭하며 정보 탐색',
		tag: '반복 클릭',
	},
	{
		icon: '⏳',
		title: '직접 정보 비교 및 판단',
		description: '시간 소모 및 이탈 발생',
		tag: '시간 소모',
	},
];

const AI_SEARCH_STEPS: readonly FlowStep[] = [
	{
		icon: '💬',
		title: '자연어 질문 입력',
		description: '사용자의 구체적 의도 질문',
		tag: '의도 파악',
	},
	{
		icon: '🤖',
		title: 'AI 수많은 정보 종합 분석',
		description: '웹 전체 데이터 실시간 파악',
		tag: '실시간 분석',
	},
	{
		icon: '🌟',
		title: '신뢰 브랜드 선택 & 출처 인용',
		description: '구조화 데이터 및 출처 신뢰도가 검증된 브랜드 인용 채택',
		tag: '출처 검증',
	},
	{
		icon: '🚀',
		title: '공식 인용 링크를 통한 고관여 타깃 유입 지원',
		description: '답변 내 공식 출처 링크를 통한 탐색 유입',
		tag: '유입 지원',
	},
];

const GLASS_CARD =
	'bg-white backdrop-blur-sm border border-slate-200 rounded-2xl p-6 hover:border-cyan-500/40 hover:bg-slate-50 transition-all duration-200 dark:bg-[#0B1120]/80 dark:border-slate-800/80 dark:hover:bg-[#0E162B]';
const GLASS_BADGE =
	'bg-slate-100 border border-slate-200 text-cyan-700 dark:bg-slate-900 dark:border-slate-800 dark:text-cyan-400';
const CTA_CLASS =
	'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition hover:-translate-y-0.5 hover:from-cyan-400 hover:to-blue-500 sm:text-base';

function FlowCard({
	badge,
	title,
	steps,
	accent,
	outcome,
}: {
	badge: string;
	title: string;
	steps: readonly FlowStep[];
	accent: 'slate' | 'cyan';
	outcome: string;
}) {
	const isAccent = accent === 'cyan';

	return (
		<article
			className={`flex h-full flex-col ${GLASS_CARD} sm:p-7 ${
				isAccent ? 'border-cyan-500/30 hover:border-cyan-400/50' : ''
			}`}
		>
			<div className="mb-6 flex min-h-[5.25rem] flex-col gap-2.5">
				<span
					className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
						isAccent ? GLASS_BADGE : 'border border-slate-800 bg-slate-900 text-slate-400'
					}`}
				>
					{badge}
				</span>
				<h3 className="text-lg font-bold leading-snug text-slate-900 dark:text-white">{title}</h3>
			</div>

			<ol className="flex flex-1 flex-col">
				{steps.map((step, index) => {
					const isLast = index === steps.length - 1;

					return (
						<li key={step.title} className="flex min-h-[4.75rem] flex-1 gap-3">
							<div className="flex w-8 shrink-0 flex-col items-center">
								<span
									className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
										isAccent
											? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40'
											: 'border border-slate-800 bg-slate-900 text-slate-400'
									}`}
								>
									{index + 1}
								</span>
								{isLast ? null : (
									<div
										className={`mt-1 w-px flex-1 ${
											isAccent ? 'bg-cyan-500/40' : 'bg-slate-800'
										}`}
										aria-hidden
									/>
								)}
							</div>
							<div className={`flex min-w-0 flex-1 flex-col ${isLast ? 'pb-1' : 'pb-5'}`}>
								<div className="flex items-start justify-between gap-2">
									<p className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
										<span aria-hidden>{step.icon}</span>
										{step.title}
									</p>
									<span
										className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
											isAccent ? GLASS_BADGE : 'border border-slate-800 bg-slate-900 text-slate-400'
										}`}
									>
										{step.tag}
									</span>
								</div>
								<p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">{step.description}</p>
							</div>
						</li>
					);
				})}
			</ol>

			<div
				className={`mt-5 rounded-xl px-4 py-3 text-center text-xs font-semibold ${
					isAccent
						? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
						: 'border border-slate-800 bg-slate-900 text-slate-400'
				}`}
			>
				{outcome}
			</div>
		</article>
	);
}

export default function GeoOptimizationPage() {
	return (
		<div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-hidden text-slate-900 transition-colors duration-300 -mt-10 -mb-10 pb-16 dark:text-slate-100">
			<main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 pb-4 pt-16 sm:gap-20 sm:px-8">
				{/* ① Hero */}
				<section className="flex flex-col items-center gap-6 text-center">
					<span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${GLASS_BADGE}`}>
						GEO OPTIMIZATION
					</span>
					<h1 className="max-w-3xl text-3xl font-extrabold leading-snug tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
						검색되는 회사를 넘어,
						<br />
						<span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
							AI가 추천하는 회사로.
						</span>
					</h1>
					<p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300/80">
						ChatGPT · Gemini · Perplexity 등 생성형 AI가 우리 사이트를 발견하고, 이해하고, 신뢰하고, 인용할 수
						있도록 SEO · GEO · Schema 구조를 정밀하게 최적화합니다.
					</p>
					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						🚀 내 사이트 GEO 진단하기
					</Link>
				</section>

				{/* ② WHY GEO? */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col gap-2 text-center">
						<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
							검색의 방식이 바뀌고 있습니다
						</h2>
					</div>
					<div className="grid items-stretch gap-5 lg:grid-cols-2">
						<FlowCard
							badge="기존 검색"
							title="사용자가 직접 찾고 비교"
							steps={LEGACY_SEARCH_STEPS}
							accent="slate"
							outcome="결과 · 시간 소모와 이탈"
						/>
						<FlowCard
							badge="AI 검색"
							title="AI가 신뢰할 수 있는 브랜드를 선별·추천"
							steps={AI_SEARCH_STEPS}
							accent="cyan"
							outcome="결과 · 오가닉 탐색 유입 다변화"
						/>
					</div>
					<blockquote className={`${GLASS_CARD} px-6 py-5 text-center sm:px-10`}>
						<p className="text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300/80 sm:text-base">
							“이제 중요한 것은 단순히 검색 결과에 노출되는 것이 아니라, AI가 우리 회사를 이해하고 신뢰하여
							답변의 근거로 인용하는가입니다.”
						</p>
					</blockquote>
				</section>

				{/* ③ GEO 핵심 4대 요소 */}
				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-2 text-center">
						<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
							AI가 우리 사이트를 추천하기 위한 4가지 조건
						</h2>
						<p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300/80 sm:text-base">
							REDUE는 단순 키워드 작성이 아닌 AI가 사이트를 발견하고 → 이해하고 → 신뢰하고 → 인용하는 연계
							구조를 구축합니다.
						</p>
					</div>
					<div className="grid gap-5 sm:grid-cols-2">
						{GEO_PILLARS.map((pillar) => (
							<article
								key={pillar.stage}
								className={`group flex flex-col gap-3 ${GLASS_CARD}`}
							>
								<div className="flex items-center gap-3">
									<span className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-extrabold ${GLASS_BADGE}`}>
										{pillar.step}
									</span>
									<div className="flex flex-col">
										<span className="text-[11px] font-bold uppercase tracking-wide text-cyan-400">
											{pillar.stage} · {pillar.label}
										</span>
										<h3 className="text-base font-bold text-slate-900 dark:text-white">{pillar.title}</h3>
									</div>
								</div>
								<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">{pillar.description}</p>
							</article>
						))}
					</div>
				</section>

				{/* ④ Key Benefits */}
				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-2 text-center">
						<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
							GEO 최적화로 달라지는 4가지 핵심 가치
						</h2>
					</div>
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{GEO_BENEFITS.map((benefit) => (
							<article
								key={benefit.title}
								className={`flex flex-col gap-3 ${GLASS_CARD} p-5`}
							>
								<span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${GLASS_BADGE}`} aria-hidden>
									{benefit.icon}
								</span>
								<h3 className="text-sm font-bold text-slate-900 dark:text-white">{benefit.title}</h3>
								<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">{benefit.description}</p>
							</article>
						))}
					</div>
				</section>

				{/* ⑤ REDUE 차별화 기술 — 경량 스크립트 온페이지 보정 */}
				<section className={`overflow-hidden ${GLASS_CARD} sm:p-8`}>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
						<div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${GLASS_BADGE}`}>
							🤖
						</div>
						<div className="flex flex-col gap-2">
							<span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${GLASS_BADGE}`}>
								REDUE 차별화 기술
							</span>
							<h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
								경량 스크립트 온페이지 동적 보정
							</h2>
							<p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300/80 sm:text-base">
								사이트 소스코드 전면 수정 없이 경량 스크립트 연동을 통해 누락된 메타데이터 및 스키마 구조를 동적으로 보정·주입하는 효율적인 온페이지 솔루션을 제공합니다.
							</p>
						</div>
					</div>
				</section>

				{/* ⑥ 주요 AI 검색 엔진 노출 예시 */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-2 text-center">
						<span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${GLASS_BADGE}`}>
							[Before vs After]
						</span>
						<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">주요 AI 검색 엔진 노출 예시</h2>
						<p className="text-sm text-slate-600 sm:text-base dark:text-slate-300/80">
							GEO 최적화 적용 전후, AI 답변 화면에 내 브랜드가 어떻게 표출되는지 비교해 보세요.
						</p>
					</div>

					<div className="relative grid gap-6 lg:grid-cols-2">
						{/* 적용 전 (Before) */}
						<div className={`relative overflow-hidden ${GLASS_CARD}`}>
							<div className="mb-4 flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
									Before
								</span>
								<span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
									⚠️ 최적화 전 (비브랜드 일반 텍스트)
								</span>
							</div>
							<div className="mb-5 flex items-center gap-1.5">
								<span className="h-3 w-3 rounded-full bg-red-500/70" />
								<span className="h-3 w-3 rounded-full bg-yellow-500/70" />
								<span className="h-3 w-3 rounded-full bg-green-500/70" />
								<span className="ml-2 text-xs font-semibold text-slate-500">Perplexity · 적용 전</span>
							</div>
							<div className="flex items-start gap-3 opacity-60">
								<span className="mt-0.5 text-xl" aria-hidden>
									⚠️
								</span>
								<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
									해당 분야 관련 공식 브랜드 정보나 명확한 출처 링크가 누락된 일반 요약 텍스트만 표출됩니다.
								</p>
							</div>
							<div className="mt-5 space-y-2 opacity-40">
								<div className="h-2.5 w-full rounded bg-slate-200 dark:bg-slate-700" />
								<div className="h-2.5 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
								<div className="h-2.5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
							</div>
						</div>

						{/* 적용 후 (After) */}
						<div className={`relative overflow-hidden ${GLASS_CARD} border-cyan-500/30 hover:border-cyan-400/50`}>
							<div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />
							<div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-500/15 blur-3xl" />
							<div className="relative mb-4 flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
									After
								</span>
								<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
									✅ 최적화 후 (공식 출처 인용)
								</span>
							</div>
							<div className="relative mb-5 flex items-center gap-1.5">
								<span className="h-3 w-3 rounded-full bg-red-500/70" />
								<span className="h-3 w-3 rounded-full bg-yellow-500/70" />
								<span className="h-3 w-3 rounded-full bg-green-500/70" />
								<span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">ChatGPT Search · 적용 후</span>
							</div>
							<div className="relative flex items-start gap-3">
								<span className="mt-0.5 text-xl" aria-hidden>
									✅
								</span>
								<div className="flex-1">
									<span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${GLASS_BADGE}`}>
										시뮬레이션 예시
									</span>
									<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">
										AI 답변 내에 귀사 공식 브랜드 명세와 주요 Q&A가 함께 인용되며, 공식 웹사이트로 연결되는
										출처(Source) 링크가 정상 표출됩니다. (시뮬레이션 예시)
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<span className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-400">
											[1] 공식 홈페이지
										</span>
										<span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300">
											[2] FAQ
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* ⑦ Closing CTA */}
				<section className={`${GLASS_CARD} flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center sm:px-10`}>
					<h2 className="max-w-xl text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
						우리 사이트는 AI에게 어떻게 평가되고 있을까요?
					</h2>
					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						10초 정밀 GEO 진단 시작하기 →
					</Link>
					<div className="mt-8 w-full max-w-2xl space-y-1 border-t border-slate-800/80 px-3 pt-4 text-center max-sm:px-4 sm:px-2">
						<p className="break-keep text-[11px] leading-relaxed text-slate-500">
							※ ChatGPT, Gemini, Perplexity, Claude, Copilot, Naver Cue: 등은 해당 기업의 등록 상표입니다.
						</p>
						<p className="break-keep text-[10.5px] leading-relaxed text-slate-600">
							※ AI 검색엔진의 인용 방식과 추천 결과는 각 플랫폼의 인덱싱 주기 및 자체 검색 알고리즘에 따라 상이할
							수 있으며, 특정 순위나 추천을 영구 보증하지 않습니다.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}

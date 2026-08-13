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
			'사이트가 검색엔진과 AI 크롤러봇에 차단 없이 제대로 발견되고 수집될 수 있는 기술적 기반을 분석하고 최적화합니다. (robots.txt, Sitemap, Canonical, 크롤링 접근성)',
	},
	{
		step: '②',
		stage: '이해',
		title: 'Semantic & Schema 구조화',
		label: 'Semantic Structure',
		description:
			'Organization, LocalBusiness, Product, Article, FAQ 등 구조화 데이터를 주입해 AI가 페이지의 맥락과 의미를 오차 없이 이해하도록 합니다.',
	},
	{
		step: '③',
		stage: '신뢰',
		title: 'E-E-A-T & AI 친화 콘텐츠',
		label: 'Trust Signals',
		description:
			'저자 정보, 발행자 프로필, 전문성 및 근거 신호를 강화하여 AI 검색엔진이 신뢰할 수 있는 정보원(Source)으로 인지하게 만듭니다.',
	},
	{
		step: '④',
		stage: '인용',
		title: 'AI 인용 친화 구조 최적화',
		label: 'Citation Ready',
		description:
			'Direct Answer 구조, 요약문, 비교표, FAQ 서식을 배치하여 AI가 답변을 생성할 때 가장 먼저 인용 및 출처로 선택하도록 최적화합니다.',
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
		description: 'GEO 최적화된 브랜드 우선 채택',
		tag: 'GEO 우선',
	},
	{
		icon: '🚀',
		title: '추천 사이트로 정밀 유입',
		description: '답변 내 인용 링크 클릭',
		tag: '즉시 추천',
	},
];

const CTA_CLASS =
	'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#7C3AED] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#6366F1]/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#6366F1]/35 sm:text-base';

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
	accent: 'slate' | 'indigo';
	outcome: string;
}) {
	const isIndigo = accent === 'indigo';

	return (
		<article
			className={`flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${
				isIndigo
					? 'border-indigo-200 bg-indigo-50/50 shadow-[0_12px_40px_-16px_rgba(99,102,241,0.45)]'
					: 'border-slate-200 bg-slate-50 shadow-sm'
			}`}
		>
			<div className="mb-6 flex min-h-[5.25rem] flex-col gap-2.5">
				<span
					className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
						isIndigo
							? 'border border-indigo-200 bg-indigo-100/80 text-[#4F46E5]'
							: 'border border-slate-200 bg-slate-100 text-slate-500'
					}`}
				>
					{badge}
				</span>
				<h3
					className={`text-lg font-bold leading-snug ${
						isIndigo ? 'text-[#0F172A]' : 'text-slate-600'
					}`}
				>
					{title}
				</h3>
			</div>

			<ol className="flex flex-1 flex-col">
				{steps.map((step, index) => {
					const isLast = index === steps.length - 1;

					return (
						<li key={step.title} className="flex min-h-[4.75rem] flex-1 gap-3">
							<div className="flex w-8 shrink-0 flex-col items-center">
								<span
									className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
										isIndigo
											? 'bg-[#6366F1] text-white shadow-sm shadow-indigo-300/60'
											: 'bg-slate-200 text-slate-500'
									}`}
								>
									{index + 1}
								</span>
								{isLast ? null : (
									<div
										className={`mt-1 w-px flex-1 ${
											isIndigo ? 'bg-indigo-200' : 'bg-slate-200'
										}`}
										aria-hidden
									/>
								)}
							</div>
							<div className={`flex min-w-0 flex-1 flex-col ${isLast ? 'pb-1' : 'pb-5'}`}>
								<div className="flex items-start justify-between gap-2">
									<p
										className={`flex items-center gap-1.5 text-sm font-semibold leading-snug ${
											isIndigo ? 'text-slate-800' : 'text-slate-600'
										}`}
									>
										<span aria-hidden>{step.icon}</span>
										{step.title}
									</p>
									<span
										className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
											isIndigo
												? 'bg-indigo-100 text-indigo-600'
												: 'bg-slate-200/80 text-slate-500'
										}`}
									>
										{step.tag}
									</span>
								</div>
								<p
									className={`mt-1 text-xs leading-relaxed ${
										isIndigo ? 'text-slate-500' : 'text-slate-400'
									}`}
								>
									{step.description}
								</p>
							</div>
						</li>
					);
				})}
			</ol>

			<div
				className={`mt-5 rounded-xl px-4 py-3 text-center text-xs font-semibold ${
					isIndigo
						? 'border border-indigo-200/80 bg-white/70 text-indigo-700'
						: 'border border-slate-200 bg-white/60 text-slate-500'
				}`}
			>
				{outcome}
			</div>
		</article>
	);
}

export default function GeoOptimizationPage() {
	return (
		<div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-hidden bg-[#F8FAFC] -mt-10 -mb-10 pb-16">
			<main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 pb-4 pt-16 sm:gap-20 sm:px-8">
				{/* ① Hero */}
				<section className="flex flex-col items-center gap-6 text-center">
					<span className="w-fit rounded-full border border-[#6366F1]/20 bg-[#6366F1]/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#6366F1]">
						GEO OPTIMIZATION
					</span>
					<h1 className="max-w-3xl text-3xl font-extrabold leading-snug tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl">
						검색되는 회사를 넘어,
						<br />
						<span className="bg-gradient-to-r from-[#6366F1] to-[#7C3AED] bg-clip-text text-transparent">
							AI가 추천하는 회사로.
						</span>
					</h1>
					<p className="max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg">
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
						<h2 className="text-2xl font-extrabold text-[#0F172A] sm:text-3xl">
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
							accent="indigo"
							outcome="결과 · 정밀 유입과 전환"
						/>
					</div>
					<blockquote className="rounded-2xl border border-[#6366F1]/20 bg-[#EEF2FF] px-6 py-5 text-center sm:px-10">
						<p className="text-sm font-semibold leading-relaxed text-[#312E81] sm:text-base">
							“이제 중요한 것은 단순히 검색 결과에 노출되는 것이 아니라, AI가 우리 회사를 이해하고 신뢰하여
							답변의 근거로 인용하는가입니다.”
						</p>
					</blockquote>
				</section>

				{/* ③ GEO 핵심 4대 요소 */}
				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-2 text-center">
						<h2 className="text-2xl font-extrabold text-[#0F172A] sm:text-3xl">
							AI가 우리 사이트를 추천하기 위한 4가지 조건
						</h2>
						<p className="mx-auto max-w-2xl text-sm leading-relaxed text-[#475569] sm:text-base">
							REDUE는 단순 키워드 작성이 아닌 AI가 사이트를 발견하고 → 이해하고 → 신뢰하고 → 인용하는 연계
							구조를 구축합니다.
						</p>
					</div>
					<div className="grid gap-5 sm:grid-cols-2">
						{GEO_PILLARS.map((pillar) => (
							<article
								key={pillar.stage}
								className="group flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
							>
								<div className="flex items-center gap-3">
									<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1]/10 to-[#7C3AED]/10 text-lg font-extrabold text-[#4F46E5]">
										{pillar.step}
									</span>
									<div className="flex flex-col">
										<span className="text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">
											{pillar.stage} · {pillar.label}
										</span>
										<h3 className="text-base font-bold text-[#0F172A]">{pillar.title}</h3>
									</div>
								</div>
								<p className="text-sm leading-relaxed text-[#475569]">{pillar.description}</p>
							</article>
						))}
					</div>
				</section>

				{/* ④ Key Benefits */}
				<section className="flex flex-col gap-6">
					<div className="flex flex-col gap-2 text-center">
						<h2 className="text-2xl font-extrabold text-[#0F172A] sm:text-3xl">
							GEO 최적화로 달라지는 4가지 핵심 가치
						</h2>
					</div>
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{GEO_BENEFITS.map((benefit) => (
							<article
								key={benefit.title}
								className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
							>
								<span className="text-2xl" aria-hidden>
									{benefit.icon}
								</span>
								<h3 className="text-sm font-bold text-[#0F172A]">{benefit.title}</h3>
								<p className="text-sm leading-relaxed text-[#475569]">{benefit.description}</p>
							</article>
						))}
					</div>
				</section>

				{/* ⑤ REDUE 차별화 기술 — AI Self-Healing */}
				<section className="overflow-hidden rounded-2xl border border-[#6366F1]/25 bg-gradient-to-br from-[#EEF2FF] via-white to-[#F5F3FF] p-6 shadow-sm sm:p-8">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
						<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#7C3AED] text-2xl shadow-lg shadow-[#6366F1]/30">
							🤖
						</div>
						<div className="flex flex-col gap-2">
							<span className="w-fit rounded-full border border-[#6366F1]/25 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4F46E5]">
								REDUE 차별화 기술
							</span>
							<h2 className="text-xl font-extrabold text-[#0F172A] sm:text-2xl">
								AI Self-Healing 실시간 자율 복구
							</h2>
							<p className="max-w-2xl text-sm leading-relaxed text-[#475569] sm:text-base">
								소스코드 수정 없이 헤더에 <code className="rounded bg-[#E0E7FF] px-1.5 py-0.5 text-[13px] font-semibold text-[#3730A3]">&lt;script&gt;</code> 한 줄 삽입만으로 누락된 Meta, Schema, Open Graph 태그를 실시간 자동 생성 및 주입하는 자율 복구 솔루션을 제공합니다.
							</p>
						</div>
					</div>
				</section>

				{/* ⑥ 주요 AI 검색 엔진 노출 예시 */}
				<section className="flex flex-col gap-8">
					<div className="flex flex-col items-center gap-2 text-center">
						<span className="w-fit rounded-full border border-[#6366F1]/20 bg-[#6366F1]/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#6366F1]">
							[Before vs After]
						</span>
						<h2 className="text-2xl font-extrabold text-[#0F172A] sm:text-3xl">주요 AI 검색 엔진 노출 예시</h2>
						<p className="text-sm text-[#475569] sm:text-base">
							GEO 최적화 적용 전후, AI 답변 화면에 내 브랜드가 어떻게 표출되는지 비교해 보세요.
						</p>
					</div>

					<div className="relative grid gap-6 lg:grid-cols-2">
						{/* 적용 전 (Before) */}
						<div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0B0F19] p-6 shadow-xl">
							<div className="mb-4 flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-400">
									Before
								</span>
								<span className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
									최적화 전: 언급 미흡
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
								<p className="text-sm leading-relaxed text-slate-400">
									해당 분야 관련 추천 브랜드 정보를 찾을 수 없거나 출처 링크가 누락된 일반 텍스트 답변만
									표출됩니다.
								</p>
							</div>
							<div className="mt-5 space-y-2 opacity-40">
								<div className="h-2.5 w-full rounded bg-slate-600" />
								<div className="h-2.5 w-5/6 rounded bg-slate-600" />
								<div className="h-2.5 w-2/3 rounded bg-slate-600" />
							</div>
						</div>

						{/* 적용 후 (After) */}
						<div className="relative overflow-hidden rounded-2xl border border-[#7C3AED]/40 bg-[#0B0F19] p-6 shadow-[0_0_45px_-10px_rgba(124,58,237,0.5)]">
							<div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#6366F1]/25 blur-3xl" />
							<div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
							<div className="relative mb-4 flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
									After
								</span>
								<span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
									최적화 후: AI 답변 내 브랜드 추천 및 출처 URL 표기
								</span>
							</div>
							<div className="relative mb-5 flex items-center gap-1.5">
								<span className="h-3 w-3 rounded-full bg-red-500/70" />
								<span className="h-3 w-3 rounded-full bg-yellow-500/70" />
								<span className="h-3 w-3 rounded-full bg-green-500/70" />
								<span className="ml-2 text-xs font-semibold text-slate-400">ChatGPT Search · 적용 후</span>
							</div>
							<div className="relative flex items-start gap-3">
								<span className="mt-0.5 text-xl" aria-hidden>
									✅
								</span>
								<div className="flex-1">
									<span className="inline-block rounded-md bg-gradient-to-r from-[#6366F1] to-[#7C3AED] px-2 py-0.5 text-xs font-bold text-white">
										Redue AI 추천
									</span>
									<p className="mt-2 text-sm leading-relaxed text-slate-200">
										AI 답변 최상단에 브랜드 명세와 FAQ가 함께 노출되며, 공식 홈페이지로 바로 연결되는 출처
										버튼이 표시됩니다.
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<span className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
											[1] 공식 홈페이지
										</span>
										<span className="inline-flex items-center gap-1 rounded-lg border border-[#8b85ff]/30 bg-[#8b85ff]/10 px-2.5 py-1 text-xs font-semibold text-[#c4b5fd]">
											[2] FAQ
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* ⑦ Closing CTA */}
				<section className="flex flex-col items-center gap-4 rounded-3xl border border-[#E2E8F0] bg-gradient-to-br from-[#EEF2FF] via-white to-[#F5F3FF] px-6 py-14 text-center shadow-sm sm:px-10">
					<h2 className="max-w-xl text-2xl font-extrabold text-[#0F172A] sm:text-3xl">
						우리 사이트는 AI에게 어떻게 평가되고 있을까요?
					</h2>
					<Link href="/audit" className={`mt-2 ${CTA_CLASS}`}>
						10초 정밀 GEO 진단 시작하기 →
					</Link>
				</section>
			</main>
		</div>
	);
}

import { EnterpriseInquiryForm } from '@/components/EnterpriseInquiryForm';

const FEATURES = [
	{
		badge: 'Docker',
		badgeClass: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
		title: '고객사 내부 서버 전용 Docker 주입 에이전트',
		description:
			'온프레미스 환경에 REDUE 주입 에이전트를 Docker로 배포합니다. 스키마·파일 접근이 고객사 VPC 밖으로 나가지 않습니다.',
	},
	{
		badge: 'SLA 99.9%',
		badgeClass: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
		title: 'SLA 99.9% 보장',
		description:
			'엔터프라이즈 전용 가용성 약정과 장애 대응 SLA를 제공합니다. 대규모 CMS 클러스터에도 안정적인 주입 파이프라인을 유지합니다.',
	},
	{
		badge: 'Dedicated',
		badgeClass: 'border-slate-400/40 bg-slate-400/10 text-slate-200',
		title: '전담 기술 지원 및 맞춤형 스키마 설계',
		description:
			'전담 솔루션 엔지니어가 산업·CMS·다국어 요구에 맞춘 JSON-LD / GEO 스키마를 설계·검증합니다.',
	},
] as const;

export default function EnterprisePage() {
	return (
		<main className="flex flex-col gap-10">
			<section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#121416] via-[#0C0D0E] to-[#0a1218] p-8">
				<div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
				<div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
				<div className="relative flex flex-col gap-4">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
							Enterprise
						</span>
						<span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
							B2B · On-Premise
						</span>
					</div>
					<h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
						보안과 규모가 필요한 기업을 위한
						<br />
						<span className="bg-gradient-to-r from-amber-200 to-cyan-300 bg-clip-text text-transparent">
							REDUE AI SEO &amp; GEO
						</span>
					</h1>
					<p className="max-w-xl text-sm leading-relaxed text-slate-400">
						대기업·금융·공공 환경에 맞춘 온프레미스 배포, SLA, 전담 지원으로 AI 검색 엔진 가시성을 전사적으로
						관리하세요.
					</p>
				</div>
			</section>

			<section className="grid gap-4 sm:grid-cols-3">
				{FEATURES.map((feature) => (
					<article key={feature.title} className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
						<span className={`w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${feature.badgeClass}`}>
							{feature.badge}
						</span>
						<h2 className="text-sm font-bold text-white">{feature.title}</h2>
						<p className="text-xs leading-relaxed text-slate-400">{feature.description}</p>
					</article>
				))}
			</section>

			<EnterpriseInquiryForm />
		</main>
	);
}

import { WpPluginBuilderPanel } from '@/components/WpPluginBuilderPanel';

export default function WpPluginBuilderPage() {
	return (
		<main className="flex flex-col gap-8">
			<section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#101418] via-[#0C0D0E] to-[#06141c] p-8">
				<div className="pointer-events-none absolute -right-12 top-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
				<div className="relative flex flex-col gap-3">
					<span className="w-fit rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
						Plugin Builder
					</span>
					<h1 className="text-3xl font-extrabold text-white">워드프레스 공식 플러그인 빌더</h1>
					<p className="max-w-xl text-sm leading-relaxed text-slate-400">
						WordPress.org 디렉토리 제출 기준에 맞춘 경량 플러그인 패키지를 자동 생성합니다. 설치 후 REDUE API
						Key만 입력하면 마스터 스키마가 사이트 전체에 1-Click 동기화됩니다.
					</p>
				</div>
			</section>

			<div className="grid gap-4 sm:grid-cols-3">
				{[
					{ title: 'redue-ai-seo.php', desc: '메인 플러그인 — 설정 페이지 + wp_head JSON-LD' },
					{ title: 'readme.txt', desc: '공식 스토어 규격 (Stable tag / FAQ / Changelog)' },
					{ title: 'assets/', desc: '아이콘 SVG 및 배너 플레이스홀더' },
				].map((item) => (
					<article key={item.title} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
						<p className="font-mono text-sm font-bold text-cyan-300">{item.title}</p>
						<p className="mt-1 text-xs text-slate-400">{item.desc}</p>
					</article>
				))}
			</div>

			<WpPluginBuilderPanel />
		</main>
	);
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'REDUE AI SEO & GEO 도입 사례 | REDUE',
	description: '실제 사이트 환경에 REDUE 스키마 주입 및 GEO 최적화를 적용한 실증 리포트입니다.',
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
	return children;
}

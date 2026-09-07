import type { Metadata } from 'next';
import { LegalArticle, LegalDocument, LegalList } from '@/components/legal/LegalDocument';

const EFFECTIVE_DATE = '2026년 9월 1일';

const TOC = [
	{ id: 'article-1', label: '목적' },
	{ id: 'article-2', label: '용어의 정의' },
	{ id: 'article-3', label: '서비스의 제공 및 한계' },
	{ id: 'article-4', label: '면책 조항 및 성과 보증의 제한' },
	{ id: 'article-5', label: '이용자의 의무 및 금지행위' },
	{ id: 'article-6', label: '지식재산권' },
	{ id: 'article-7', label: '준거법 및 관할' },
	{ id: 'addendum', label: '부칙' },
] as const;

export const metadata: Metadata = {
	title: '이용약관 | REDUE AI SEO GEO STUDIO',
	description: 'REDUE AI SEO · GEO STUDIO 서비스 이용약관입니다.',
	robots: { index: true, follow: true },
};

export default function TermsPage() {
	return (
		<LegalDocument
			kicker="TERMS OF SERVICE"
			title="이용약관"
			lead="REDUE AI SEO · GEO STUDIO가 제공하는 웹사이트 감사, 검색 최적화(SEO) 및 생성형 검색 엔진 최적화(GEO/AEO) 분석 도구의 이용 조건입니다."
			effectiveDate={EFFECTIVE_DATE}
			toc={TOC}
		>
			<LegalArticle id="article-1" number="1" title="목적">
				<p>
					본 약관은 REDUE AI SEO · GEO STUDIO(이하 &quot;서비스&quot;)가 제공하는 웹사이트 감사, 검색 최적화(SEO)
					및 생성형 검색 엔진 최적화(GEO/AEO) 분석 도구 및 관련 제반 서비스의 이용과 관련하여, 서비스와 이용자 간의
					권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
				</p>
			</LegalArticle>

			<LegalArticle id="article-2" number="2" title="용어의 정의">
				<LegalList
					items={[
						'“서비스”란 웹사이트 URL 기반의 구조 분석, 시맨틱 마크업 및 스키마 구조 진단, 인덱싱 최적화 가이드 등 REDUE가 플랫폼을 통해 제공하는 웹 기반 분석 도구 일체를 의미합니다.',
						'“이용자”란 본 약관에 동의하고 서비스를 방문하여 분석 및 진단 리포트를 열람하거나 관련 기능을 이용하는 자를 의미합니다.',
						'“진단 리포트”란 이용자가 입력한 웹사이트 데이터를 기반으로 시스템 알고리즘이 생성하는 감사 점수, 기술적 결함 지표, 개선 권고안을 의미합니다.',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-3" number="3" title="서비스의 제공 및 한계">
				<LegalList
					items={[
						'서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 정기 점검, 서버 증설, 외부 검색엔진 API 사정 등에 따라 일시 중단될 수 있습니다.',
						'서비스에서 제공하는 분석 데이터는 공개된 웹 표준 및 생성형 엔진 분석 모델에 기반한 보조 도구입니다.',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-4" number="4" title="면책 조항 및 성과 보증의 제한">
				<LegalList
					items={[
						'본 서비스가 제공하는 감사 점수, AI 인텔리전스 지표, 스키마 권고안은 웹사이트 최적화를 돕기 위한 기술적 참고 자료입니다.',
						'서비스는 제3자 검색엔진(Google, Naver 등) 및 생성형 AI 플랫폼(ChatGPT, Perplexity, Gemini 등)의 검색 노출 순위, 인덱싱 여부, 트래픽 증가 및 상업적 성과를 직접적으로 보증하지 않으며, 외부 알고리즘 변경으로 인한 결과 변동에 대해 책임을 지지 않습니다.',
						'이용자가 서비스의 권고안을 자사 웹사이트에 직접 적용하거나 수정하는 과정에서 발생하는 시스템 오류, 호환성 문제, 트래픽 변화 등에 대한 최종 책임은 이용자 본인에게 있습니다.',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-5" number="5" title="이용자의 의무 및 금지행위">
				<p>이용자는 다음 각 호의 행위를 하여서는 안 됩니다.</p>
				<LegalList
					items={[
						'비정상적인 트래픽을 유발하여 시스템의 안정적 운영을 방해하는 행위',
						'자동화된 봇, 스크래퍼 등을 이용하여 서비스의 데이터를 무단 수집, 복제, 리버스 엔지니어링하는 행위',
						'적법한 권한이 없는 제3자의 비공개 웹사이트를 악의적으로 스캔하거나 보안 취약점을 탐지하는 행위',
						'서비스의 지식재산권을 침해하거나 기타 관계 법령을 위반하는 행위',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-6" number="6" title="지식재산권">
				<LegalList
					items={[
						'서비스가 자체 개발한 진단 알고리즘, UI/UX 디자인, 브랜드 로고, 리포트 템플릿 등에 대한 지식재산권은 REDUE에 전속합니다.',
						'이용자는 서비스를 통해 얻은 분석 결과물을 자사 사이트 개선 목적으로 자유롭게 활용할 수 있으나, 서비스 자체를 재판매하거나 상업적 경쟁 툴로 가공하여 무단 배포할 수 없습니다.',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-7" number="7" title="준거법 및 관할">
				<p>
					본 약관의 해석 및 분쟁에 관하여는 대한민국 법령을 준거법으로 하며, 분쟁 발생 시 민사소송법에 따른 관할
					법원을 전속 관할로 합니다.
				</p>
			</LegalArticle>

			<section
				id="addendum"
				className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white/70 px-5 py-6 dark:border-white/10 dark:bg-white/[0.03] sm:px-6"
			>
				<h2 className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">부칙</h2>
				<p className="mt-3">본 약관은 {EFFECTIVE_DATE}부터 시행됩니다.</p>
			</section>
		</LegalDocument>
	);
}

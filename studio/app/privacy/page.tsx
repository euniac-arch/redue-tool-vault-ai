import type { Metadata } from 'next';
import { LegalArticle, LegalDocument, LegalList } from '@/components/legal/LegalDocument';

const EFFECTIVE_DATE = '2026년 9월 1일';
const PRIVACY_EMAIL = 'euniac@gmail.com';

const TOC = [
	{ id: 'article-1', label: '개인정보의 처리 목적' },
	{ id: 'article-2', label: '처리하는 개인정보의 항목' },
	{ id: 'article-3', label: '보유 및 이용 기간' },
	{ id: 'article-4', label: '제3자 제공 및 위탁' },
	{ id: 'article-5', label: '정보주체의 권리' },
	{ id: 'article-6', label: '안전성 확보 조치' },
	{ id: 'article-7', label: '개인정보 보호책임자' },
	{ id: 'addendum', label: '부칙' },
] as const;

export const metadata: Metadata = {
	title: '개인정보처리방침 | REDUE AI SEO GEO STUDIO',
	description: 'REDUE AI SEO · GEO STUDIO 개인정보처리방침입니다.',
	robots: { index: true, follow: true },
};

export default function PrivacyPage() {
	return (
		<LegalDocument
			kicker="PRIVACY POLICY"
			title="개인정보처리방침"
			lead="REDUE AI SEO · GEO STUDIO는 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령이 정한 바를 준수하며, 적법하게 개인정보를 처리하고 안전하게 관리하고 있습니다."
			effectiveDate={EFFECTIVE_DATE}
			toc={TOC}
		>
			<LegalArticle id="article-1" number="1" title="개인정보의 처리 목적">
				<p>서비스는 다음의 목적을 위해 최소한의 개인정보를 처리하며, 목적 외의 용도로는 이용하지 않습니다.</p>
				<LegalList
					items={[
						'서비스 문의 및 진단 컨설팅 신청 접수, 상담 회신',
						'이용자별 맞춤형 진단 리포트 발송 및 기술 지원',
						'서비스 트래픽 분석, 접속 빈도 파악 등 서비스 품질 개선 및 통계 목적',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-2" number="2" title="처리하는 개인정보의 항목">
				<LegalList
					items={[
						<>
							문의 및 상담 접수 시 수집 항목:
							<ul className="mt-2 list-disc space-y-1 pl-5">
								<li>필수항목: 성명(또는 담당자명), 이메일 주소, 문의 대상 웹사이트 URL</li>
								<li>선택항목: 연락처, 회사명, 문의 세부 내용</li>
							</ul>
						</>,
						<>
							서비스 이용 과정에서 자동 생성·수집되는 항목:
							<ul className="mt-2 list-disc space-y-1 pl-5">
								<li>IP 주소, 쿠키(Cookie), 접속 로그, 방문 일시, 브라우저 종류 및 OS 환경</li>
							</ul>
						</>,
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-3" number="3" title="개인정보의 보유 및 이용 기간">
				<LegalList
					items={[
						'서비스는 원칙적으로 개인정보의 처리 목적이 달성된 경우 지체 없이 해당 정보를 파기합니다.',
						<>
							단, 고객 상담 이력 관리 및 분쟁 예방을 위해 다음 기준에 따라 보관 후 파기합니다:
							<ul className="mt-2 list-disc space-y-1 pl-5">
								<li>문의 및 상담 신청 이력: 접수일로부터 1년 보관 후 영구 삭제</li>
								<li>웹 접속 로그 기록: 통신비밀보호법에 의거 3개월 보관</li>
							</ul>
						</>,
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-4" number="4" title="개인정보의 제3자 제공 및 위탁">
				<LegalList
					items={[
						'서비스는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.',
						<>
							원활한 인프라 제공을 위해 다음과 같이 처리를 위탁하고 있습니다:
							<ul className="mt-2 list-disc space-y-1 pl-5">
								<li>호스팅 및 클라우드 인프라 운영: Vercel Inc., Cloudflare Inc.</li>
							</ul>
						</>,
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-5" number="5" title="정보주체의 권리·의무 및 행사방법">
				<LegalList
					items={[
						'정보주체는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.',
						'권리 행사는 서비스 대표 이메일 또는 문의 창구를 통해 서면, 전자우편으로 요청하실 수 있으며, 확인 즉시 지체 없이 조치합니다.',
					]}
				/>
			</LegalArticle>

			<LegalArticle id="article-6" number="6" title="개인정보의 안전성 확보 조치">
				<p>
					서비스는 개인정보의 분실, 도난, 유출, 변조를 방지하기 위해 다음과 같은 기술적·관리적 보호 조치를 취하고
					있습니다.
				</p>
				<LegalList
					items={['전송 구간 SSL/TLS 암호화 통신 적용', '관리자 접근 권한의 최소화 및 시스템 침입 차단 체계 운영']}
				/>
			</LegalArticle>

			<LegalArticle id="article-7" number="7" title="개인정보 보호책임자 및 담당 부서">
				<p>
					서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 불만 처리 및 피해 구제를 위해 아래와 같이
					담당자를 지정하고 있습니다.
				</p>
				<ul className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
					<li>문의 접수: REDUE AI SEO · GEO STUDIO 운영팀</li>
					<li>
						이메일:{' '}
						<a className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400" href={`mailto:${PRIVACY_EMAIL}`}>
							{PRIVACY_EMAIL}
						</a>
					</li>
				</ul>
			</LegalArticle>

			<section
				id="addendum"
				className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white/70 px-5 py-6 dark:border-white/10 dark:bg-white/[0.03] sm:px-6"
			>
				<h2 className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">부칙</h2>
				<p className="mt-3">본 방침은 {EFFECTIVE_DATE}부터 적용됩니다.</p>
			</section>
		</LegalDocument>
	);
}

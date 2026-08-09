import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';
import { MypageSections } from '@/components/MypageSections';
import { MypageHistoryTable, type HistoryRow } from '@/components/MypageHistoryTable';
import { PLANS } from '@/lib/plans';
import { prisma } from '@/lib/prisma';

const PAYMENT_STATUS_LABEL: Record<string, string> = {
	DONE: '결제 완료',
	FAILED: '결제 실패',
};

export default async function MypagePage() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect('/login?callbackUrl=/mypage');
	}

	const t = await getTranslations('mypage');

	const [user, historyRecords, payments] = await Promise.all([
		prisma.user.findUnique({ where: { id: session.user.id } }),
		prisma.injectionHistory.findMany({ where: { userId: session.user.id }, orderBy: { patchedAt: 'desc' } }),
		prisma.payment.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' } }),
	]);

	if (!user) {
		redirect('/login?callbackUrl=/mypage');
	}

	const plan = PLANS[user.planId as keyof typeof PLANS] ?? PLANS.starter;
	const historyRows: HistoryRow[] = historyRecords.map((record) => ({
		id: record.id,
		targetDomain: record.targetDomain,
		cmsType: record.cmsType,
		patchedAt: record.patchedAt.toISOString(),
		score: record.score,
		maxScore: record.maxScore,
		statusLabel: record.statusLabel,
		diagnosticsJson: record.diagnosticsJson,
		hasBackup: Boolean(record.backupZipPath),
	}));

	const latestDomain = historyRecords[0]?.siteUrl ?? historyRecords[0]?.targetDomain ?? null;

	const overview = (
		<>
			<section>
				<h1 className="text-2xl font-bold text-white">{t('title')}</h1>
				<p className="mt-1 text-sm text-slate-400">{t('description')}</p>
			</section>

			<section className="grid gap-4 sm:grid-cols-3">
				<SummaryCard label={t('currentPlan')} value={plan.name} accent="text-indigo-300" />
				<SummaryCard label={t('remainingCredits')} value={`${user.creditsRemaining}`} accent="text-cyan-300" />
				<SummaryCard label={t('totalInjections')} value={`${historyRecords.length}`} accent="text-emerald-400" />
			</section>

			<div className="grid gap-3 sm:grid-cols-2">
				<a
					href="/developer"
					className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
				>
					<div>
						<p className="text-sm font-bold text-white">🔑 {t('developerCard.title')}</p>
						<p className="mt-1 text-xs text-slate-400">{t('developerCard.description')}</p>
					</div>
					<span className="text-sm font-semibold text-accent-light">{t('developerCard.link')}</span>
				</a>
				<a
					href="/reseller"
					className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5 transition hover:bg-amber-400/[0.08]"
				>
					<div>
						<p className="text-sm font-bold text-white">🏷️ {t('resellerCard.title')}</p>
						<p className="mt-1 text-xs text-slate-400">{t('resellerCard.description')}</p>
					</div>
					<span className="text-sm font-semibold text-amber-300">{t('resellerCard.link')}</span>
				</a>
			</div>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-semibold text-slate-300">{t('historyTitle')}</h2>
				<MypageHistoryTable rows={historyRows} />
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-semibold text-slate-300">{t('paymentsTitle')}</h2>
				{payments.length === 0 ? (
					<p className="text-sm text-slate-500">{t('noPayments')}</p>
				) : (
					<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
						<table className="w-full text-left text-sm">
							<thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-4 py-3">결제 일자</th>
									<th className="px-4 py-3">요금제</th>
									<th className="px-4 py-3">결제 금액</th>
									<th className="px-4 py-3">결제 수단</th>
									<th className="px-4 py-3">상태</th>
									<th className="px-4 py-3">영수증</th>
								</tr>
							</thead>
							<tbody>
								{payments.map((payment) => (
									<tr key={payment.id} className="border-t border-white/[0.08]">
										<td className="px-4 py-3 text-xs text-slate-400">{payment.createdAt.toLocaleString('ko-KR')}</td>
										<td className="px-4 py-3 text-xs font-semibold text-slate-200">
											{PLANS[payment.planId as keyof typeof PLANS]?.name ?? payment.planId}
										</td>
										<td className="px-4 py-3 text-xs font-bold text-indigo-300">₩{payment.amount.toLocaleString()}</td>
										<td className="px-4 py-3 text-xs text-slate-400">{payment.method}</td>
										<td className="px-4 py-3 text-xs">
											<span
												className={
													payment.status === 'DONE' ? 'text-emerald-400' : 'text-rose-400'
												}
											>
												{PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
											</span>
										</td>
										<td className="px-4 py-3 text-xs">
											{payment.receiptUrl ? (
												<a
													href={payment.receiptUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-cyan-300 hover:underline"
												>
													영수증 보기 ↗
												</a>
											) : (
												<span className="text-slate-600">-</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</>
	);

	return (
		<main className="flex flex-col gap-8">
			<MypageSections overview={overview} initialDomain={latestDomain} />
		</main>
	);
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
	return (
		<div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
			<p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
			<p className={`mt-2 text-2xl font-extrabold ${accent}`}>{value}</p>
		</div>
	);
}

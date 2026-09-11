import { hasComparableNap, isUsableNapMatrix, napStatusLabel } from '@/lib/audit/nap-matrix';
import type { NapChannelRow, NapConsistencyStatus, NapMatrix } from '@/lib/guide/types';

type FallbackRow = [channel: string, name: string];

type NapConsistencyMatrixProps = {
	matrix?: NapMatrix | null;
	fallbackRows?: FallbackRow[];
	addressDisplay?: string;
	phoneDisplay?: string;
	hasAddress?: boolean;
	hasPhone?: boolean;
	/** Hide the legacy fallback banner when embedding on the audit dashboard. */
	compactFallback?: boolean;
};

function statusBadgeClass(status: NapConsistencyStatus): string {
	if (status === 'MATCH') {
		return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-800';
	}
	if (status === 'WARNING') {
		return 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-800';
	}
	if (status === 'MISMATCH') {
		return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-800';
	}
	if (status === 'UNAVAILABLE') {
		return 'bg-slate-100 text-slate-600 ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500';
	}
	return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600';
}

function NapStatusBadge({ status, title }: { status: NapConsistencyStatus; title?: string }) {
	return (
		<span
			title={title}
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-tight ring-1 ${statusBadgeClass(status)}`}
		>
			{napStatusLabel(status)}
		</span>
	);
}

function CollectedCell({ value, unavailable }: { value: string; unavailable?: boolean }) {
	if (!value) {
		if (unavailable) {
			return (
				<span
					title="데이터 수집 불가(API/스크래핑 차단)"
					className="text-xs text-slate-400 dark:text-slate-500"
				>
					—
				</span>
			);
		}
		return (
			<span className="text-xs italic text-slate-400 dark:text-slate-500" title="미수집">
				—
			</span>
		);
	}
	return (
		<span className="inline-block rounded bg-teal-50 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
			{value}
		</span>
	);
}

function AnalysisCell({ row }: { row: NapChannelRow }) {
	const unavailable = row.status === 'UNAVAILABLE';
	return (
		<div className="flex min-w-[9.5rem] flex-col items-start gap-1.5">
			<NapStatusBadge
				status={row.status}
				title={unavailable ? row.discrepancyNote || '데이터 수집 불가(API/스크래핑 차단)' : undefined}
			/>
			{row.status === 'WARNING' && row.discrepancyNote ? (
				<p className="m-0 text-[11px] leading-snug text-amber-800 dark:text-amber-200">{row.discrepancyNote}</p>
			) : null}
			{row.status === 'MISMATCH' && row.discrepancyNote ? (
				<p className="m-0 text-[11px] leading-snug text-rose-700 dark:text-rose-300">{row.discrepancyNote}</p>
			) : null}
		</div>
	);
}

function FallbackNapTable({
	fallbackRows,
	addressDisplay,
	phoneDisplay,
	hasAddress,
	hasPhone,
	compactFallback,
}: Omit<NapConsistencyMatrixProps, 'matrix'> & { fallbackRows: FallbackRow[] }) {
	return (
		<div className="guide-report__table-wrap overflow-x-auto">
			<table>
				<thead>
					<tr>
						<th>채널 구분</th>
						<th>상호명 표기</th>
						<th>주소 표기 (100% 동일 유지)</th>
						<th>대표 전화</th>
					</tr>
				</thead>
				<tbody>
					{fallbackRows.map(([channel, name]) => (
						<tr key={channel}>
							<td>
								<span className="guide-report__channel">{channel}</span>
							</td>
							<td>{name}</td>
							<td>
								<span className={hasAddress ? 'guide-report__exact' : 'guide-report__empty'}>{addressDisplay}</span>
							</td>
							<td>
								<span className={hasPhone ? 'guide-report__exact' : 'guide-report__empty'}>{phoneDisplay}</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{compactFallback ? null : (
				<p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
					구버전 진단이거나 채널별 NAP 수집이 아직 완료되지 않아 기본 안내 템플릿을 표시합니다. 최신 진단 후에는 채널별 실측
					표기와 일치 여부가 이 자리에 채워집니다.
				</p>
			)}
		</div>
	);
}

export function NapConsistencyMatrix({
	matrix,
	fallbackRows,
	addressDisplay = '도로명 주소 미등록',
	phoneDisplay = '대표 전화 미등록',
	hasAddress = false,
	hasPhone = false,
	compactFallback = false,
}: NapConsistencyMatrixProps) {
	if (!isUsableNapMatrix(matrix)) {
		const rows =
			fallbackRows && fallbackRows.length
				? fallbackRows
				: ([
						['공식 홈페이지', '—'],
						['네이버 플레이스 / 지도', '—'],
						['카카오맵 / 카카오 채널', '—'],
						['구글 비즈니스 프로필 (GBP)', '—'],
						['인스타그램 (SNS)', '—'],
						['유튜브 (YouTube)', '—'],
					] as FallbackRow[]);
		return (
			<FallbackNapTable
				fallbackRows={rows}
				addressDisplay={addressDisplay}
				phoneDisplay={phoneDisplay}
				hasAddress={hasAddress}
				hasPhone={hasPhone}
				compactFallback={compactFallback}
			/>
		);
	}

	const rows = matrix.rows;
	const gaps = (matrix.recommendations || []).filter((item) => {
		const row = rows.find((entry) => entry.channelId === item.channelId);
		return (
			row &&
			!row.isCanonical &&
			(row.status === 'WARNING' || row.status === 'MISMATCH') &&
			hasComparableNap(row)
		);
	});
	const showCallout = gaps.length > 0;
	const comparable = rows.filter((row) => row.status !== 'UNAVAILABLE' && row.status !== 'NOT_FOUND');
	const allAligned = comparable.length > 0 && comparable.every((row) => row.isCanonical || row.status === 'MATCH');

	return (
		<div className="guide-nap-matrix mt-4">
			<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
				<table className="w-full border-collapse text-left text-[13px]">
					<thead>
						<tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
							<th className="whitespace-nowrap px-3 py-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 sm:px-4">
								채널 구분
							</th>
							<th className="whitespace-nowrap px-3 py-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 sm:px-4">
								수집된 상호명
							</th>
							<th className="whitespace-nowrap px-3 py-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 sm:px-4">
								수집된 주소 표기
							</th>
							<th className="whitespace-nowrap px-3 py-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 sm:px-4">
								대표 전화
							</th>
							<th className="whitespace-nowrap px-3 py-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 sm:px-4">
								일치 여부 / 불일치 분석
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.channelId}
								className={
									row.isCanonical
										? 'border-b border-sky-100 bg-sky-50/90 dark:border-sky-900/50 dark:bg-sky-950/40'
										: 'border-b border-slate-100 bg-white odd:bg-slate-50/50 last:border-b-0 dark:border-slate-800 dark:bg-transparent dark:odd:bg-slate-800/30'
								}
							>
								<td className="px-3 py-3 align-top sm:px-4">
									<div className="flex flex-col gap-1">
										<span className="font-extrabold text-slate-900 dark:text-slate-100">{row.channelLabel}</span>
										{row.isCanonical ? (
											<span className="inline-flex w-fit rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">
												기준 채널
											</span>
										) : null}
									</div>
								</td>
								<td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200 sm:px-4">
									<CollectedCell value={row.collectedName} unavailable={row.status === 'UNAVAILABLE'} />
								</td>
								<td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200 sm:px-4">
									<CollectedCell value={row.collectedAddress} unavailable={row.status === 'UNAVAILABLE'} />
								</td>
								<td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200 sm:px-4">
									<CollectedCell value={row.collectedPhone} unavailable={row.status === 'UNAVAILABLE'} />
								</td>
								<td className="px-3 py-3 align-top sm:px-4">
									<AnalysisCell row={row} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{showCallout ? (
				<aside
					className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-4 dark:border-violet-800/70 dark:bg-violet-950/40 sm:px-5"
					aria-label="AI 개체 식별 개선 권장사항"
				>
					<p className="m-0 text-sm font-extrabold text-violet-900 dark:text-violet-100">AI 개체 식별 개선 권장사항</p>
					<p className="mt-1 mb-3 text-xs leading-relaxed text-violet-800 dark:text-violet-200">
						아래 채널의 상호·주소·전화가 공식 홈페이지 기준 NAP와 어긋나 AI가 동일 업체로 묶지 못할 수 있습니다. 표기를
						한 문자열로 맞추세요.
					</p>
					<ul className="m-0 flex list-none flex-col gap-2 p-0">
						{gaps.map((item) => (
							<li
								key={`${item.channelId}-${item.prescription}`}
								className="relative pl-4 text-[13px] leading-relaxed text-violet-950 dark:text-violet-100"
							>
								<span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden />
								{item.prescription}
							</li>
						))}
					</ul>
				</aside>
			) : allAligned ? (
				<p className="mt-3 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
					식별된 채널의 NAP가 공식 홈페이지 기준과 일치합니다. 분기별로 한 번씩 재대조하세요.
				</p>
			) : null}
		</div>
	);
}

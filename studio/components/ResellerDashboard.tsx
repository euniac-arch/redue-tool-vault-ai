'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResellerClient, ResellerProfile } from '@/lib/reseller-store';

export function ResellerDashboard() {
	const [profile, setProfile] = useState<ResellerProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [clientForm, setClientForm] = useState({ name: '', email: '', credits: '10' });
	const [bulkCredits, setBulkCredits] = useState('50');
	const fileRef = useRef<HTMLInputElement>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/reseller');
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '리셀러 프로필을 불러오지 못했습니다.');
			setProfile(data.profile as ResellerProfile);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function saveBranding() {
		if (!profile) return;
		setSaving(true);
		setMessage(null);
		setError(null);
		try {
			const res = await fetch('/api/reseller', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'updateBranding',
					partnerName: profile.partnerName,
					customDomain: profile.customDomain,
					brandColor: profile.brandColor,
					logoDataUrl: profile.logoDataUrl,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.');
			setProfile(data.profile as ResellerProfile);
			setMessage('파트너 브랜딩이 저장되었습니다.');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSaving(false);
		}
	}

	async function addClient(event: React.FormEvent) {
		event.preventDefault();
		if (!profile) return;
		setSaving(true);
		setError(null);
		try {
			const res = await fetch('/api/reseller', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'addClient',
					name: clientForm.name,
					email: clientForm.email,
					creditsAllocated: Number(clientForm.credits) || 0,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '고객사 추가에 실패했습니다.');
			setProfile(data.profile as ResellerProfile);
			setClientForm({ name: '', email: '', credits: '10' });
			setMessage('하위 고객사가 추가되었습니다.');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSaving(false);
		}
	}

	async function allocateBulk() {
		if (!profile) return;
		setSaving(true);
		setError(null);
		try {
			const res = await fetch('/api/reseller', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'allocateBulk',
					creditsPerClient: Number(bulkCredits) || 0,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '대량 할당에 실패했습니다.');
			setProfile(data.profile as ResellerProfile);
			setMessage(`모든 하위 고객사에 크레딧 ${bulkCredits}회가 할당되었습니다.`);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSaving(false);
		}
	}

	function onLogoFile(file: File | undefined) {
		if (!file || !profile) return;
		if (file.size > 800_000) {
			setError('로고는 800KB 이하로 업로드해 주세요.');
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setProfile({ ...profile, logoDataUrl: String(reader.result) });
		};
		reader.readAsDataURL(file);
	}

	if (loading) {
		return <p className="text-sm text-slate-500">리셀러 대시보드를 불러오는 중...</p>;
	}

	if (!profile) {
		return <p className="text-sm text-rose-400">{error ?? '프로필을 불러올 수 없습니다.'}</p>;
	}

	const allocatedTotal = profile.clients.reduce((sum, c) => sum + c.creditsAllocated, 0);

	return (
		<div className="flex flex-col gap-8">
			<section className="grid gap-4 sm:grid-cols-3">
				<StatCard label="크레딧 풀" value={`${profile.creditPool}`} accent="text-cyan-300" />
				<StatCard label="하위 고객사" value={`${profile.clients.length}`} accent="text-amber-300" />
				<StatCard label="할당된 크레딧" value={`${allocatedTotal}`} accent="text-emerald-400" />
			</section>

			{(message || error) && (
				<p className={`text-sm ${error ? 'text-rose-400' : 'text-emerald-400'}`}>{error ?? message}</p>
			)}

			<section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
				<div className="mb-4 flex flex-wrap items-center gap-2">
					<span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
						White-Label
					</span>
					<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
						Branding
					</span>
				</div>
				<h2 className="text-lg font-bold text-white">파트너 커스텀 브랜딩</h2>
				<p className="mt-1 text-xs text-slate-400">자사 도메인·로고·브랜드 컬러로 서비스를 재판매하세요.</p>

				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<label className="flex flex-col gap-1.5">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">파트너명</span>
						<input
							value={profile.partnerName}
							onChange={(e) => setProfile({ ...profile, partnerName: e.target.value })}
							className={inputClass}
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">도메인 연동</span>
						<input
							value={profile.customDomain}
							onChange={(e) => setProfile({ ...profile, customDomain: e.target.value })}
							className={inputClass}
							placeholder="seo.agency-domain.com"
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">브랜드 컬러</span>
						<div className="flex items-center gap-2">
							<input
								type="color"
								value={profile.brandColor}
								onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
								className="h-10 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
							/>
							<input
								value={profile.brandColor}
								onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
								className={inputClass}
							/>
						</div>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">로고 업로드</span>
						<div className="flex items-center gap-3">
							{profile.logoDataUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={profile.logoDataUrl} alt="Partner logo" className="h-10 w-10 rounded-lg border border-white/10 object-contain" />
							) : (
								<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/20 text-[10px] text-slate-600">
									LOGO
								</div>
							)}
							<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0])} />
							<button
								type="button"
								onClick={() => fileRef.current?.click()}
								className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
							>
								이미지 선택
							</button>
						</div>
					</label>
				</div>

				{/* Live preview strip */}
				<div
					className="mt-5 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3"
					style={{ boxShadow: `inset 3px 0 0 ${profile.brandColor}` }}
				>
					{profile.logoDataUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={profile.logoDataUrl} alt="" className="h-8 w-8 rounded object-contain" />
					) : (
						<span
							className="rounded px-2 py-1 text-xs font-bold text-[#0C0D0E]"
							style={{ backgroundColor: profile.brandColor }}
						>
							{profile.partnerName.slice(0, 6) || 'AGENCY'}
						</span>
					)}
					<div>
						<p className="text-sm font-bold text-white">{profile.partnerName || 'Agency Partner'}</p>
						<p className="font-mono text-[11px] text-slate-500">{profile.customDomain || 'seo.agency-domain.com'}</p>
					</div>
				</div>

				<button
					type="button"
					onClick={() => void saveBranding()}
					disabled={saving}
					className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-50"
				>
					{saving ? '저장 중...' : '브랜딩 저장'}
				</button>
			</section>

			<section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-bold text-white">하위 고객사 관리</h2>
						<p className="mt-1 text-xs text-slate-400">파트너가 관리하는 하위 유저 계정과 크레딧 할당</p>
					</div>
					<div className="flex items-center gap-2">
						<input
							value={bulkCredits}
							onChange={(e) => setBulkCredits(e.target.value)}
							className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-xs text-slate-100"
						/>
						<button
							type="button"
							onClick={() => void allocateBulk()}
							disabled={saving || profile.clients.length === 0}
							className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
						>
							대량 크레딧 할당
						</button>
					</div>
				</div>

				<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
					<table className="w-full text-left text-sm">
						<thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">고객사</th>
								<th className="px-4 py-3">이메일</th>
								<th className="px-4 py-3">할당 크레딧</th>
								<th className="px-4 py-3">등록일</th>
							</tr>
						</thead>
						<tbody>
							{profile.clients.length === 0 ? (
								<tr>
									<td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">
										등록된 하위 고객사가 없습니다.
									</td>
								</tr>
							) : (
								profile.clients.map((client: ResellerClient) => (
									<tr key={client.id} className="border-t border-white/[0.08]">
										<td className="px-4 py-3 text-xs font-semibold text-slate-200">{client.name}</td>
										<td className="px-4 py-3 text-xs text-slate-400">{client.email}</td>
										<td className="px-4 py-3 text-xs font-bold text-cyan-300">{client.creditsAllocated}</td>
										<td className="px-4 py-3 text-xs text-slate-500">
											{new Date(client.createdAt).toLocaleDateString('ko-KR')}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<form onSubmit={addClient} className="mt-4 grid gap-2 sm:grid-cols-4">
					<input
						required
						value={clientForm.name}
						onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
						placeholder="고객사명"
						className={inputClass}
					/>
					<input
						required
						type="email"
						value={clientForm.email}
						onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
						placeholder="email@client.com"
						className={inputClass}
					/>
					<input
						required
						value={clientForm.credits}
						onChange={(e) => setClientForm({ ...clientForm, credits: e.target.value })}
						placeholder="크레딧"
						className={inputClass}
					/>
					<button
						type="submit"
						disabled={saving}
						className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-accent-light disabled:opacity-50"
					>
						고객사 추가
					</button>
				</form>
			</section>
		</div>
	);
}

const inputClass =
	'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none';

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
	return (
		<div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
			<p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
			<p className={`mt-2 text-2xl font-extrabold ${accent}`}>{value}</p>
		</div>
	);
}

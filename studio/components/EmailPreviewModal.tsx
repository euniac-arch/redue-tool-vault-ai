'use client';

import { useEffect } from 'react';

interface EmailPreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	siteName?: string;
	targetUrl?: string;
}

export function EmailPreviewModal({
	isOpen,
	onClose,
	siteName = '한국중입자 암치료연구소',
	targetUrl = 'http://koreaionlab.co.kr',
}: EmailPreviewModalProps) {
	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="animate-fadeIn fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden"
			role="dialog"
			aria-modal="true"
			aria-labelledby="email-preview-modal-title"
			onClick={onClose}
		>
			<div
				className="flex max-h-[85vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl bg-white text-slate-800 shadow-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				{/* 모달 헤더 */}
				<div className="flex items-center justify-between bg-[#1a237e] px-5 py-4 text-white">
					<h3
						id="email-preview-modal-title"
						className="m-0 flex items-center gap-2 text-base font-bold"
					>
						✉️ 발송용 영업 이메일 템플릿 미리보기
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-2xl font-bold leading-none text-white hover:text-slate-300"
						aria-label="닫기"
					>
						&times;
					</button>
				</div>

				{/* 모달 바디 (스크롤 영역) */}
				<div className="flex-1 overflow-y-auto bg-[#f4f6f9] p-5">
					<table
						align="center"
						border={0}
						cellPadding={0}
						cellSpacing={0}
						width="100%"
						className="mx-auto max-w-[620px] overflow-hidden rounded-lg bg-white text-sm leading-relaxed text-[#333] shadow-sm"
					>
						<tbody>
							{/* Header */}
							<tr>
								<td className="bg-[#1a237e] p-6 text-white">
									<p className="m-0 text-xs font-bold text-[#9fa8da]">
										웹 최적화 &amp; SEO 진단 제안
									</p>
									<h1 className="m-0 mt-1.5 text-lg font-bold leading-snug">
										(광고) [{siteName}] 웹사이트 성능 및 검색 노출(SEO) 개선
										진단 리포트 공유의 건
									</h1>
								</td>
							</tr>

							{/* Body */}
							<tr>
								<td className="p-6 text-xs sm:text-sm">
									<p className="mt-0">
										안녕하세요, <strong>{siteName}</strong> 담당자님.
									</p>
									<p>
										<strong>Redue AI Studio</strong>의 담당자입니다.
									</p>
									<p>
										귀사의 웹사이트({targetUrl})를 둘러보던 중, 검색엔진
										노출(SEO) 구조 및 페이지 로딩 속도 측면에서 간단한 보완을
										통해 전환율을 향상시킬 수 있는 요소들이 확인되어 진단
										리포트를 공유해 드립니다.
									</p>
									<p className="mb-0 border-l-4 border-[#1a237e] bg-[#f8f9fa] p-2.5 text-xs text-[#666]">
										💡 <strong>안내:</strong> 본 리포트는 공개된 웹 표준 분석
										도구만을 활용하여 안전하게 측정된 비침습적 진단 결과입니다.
									</p>
								</td>
							</tr>

							{/* Report Summary Card */}
							<tr>
								<td className="px-6 py-2">
									<div className="rounded-lg border border-[#e0e0e0] bg-white p-4">
										<h2 className="mt-0 border-b-2 border-[#e8eaf6] pb-1.5 text-sm font-bold text-[#1a237e]">
											📊 {siteName} 웹 최적화 핵심 진단 요약
										</h2>
										<div className="my-3 rounded border border-dashed border-[#ccc] bg-[#f0f2f5] p-5 text-center">
											<p className="m-0 text-xs font-bold text-[#555]">
												[진단 리포트 캡처 이미지 영역]
											</p>
											<p className="m-0 mt-1 text-[11px] text-[#888]">
												SEO 점수 / Canonical URL 정합성 / JS Defer 검사 결과
											</p>
										</div>
									</div>
								</td>
							</tr>

							{/* Footer */}
							<tr>
								<td className="border-t border-[#eee] bg-[#f8f9fa] p-4 px-6 text-[11px] leading-normal text-[#777]">
									<p className="m-0 font-bold text-[#555]">
										[발신자 정보 및 수신거부 안내]
									</p>
									<p className="m-0 mt-1">
										<strong>발신자:</strong> Redue AI Studio | 대표 박성준
										<br />
										<strong>연락처:</strong> contact@redue.ai / 010-0000-0000
										<br />
										<strong>주소:</strong> 부산광역시
									</p>
									<p className="m-0 mt-2 border-t border-[#e0e0e0] pt-1.5 text-[10px] text-[#888]">
										본 메일은 정보통신망법 등 관련 법령을 준수하여 발송되는
										제안형 메일입니다. 수신을 원치 않으시면{' '}
										<a href="#" className="text-[#1a237e] underline">
											[수신거부]
										</a>
										를 클릭해 주세요.
									</p>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

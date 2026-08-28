/**
 * "4주 종합 Before/After 성과표" 1장짜리 PDF 내보내기.
 *
 * 전체 리포트 PDF 파이프라인(`print-pdf.ts`)은 멀티페이지 A4 캡처용으로 매우
 * 무겁게 최적화되어 있어 재사용하지 않는다 — 여기서는 `BeforeAfterMatrixCard`
 * 단일 DOM 노드만 캡처해 1페이지 PDF로 저장하는 가벼운 경로를 둔다.
 */

import { beginPdfLightPrint, endPdfLightPrint, isPrintCaptureMode } from '@/lib/audit/print-pdf';

const A4_PT = { width: 595.28, height: 841.89 } as const;

export async function downloadBeforeAfterSummaryPdf(
	node: HTMLElement | null,
	filename = '4주_Before_After_성과표.pdf',
): Promise<void> {
	if (typeof window === 'undefined' || !node) return;

	const alreadyPrinting = isPrintCaptureMode();
	beginPdfLightPrint();
	try {
		const html2canvas = (await import('html2canvas')).default;
		const { jsPDF } = await import('jspdf');

		// Settle web fonts before rasterizing — a font metric swap mid-capture
		// shifts every line box under it, which is the usual cause of a single
		// captured card looking "pushed up/down" relative to its live layout.
		if (typeof document !== 'undefined' && document.fonts) {
			await document.fonts.ready;
		}

		const canvas = await html2canvas(node, {
			scale: 2,
			useCORS: true,
			allowTaint: true,
			backgroundColor: '#ffffff',
			logging: false,
			imageTimeout: 1500,
			scrollX: 0,
			scrollY: 0,
			x: 0,
			y: 0,
			windowWidth: node.offsetWidth,
			windowHeight: node.offsetHeight,
			onclone: (_clonedDoc, clonedEl) => {
				if (!(clonedEl instanceof HTMLElement)) return;
				clonedEl.style.transform = 'none';
				clonedEl.style.margin = '0';
			},
		});

		const imgData = canvas.toDataURL('image/png');
		const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
		const imgWidth = A4_PT.width - 48;
		const imgHeight = (canvas.height * imgWidth) / canvas.width;
		const x = 24;
		const y = Math.max(24, (A4_PT.height - imgHeight) / 2);
		pdf.addImage(imgData, 'PNG', x, y, imgWidth, Math.min(imgHeight, A4_PT.height - 48));
		pdf.save(filename);
	} finally {
		if (!alreadyPrinting) endPdfLightPrint();
	}
}

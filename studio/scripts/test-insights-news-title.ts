/**
 * Run: npx tsx scripts/test-insights-news-title.ts
 */
import { stripHtml } from '../lib/admin/geo-news-html';
import { expandTruncatedNewsTitle, looksTruncatedNewsTitle, withNewsTitleEllipsis } from '../lib/insights/insights-news-title';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

const cut = '"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열';
const full = '“생명·평화·민주주의 가치, 숫자로 읽는다”… LPDI 개발 첫 공론장 열려';

assert('detect mid-word Korean cut', looksTruncatedNewsTitle(cut));
assert('complete title is not truncated', !looksTruncatedNewsTitle(full));
assert(
	'keep complete title',
	expandTruncatedNewsTitle('AI 검색, 브랜드가 인용되는 법', '본문 요약') === 'AI 검색, 브랜드가 인용되는 법',
);
assert(
	'expand trailing ellipsis from snippet',
	expandTruncatedNewsTitle(
		'삼성30주년 기념주화 110만개 중 25만개, 1370원 차익...',
		'삼성30주년 기념주화 110만개 중 25만개, 1370원 차익 발생으로 논란이 커지고 있다.',
	) === '삼성30주년 기념주화 110만개 중 25만개, 1370원 차익 발생으로 논란이 커지고 있다.',
);
assert(
	'strip ellipsis when snippet has no continuation',
	expandTruncatedNewsTitle('짧은 제목만 잘림...', '전혀 다른 요약입니다.') === '짧은 제목만 잘림',
);
assert(
	'complete mid-title ellipsis from snippet',
	expandTruncatedNewsTitle(cut, `${cut}려. 본문이 이어집니다.`) ===
		'"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열려',
);
assert(
	'complete cut title from publisher og:title',
	expandTruncatedNewsTitle(
		cut,
		'이로운넷 = 편집위원 김성환국내총생산(GDP)이 한 사회의 경제적 규모만 보여준다.',
		`${full} | 이로운넷`,
	) === full,
);

const fedexCut = "[AI프리뷰] 29일 대구 삼성-KT전, 선두 자리 가를 '에이스' 삼성 페덱·K";
const fedexFull = "[AI프리뷰] 29일 대구 삼성-KT전, 선두 자리 가를 '에이스' 삼성 페덱·KT 로건 맞대결";
assert('detect middot+letter cut (페덱·K)', looksTruncatedNewsTitle(fedexCut));
assert('detect short ending 삼성 페덱·K', looksTruncatedNewsTitle('삼성 페덱·K'));
assert('complete baseball title is not truncated', !looksTruncatedNewsTitle(fedexFull));
assert(
	'restore baseball title from og:title',
	expandTruncatedNewsTitle(fedexCut, '선발 맞대결 예고', `${fedexFull} | 스포츠서울`) === fedexFull,
);
assert(
	'restore from page title that contains the cut tail',
	expandTruncatedNewsTitle('삼성 페덱·K', '본문 요약', fedexFull) === fedexFull,
);
assert(
	'decode middot and hex entities without cutting the tail',
	stripHtml('[AI프리뷰] 삼성 페덱&middot;KT 로건 맞대결') === '[AI프리뷰] 삼성 페덱·KT 로건 맞대결' &&
		stripHtml('삼성 페덱&#x00B7;KT 로건 맞대결') === '삼성 페덱·KT 로건 맞대결',
);
assert(
	'append ... when feed cut the title',
	withNewsTitleEllipsis('삼성 페덱·K') === '삼성 페덱·K...' &&
		withNewsTitleEllipsis(cut) === `${cut}...`,
);
assert('keep existing trailing ...', withNewsTitleEllipsis('짧은 제목만 잘림...') === '짧은 제목만 잘림...');
assert(
	'do not append ... to a complete title',
	withNewsTitleEllipsis(fedexFull) === fedexFull,
);

if (failed > 0) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');

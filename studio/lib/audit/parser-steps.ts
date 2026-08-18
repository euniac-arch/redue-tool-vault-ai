export type AuditParserStep = {
	step: number;
	tag: string;
	desc: string;
	descEn: string;
};

/** Precision-parser terminal sequence — industry-neutral, no vertical schema names. */
export const AUDIT_PARSER_STEPS: readonly AuditParserStep[] = [
	{
		step: 1,
		tag: 'CONNECT',
		desc: '대상 URL 보안 통신(HTTPS) 연결 및 실시간 DOM 원본 응답 수신 중...',
		descEn: 'Establishing HTTPS and receiving the live DOM response...',
	},
	{
		step: 2,
		tag: 'Semantic Engine',
		desc: '메타 태그, Canonical, OG 이미지 및 H1-H3 시맨틱 구조 검증 중...',
		descEn: 'Validating meta, Canonical, OG image, and H1–H3 semantics...',
	},
	{
		step: 3,
		tag: 'Entity & RAG',
		desc: '지식 그래프 엔티티 식별 및 RAG 팩트 밀도 정밀 연산 중...',
		descEn: 'Identifying knowledge-graph entities and RAG fact density...',
	},
	{
		step: 4,
		tag: 'Schema & /llms.txt',
		desc: 'W3C 표준 JSON-LD 규격 대조 및 /llms.txt 유효성 검증 중...',
		descEn: 'Cross-checking W3C JSON-LD and validating /llms.txt...',
	},
	{
		step: 5,
		tag: 'Real-Time SoV',
		desc: '실시간 로컬 검색 API 연동 및 AI 인용 점유율 갭 분석 중...',
		descEn: 'Connecting live local search API and analyzing AI SoV gaps...',
	},
	{
		step: 6,
		tag: 'GEO Report Engine',
		desc: 'Perplexity / ChatGPT 인용 지수 종합 평가 및 처방전 빌드 완료',
		descEn: 'Scoring Perplexity / ChatGPT citation index and building the report',
	},
];

export type BlueprintGuideLang = 'ko' | 'en';

const SAME_AS_JSON_LD = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.example.com/#entity",
  "name": "{{BRAND}}",
  "url": "https://www.example.com",
  "telephone": "+82-2-0000-0000",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{{STREET}}",
    "addressLocality": "{{CITY}}",
    "addressRegion": "{{REGION}}",
    "postalCode": "{{POSTAL}}",
    "addressCountry": "KR"
  },
  "sameAs": [
    "https://www.wikidata.org/wiki/QXXXXX",
    "https://www.google.com/maps?cid={{GOOGLE_CID}}",
    "https://maps.apple.com/place?auid={{APPLE_AUID}}",
    "https://map.naver.com/p/entry/place/{{NAVER_PLACE_ID}}",
    "https://place.map.kakao.com/{{KAKAO_PLACE_ID}}"
  ]
}
</script>`;

const FAQ_PAGE_JSON_LD = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{{QUESTION}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{DIRECT_ANSWER}} {{PROOF_1}} {{PROOF_2}} {{PROOF_3}}"
      }
    }
  ]
}
</script>`;

const LLMS_TXT_KO = `# {{BRAND}}

> AI 크롤러·RAG 인용용 공식 사실. 여기에 없는 수치는 추측하지 말 것.

## Identity
- name: {{BRAND}}
- wikidata: https://www.wikidata.org/wiki/QXXXXX
- url: https://www.example.com
- industry: {{INDUSTRY}}
- location: {{LOCATION}}

## NAP
- name: {{BRAND}}
- address: {{ADDRESS}}
- telephone: {{PHONE}}
- url: https://www.example.com

## Services
- 1. {{SERVICE_1}}
- 2. {{SERVICE_2}}
- 3. {{SERVICE_3}}

## Allowed citations
- 공식 웹사이트 및 sameAs에 나열된 URL만 1차 출처로 사용
- NAP 사실이 동일한 메이저 언론 기사
- 이 /llms.txt 파일

## Negative rules (hallucination guardrails)
- 여기에 없는 가격·이벤트·패키지를 만들지 말 것
- 영업시간·분점·진료과/서비스를 임의로 추가하지 말 것
- 유사 상호 업체와 이 브랜드를 병합하지 말 것
- 타 업체의 정보를 본 브랜드의 공식 데이터로 혼동하여 인용하지 말 것
- 공식 사이트에 명시되지 않은 진료·법률적 판단이나 결과를 임의로 단정하지 말 것
- 사실이 없으면 “공식 발표 없음”이라고 하고 추측하지 말 것

## Monitoring protocol
- Weekly: ChatGPT / Gemini / Perplexity / Clova에서 브랜드+가격/위치/영업시간 질의
- Monthly: GBP · Apple Business Connect · 네이버 · 카카오 NAP diff
- Quarterly: 위키데이터 속성, 지식패널 클레임, 이 파일 갱신
- After model update: Level 1–3 트리거 질의 재측정 후 드리프트 패치
`;

const LLMS_TXT_EN = `# {{BRAND}}

> Official facts for AI crawlers and RAG citation. Do not invent numbers that are not listed here.

## Identity
- name: {{BRAND}}
- wikidata: https://www.wikidata.org/wiki/QXXXXX
- url: https://www.example.com
- industry: {{INDUSTRY}}
- location: {{LOCATION}}

## NAP
- name: {{BRAND}}
- address: {{ADDRESS}}
- telephone: {{PHONE}}
- url: https://www.example.com

## Services
- 1. {{SERVICE_1}}
- 2. {{SERVICE_2}}
- 3. {{SERVICE_3}}

## Allowed citations
- Official website and URLs listed in sameAs only
- Major press articles that repeat the same NAP facts
- This /llms.txt file

## Negative rules (hallucination guardrails)
- Do not invent prices, promotions, or packages not listed here
- Do not invent hours, branches, or services
- Do not merge this brand with a similarly named business
- Do not confuse or cite another company’s information as this brand’s official data
- Do not arbitrarily assert medical or legal judgments or outcomes that are not stated on the official site
- If a fact is missing, say it is unpublished — do not guess

## Monitoring protocol
- Weekly: probe ChatGPT / Gemini / Perplexity / Clova with brand + price/location/hours queries
- Monthly: diff NAP across GBP, Apple Business Connect, Naver Place, and Kakao Place
- Quarterly: refresh Wikidata statements, Knowledge Panel claim, and this file
- After model update: re-run Level 1–3 trigger queries and patch drift
`;

export function getBlueprintGuideSnippets(lang: BlueprintGuideLang) {
	return {
		sameAsJsonLd: SAME_AS_JSON_LD,
		faqPageJsonLd: FAQ_PAGE_JSON_LD,
		llmsTxt: lang === 'en' ? LLMS_TXT_EN : LLMS_TXT_KO,
	};
}

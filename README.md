# frontdesk

요청이 들어오면 무거운 범용 에이전트부터 부르지 않고, 13개 부서(전략/기획부터 개발·디자인·마케팅까지) 중 어디로 보낼지 먼저 판단하는 프런트데스크. 아이디어 검증부터 수익모델, 마케팅, 디자인, 개발까지 소프트웨어 회사의 모든 기능을 한 번에 처리하는 통합 AI 툴을 만들기 위한 1단계로, GitHub과 [skills.sh](https://skills.sh)에서 AI 개발자용 에이전트/스킬을 수집해 실제 개발 회사 조직도처럼 세분화된 분야별로 분류한 카탈로그다.

## 결과물

- **[CATALOG.md](CATALOG.md)** — 13개 부서 / ~57개 세부분야로 분류된 1,311건의 에이전트/스킬 목록 (사람이 읽는 최종 산출물)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — 이 카탈로그를 기반으로 통합 오케스트레이터를 어떻게 만들지에 대한 설계 방향, 그리고 규칙 기반 라우터 프로토타입 설명 ([ponytail](https://github.com/DietrichGebert/ponytail)의 저토큰 판단 사다리를 "에이전트 선택"에 적용)
- **[taxonomy.mjs](taxonomy.mjs)** — 분류 체계 정의 (부서/세부분야/키워드 힌트)
- **`data/catalog.json`** — 분류된 최종 데이터 (기계가 읽는 원본)
- **`data/unclassified.json`** — 자동 분류 실패 항목 (수동 검토용, 23건)
- **`scripts/route.mjs`** — 판단 사다리 라우터 프로토타입 (`npm run route -- "작업 설명"`)

## 다시 실행하기

```bash
npm run all   # collect:github → collect:skillssh → classify → enrich → build:catalog
```

개별 단계:

```bash
npm run collect:github    # gh CLI로 GitHub 저장소 수집 (data/raw/github/)
npm run collect:skillssh  # `npx skills search`로 skills.sh 스킬 수집 (data/raw/skillssh/)
npm run classify          # taxonomy.mjs 키워드로 자동 분류 → data/catalog.json (매번 raw에서 재생성됨)
npm run enrich            # 인기 상위 skills.sh 항목의 SKILL.md에서 실제 설명을 가져와 채움
npm run build:catalog     # CATALOG.md 생성
npm run route -- "우리 서비스 가격 정책을 어떻게 잡아야 할까?"   # 라우터 데모
```

`classify`는 항상 raw 데이터에서 카탈로그를 통째로 재생성하므로 `enrich`보다 먼저 실행해야 한다(순서를 바꾸면 보강한 설명이 사라진다). `npm run all`은 이 순서를 이미 보장한다.

`gh` CLI가 로그인되어 있어야 하고(`gh auth status`), Node.js 18+ 가 필요하다.

## 수집 범위

- **GitHub**: 27개 시드 토픽(`agent-skills`, `ai-agents`, `mcp-server`, `rag`, `terraform`, `product-management`, `sales-automation` 등)으로 검색, stars 30개 이상
- **skills.sh**: 36개 키워드(부서별 대표 키워드)로 검색

전체가 아니라 13개 부서를 고르게 대표하는 표본이다. 시드를 `scripts/collect-*.mjs`에 추가하면 확장된다.

## 왜 Playwright 대신 gh CLI / skills CLI인가

처음엔 Playwright로 GitHub과 skills.sh를 직접 크롤링할 계획이었지만, 조사 결과:
- GitHub은 `gh` CLI(REST search API)가 이미 인증되어 있고 구조화된 JSON을 즉시 준다.
- skills.sh는 공개 REST API가 인증을 요구하지만, 공식 CLI(`npx skills search`)는 인증 없이 동일한 데이터를 준다.

둘 다 브라우저 렌더링 없이 더 가볍고 안정적으로 같은 데이터를 얻을 수 있어 이 방식을 택했다. (자세한 내용은 ARCHITECTURE.md 참고)

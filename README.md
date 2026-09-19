# AI 개발 에이전트/스킬 통합 카탈로그

아이디어 검증부터 수익모델, 마케팅, 디자인, 개발까지 소프트웨어 회사의 모든 기능을 한 번에 처리하는 통합 AI 툴을 만들기 위한 1단계: GitHub과 [skills.sh](https://skills.sh)에서 AI 개발자용 에이전트/스킬을 수집해 실제 개발 회사 조직도처럼 세분화된 분야별로 분류한 카탈로그.

## 결과물

- **[CATALOG.md](CATALOG.md)** — 13개 부서 / ~55개 세부분야로 분류된 763건의 에이전트/스킬 목록 (사람이 읽는 최종 산출물)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — 이 카탈로그를 기반으로 통합 오케스트레이터를 어떻게 만들지에 대한 설계 방향 ([ponytail](https://github.com/DietrichGebert/ponytail)의 저토큰 판단 사다리를 "에이전트 선택"에 적용)
- **[taxonomy.mjs](taxonomy.mjs)** — 분류 체계 정의 (부서/세부분야/키워드 힌트)
- **`data/catalog.json`** — 분류된 최종 데이터 (기계가 읽는 원본)
- **`data/unclassified.json`** — 자동 분류 실패 항목 (수동 검토용)

## 다시 실행하기

```bash
npm run all   # collect:github → collect:skillssh → classify → build:catalog
```

개별 단계:

```bash
npm run collect:github    # gh CLI로 GitHub 저장소 수집 (data/raw/github/)
npm run collect:skillssh  # `npx skills search`로 skills.sh 스킬 수집 (data/raw/skillssh/)
npm run classify          # taxonomy.mjs 키워드로 자동 분류 → data/catalog.json
npm run build:catalog     # CATALOG.md 생성
```

`gh` CLI가 로그인되어 있어야 하고(`gh auth status`), Node.js 18+ 가 필요하다.

## 수집 범위 (Phase 1)

- **GitHub**: 18개 시드 토픽(`agent-skills`, `ai-agents`, `mcp-server`, `rag`, `terraform` 등)으로 검색, stars 30개 이상
- **skills.sh**: 22개 키워드(부서별 대표 키워드)로 검색

전체가 아니라 12~13개 부서를 고르게 대표하는 표본이다. 시드를 `scripts/collect-*.mjs`에 추가하면 확장된다.

## 왜 Playwright 대신 gh CLI / skills CLI인가

처음엔 Playwright로 GitHub과 skills.sh를 직접 크롤링할 계획이었지만, 조사 결과:
- GitHub은 `gh` CLI(REST search API)가 이미 인증되어 있고 구조화된 JSON을 즉시 준다.
- skills.sh는 공개 REST API가 인증을 요구하지만, 공식 CLI(`npx skills search`)는 인증 없이 동일한 데이터를 준다.

둘 다 브라우저 렌더링 없이 더 가볍고 안정적으로 같은 데이터를 얻을 수 있어 이 방식을 택했다. (자세한 내용은 ARCHITECTURE.md 참고)

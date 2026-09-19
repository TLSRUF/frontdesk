# frontdesk (스킬)

<sub><a href="README.en.md">English</a> &middot; <a href="README.zh.md">中文</a></sub>

이 폴더는 [`SKILL.md`](SKILL.md)를 포함한, 다른 프로젝트에 그대로 설치 가능한 **자기완결적 스킬 패키지**다. 프로젝트 전체 배경과 설계 문서는 저장소 루트의 [`README.md`](../../README.md), [`ARCHITECTURE.md`](../../ARCHITECTURE.md)를 참고한다.

## 설치

```bash
npx skills add TLSRUF/frontdesk@frontdesk
```

또는 git URL로 직접 설치해도 된다 (실제로 둘 다 동작 확인함):

```bash
npx skills add https://github.com/TLSRUF/frontdesk
```

skills.sh에는 별도의 심사/등재 절차가 없다 — 공개 저장소에 `SKILL.md`만 있으면 위 명령으로 누구나 바로 설치 가능하고, 리더보드 노출은 실제 설치 텔레메트리를 따르는 것으로 보인다(`vercel-labs/skills` 저장소 확인, 자세한 내용은 [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) 참고).

설치되면 Claude가 "이 작업에 맞는 기존 스킬/도구가 있나?" 같은 상황에서 자동으로 이 스킬을 참고한다. 수동으로 확인하려면:

```bash
node scripts/route.mjs "recommend a testing automation tool"
```

## 이 폴더의 구성

- `SKILL.md` — Claude(또는 다른 에이전트)가 읽는 실제 스킬 정의
- `taxonomy.mjs` — 13개 부서 분류 체계
- `data/catalog.json` — 분류된 카탈로그 원본 (1,311건)
- `scripts/` — 수집(`collect-*.mjs`) → 분류(`classify.mjs`) → 보강(`enrich-descriptions.mjs`) → 문서화(`build-catalog-md.mjs`) → 라우팅(`route.mjs`) → 벤치마크(`benchmark.mjs`) → 스타터팩(`pick-best-of-breed.mjs`, `install-starter-pack.mjs`) → 파이프라인(`pipeline.mjs`)
- `CATALOG.md` — 사람이 읽는 카탈로그 전체 목록
- `BENCHMARK.md` — 분류 정확도/오탐률 벤치마크와 비슷한 프로젝트와의 규모 비교
- `data/starter-pack.json` — 부서별 대표 스킬 목록 (`npm run starter-pack`으로 재생성)
- `data/starter-pack-llm-judge.json` — 그 12개 픽을 실제 SKILL.md 내용 기준으로 채점한 결과 (installs 1위가 항상 최선은 아니라는 사례 포함)

카탈로그를 최신화하려면 `npm run all`, 벤치마크는 `npm run benchmark`, 스타터팩 설치는 `node scripts/install-starter-pack.mjs --yes`, 파이프라인은 `node scripts/pipeline.mjs "프로젝트 설명"` (저장소 루트 README 참고).

---
name: frontdesk
description: Routes a task (idea validation, pricing, marketing copy, SEO, UX/design, frontend/backend/infra engineering, testing, security, sales, ops, etc.) to the narrowest matching skill or tool from a curated 1,300+ entry catalog of AI agent skills, before reaching for a heavy general-purpose agent or multi-agent swarm. Use when the user describes a task and asks "is there already a skill/tool for this", wants a recommendation for which existing agent/skill to use, or when deciding whether spinning up a specialized sub-agent is actually warranted for a simple request.
license: MIT
---

# frontdesk

이 스킬은 코드를 쓰기 전에 "이게 정말 필요한가"를 묻는 [ponytail](https://github.com/DietrichGebert/ponytail)의 판단 사다리를, "무거운 에이전트를 부를지 말지" 판단에 적용한 것이다. 목표는 같다: 필요 이상으로 큰 걸 부르지 않는다.

## 언제 쓰는가

사용자가 어떤 작업(가격 정책, 마케팅 카피, SEO, UX 와이어프레임, 프론트/백엔드, 인프라, 테스트, 보안, 세일즈, 문서화, 채용 등)을 요청했고, 그걸 처음부터 직접 다 만들기 전에 **이미 존재하는 좁은 범위의 스킬/도구로 해결되는지** 먼저 확인하고 싶을 때 이 스킬을 쓴다. 특히 범용 에이전트나 멀티에이전트 스웜을 부르기 직전에, 정말 그게 필요한지 판단하는 게이트로 쓴다.

## 판단 사다리

```
1. 이미 캐시된 답이 있는가?                → 재사용, 아무 것도 호출하지 않음
2. 카탈로그의 좁은 스킬 하나로 되는가?      → 그 스킬 하나만 추천
3. 여러 부서 스킬을 순차 조합해야 하는가?   → 필요한 스킬들만 순서대로 추천
4. 정말 새로운 판단/창작이 필요한가?        → 직접 처리하거나 범용 에이전트 사용
```

## 사용 방법

1. 먼저 결정적이고 토큰을 쓰지 않는 1차 필터를 돌린다:

   ```bash
   node scripts/route.mjs "<사용자 작업을 요약한 영어 문장>"
   ```

   이 스크립트는 `data/catalog.json`(1,300여 건, GitHub + skills.sh에서 수집해 13개 부서로 분류됨)을 키워드로 매칭해 1~4단계 중 어디에 해당하는지, 그리고 후보 스킬(이름 + 링크)을 알려준다. **결과를 읽기만 하면 되고, `data/catalog.json`이나 `CATALOG.md` 전체를 컨텍스트에 읽어들일 필요는 없다** — 그게 이 스크립트를 두는 이유다.

2. 스크립트가 2단계(단일 카테고리) 또는 3단계(다중 카테고리)로 후보를 반환하면, 그 카테고리 이름과 후보 목록을 사용자에게 보여주고 어떤 걸 쓸지 확인한다. 설치 명령은 항목 종류에 따라 다르다:
   - `owner/repo@skill` 형태 (skills.sh 스킬): `npx skills add owner/repo@skill`
   - GitHub 저장소: `git clone <url>`

3. 스크립트가 **4단계**(매칭 0건)를 반환해도 곧바로 "카탈로그에 없다"고 단정하지 말 것. 이 스크립트는 영어 키워드만 매칭하는 규칙 기반이라 다음과 같은 경우 false negative가 흔하다:
   - 요청이 한국어 등 비영어로 되어 있음 (영어로 바꿔서 한 번 더 시도해볼 것)
   - 의역/패러프레이즈되어 키워드가 문자 그대로 나타나지 않음

   이럴 땐 `taxonomy.mjs`의 13개 부서 목록을 직접 훑어보고(그 자체는 짧다, 전체 카탈로그를 읽을 필요 없음) 의미상 맞는 부서가 있는지 판단한 뒤, 필요하면 `CATALOG.md`에서 그 부서 섹션만 찾아 읽는다. 그래도 없으면 그때 "기존 스킬 없음 → 직접 처리 / 범용 에이전트"로 결론 내린다.

4. 최종 추천은 **항상 가장 좁은 것부터** 제시한다. 카탈로그에 있는 스킬 하나로 되는 일에 멀티에이전트 스웜이나 풀스택 서브에이전트를 부르는 건, ponytail이 경계하는 "date picker에 flatpickr 설치하기"와 같은 과잉설계다.

## 스타터팩: 부서별 대표 스킬 한 번에 설치

"이거 하나만 설치하면 부서별로 제일 나은 스킬들이 알아서 다 갖춰졌으면 좋겠다"는 요청에는 이 기능을 쓴다. `data/starter-pack.json`에 13개 부서 중 신뢰도 높게 분류된(= weak_match 아닌) `type: skill` 항목 중 **설치 수(installs) 1위**를 부서마다 하나씩 골라뒀다 (현재 12개 부서에 픽이 있다 — 13번 부서는 확실한 후보가 없어 비어 있다).

**정직하게 짚을 것: 이건 "가장 성능이 뛰어난" 스킬이 아니라 "가장 많이 설치된" 스킬이다.** 실제 품질/성능을 측정할 방법이 없어서 installs를 대리 지표로 쓴 것뿐이다 (BENCHMARK.md 참고). 사용자에게 이 사실을 숨기지 말 것.

```bash
node scripts/install-starter-pack.mjs            # --yes 없이 실행하면 뭘 설치할지 미리보기만 함
node scripts/install-starter-pack.mjs --yes      # 실제로 12개 저장소를 npx skills add로 설치
```

**설치 전에 반드시 미리보기(첫 번째 명령)로 무엇이 설치되는지 사용자에게 먼저 보여주고 확인을 받는다.** `skills` CLI 자신도 "이 스킬들은 full agent permission으로 실행되니 쓰기 전에 검토하라"고 경고한다 — 서드파티 저장소 12개를 사용자 모르게 조용히 설치하지 않는다. 세부분야(약 57개) 단위로 더 촘촘하게 고르고 싶으면 `node scripts/pick-best-of-breed.mjs --per=category`로 `data/starter-pack.json`을 다시 만들면 된다.

## 파이프라인: 아이디어부터 배포/운영까지

"이 프로젝트를 아이디어부터 배포·운영까지 순서대로 진행하고 싶다"는 요청에는 8단계 파이프라인을 쓴다 (아이디어/전략 → 프로덕트 정의 → 디자인 → 개발 → 품질/보안 → 마케팅/세일즈 → 배포 → 운영). 새 오케스트레이션 엔진이 아니라 위 라우팅 로직을 부서 단위로 제한해서 재사용한 것이다.

```bash
node scripts/pipeline.mjs "프로젝트를 한두 문장으로 설명"              # 8단계 전체 로드맵 미리보기
node scripts/pipeline.mjs "프로젝트 설명" --stage=3                   # 특정 단계만 (예: 3=디자인)
```

**진행 방식(사람 확인이 핵심이다):**
1. 먼저 전체 로드맵(8단계)을 한 번 보여줘서 사용자가 전체 그림을 보게 한다.
2. 그다음 **한 단계씩** `--stage=N`으로 자세히 보여주고, 후보 스킬 중 뭘 쓸지 사용자에게 확인받는다.
3. 사용자가 승인하면 그 단계를 진행(해당 스킬 설치/적용)하고, **다음 단계로 넘어가기 전에 다시 확인받는다.** 특히 7단계(배포)와 8단계(운영)는 실제 서비스에 영향을 줄 수 있으므로 절대 확인 없이 자동으로 넘어가지 않는다.
4. 이 스크립트는 추천만 한다 — 실제 배포 자격증명/인프라 접근은 이 스킬의 범위 밖이다. 배포/운영 단계에서 구체적으로 뭘 어떻게 할지는 그 단계에서 고른 스킬(예: terraform, CI/CD 스킬)의 지시를 따른다.

**한계**: 각 단계의 세부분야 선택은 프로젝트 설명 + 단계별 기본 키워드로 결정되는데, 프로젝트 설명이 짧거나 그 부서의 키워드를 안 담고 있으면 단계별 기본값(예: 1단계는 기본적으로 "프라이싱 전략" 쪽으로 치우침)에 크게 좌우된다. 사용자에게 "이 단계에서 특별히 원하는 방향이 있냐"고 먼저 물어보는 게 낫다.

## 데이터가 오래됐다면

`data/catalog.json`은 특정 시점의 스냅샷이다. 최신화하려면 이 스킬 폴더 안에서:

```bash
npm run all   # collect:github → collect:skillssh → classify → enrich → build:catalog → starter-pack
```

`gh` CLI 로그인이 필요하다 (`gh auth status`). 자세한 파이프라인 설명은 [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)와 프로젝트 루트 [`README.md`](../../README.md)를 참고한다.

## 알려진 한계

- 키워드 매칭은 영어 전용이다 (위 3번 참고)
- 순위는 여전히 `stars`/`installs`(인기도) 기준이다 — `health_score`(archived·라이선스·fork 여부)로 방치된 저장소는 걸러내지만, 그 필터를 통과한 후보들 사이의 순서는 인기 ≠ 성능이라는 한계가 그대로 있다
- 카탈로그는 13개 부서 시드로 수집한 대표 표본이지 전수 조사가 아니다
- 파이프라인의 단계별 추천은 프로젝트 설명이 짧을수록 단계별 기본 키워드에 좌우된다
- 스타터팩/파이프라인 모두 서드파티 저장소를 그대로 신뢰한다 — 이 프로젝트가 그 코드를 검증한 게 아니다

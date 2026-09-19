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

## 데이터가 오래됐다면

`data/catalog.json`은 특정 시점의 스냅샷이다. 최신화하려면 이 스킬 폴더 안에서:

```bash
npm run all   # collect:github → collect:skillssh → classify → enrich → build:catalog
```

`gh` CLI 로그인이 필요하다 (`gh auth status`). 자세한 파이프라인 설명은 [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)와 프로젝트 루트 [`README.md`](../../README.md)를 참고한다.

## 알려진 한계

- 키워드 매칭은 영어 전용이다 (위 3번 참고)
- `stars`/`installs`만으로 순위를 매기므로 인기 ≠ 품질일 수 있다
- 카탈로그는 13개 부서 시드로 수집한 대표 표본이지 전수 조사가 아니다

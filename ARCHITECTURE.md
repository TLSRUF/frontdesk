# 통합 AI 개발 툴 — 아키텍처 비전 (Phase 1~4 설계 문서)

이 문서는 [`skills/frontdesk/CATALOG.md`](skills/frontdesk/CATALOG.md)에 정리된 1,311개의 에이전트/스킬 데이터를 기반으로, "아이디어 → 수익모델 → 마케팅 → 디자인 → 개발"을 한 번에 처리하는 통합 AI 툴을 어떻게 만들지에 대한 설계 방향을 정리한다. Phase 2에서 판단 사다리의 규칙 기반 프로토타입(`skills/frontdesk/scripts/route.mjs`)까지 구현했고, Phase 3에서 이 전체를 [Agent Skills 스펙](https://skills.sh)에 맞춰 `skills/frontdesk/`로 패키징해 다른 프로젝트에 `npx skills add`로 설치 가능하게 만들었다. Phase 4에서 "부서별 대표 스킬 자동 설치(스타터팩)"와 "아이디어→배포/운영 8단계 파이프라인"을 추가했다 — 아래 "스타터팩"과 "파이프라인" 섹션 참고.

**Phase 4를 시작하게 된 계기**: "카탈로그+라우터"만으로는 원래 목표("이거 하나만 쓰면 상황에 맞는 최고의 스킬을 저절로 가져온다")에 못 미쳤다. 라우터는 *추천*만 했지 *설치*는 안 했고, 여러 단계를 잇는 파이프라인도 없었다. 이 문서 하단 "목표 대비 현황"에 그 간극을 정직하게 남겨둔다.

## 핵심 아이디어: 카탈로그 = 라우팅 테이블

통합 툴은 하나의 거대한 프롬프트로 모든 걸 처리하지 않는다. 대신:

1. 사용자의 요청("우리 서비스 가격 정책을 어떻게 잡아야 할까?")을 받으면
2. `taxonomy.mjs`(13개 부서 / ~57개 세부분야) 중 가장 가까운 카테고리를 찾고 (예: `1.4 프라이싱 전략`)
3. `data/catalog.json`에서 해당 카테고리의 상위 스킬/에이전트를 후보로 좁힌 뒤
4. 그중 가장 적합한 스킬 하나만 로드해서 실행한다.

즉 카탈로그는 "무엇이 존재하는가"의 목록이자 동시에 "이 상황엔 이걸 써라"는 라우팅 테이블 역할을 겸한다.

## ponytail식 판단 사다리를 "코드 작성"이 아니라 "에이전트 선택"에 적용

[ponytail](https://github.com/DietrichGebert/ponytail)은 코드를 쓰기 전에 "이게 정말 필요한가 → 이미 있는가 → 표준 라이브러리에 있는가 → 네이티브 기능인가 → 이미 설치된 의존성인가 → 한 줄로 되는가 → 그제서야 최소 구현"이라는 7단계 사다리를 거친다. 통합 툴의 오케스트레이터는 **같은 사다리를 "무거운 에이전트를 부를지 말지" 판단에 적용**한다:

```
요청이 들어왔을 때, 무거운 것부터 부르지 말고 아래 순서로 확인:

1. 이미 캐시된 답/이전 결과로 해결되는가?        → 재사용, 아무 것도 호출하지 않음
2. 카탈로그에 있는 좁은 범위의 단일 스킬 하나로 되는가? → 그 스킬 하나만 로드
3. 여러 부서 스킬을 순차 조합해야 하는가?          → 필요한 스킬들만 순서대로 로드
4. 정말 새로운 판단/창작이 필요한가?              → 범용 에이전트(LLM 직접 추론) 호출
5. 그것도 안 되면?                             → 사람에게 물어봄
```

이렇게 하면 "마케팅 카피 하나 써달라"는 요청에 풀스택 개발 에이전트나 멀티에이전트 스웜을 부르는 낭비(토큰 낭비이자 ponytail이 경계하는 "date picker에 flatpickr 설치하기"와 같은 과잉설계)를 막는다.

## 라우터 프로토타입 (`skills/frontdesk/scripts/route.mjs`)

위 5단계 사다리 중 1~4단계를 규칙 기반(키워드 매칭)으로 구현한 프로토타입이다. LLM 호출 없이 `taxonomy.mjs`의 키워드만으로 카테고리를 찾기 때문에 **이 단계 자체가 토큰을 전혀 쓰지 않는 가장 싼 필터** 역할을 한다 — 실제 오케스트레이터에서는 이 규칙 매칭이 먼저 시도되고, 실패했을 때만 LLM 분류(비용 발생)로 넘어가야 한다.

```bash
cd skills/frontdesk
node scripts/route.mjs "landing page needs SEO and an email newsletter"
# → 2단계, "9.1 마케팅/그로스 > SEO" 카테고리, 상위 후보 3개 제시
```

동작:
- **1단계(캐시)**: `skills/frontdesk/data/route-cache.json`에 정규화된 요청 텍스트를 키로 저장 — 동일 요청 재입력 시 아무 매칭도 다시 하지 않고 즉시 반환
- **2단계(단일 카테고리)**: 한 카테고리가 명확히 우세하면 그 카테고리의 인기 상위 3개 스킬을 추천
- **3단계(다중 카테고리)**: 여러 부서가 동률로 매칭되면(예: "테라폼도 짜고 마케팅 카피도 써줘") 부서별로 하나씩 순서대로 조합
- **4단계(범용 에이전트 필요)**: 매칭되는 카테고리가 하나도 없으면 "일반 에이전트 호출 필요"로 명시적으로 알림

### 프로토타입의 알려진 한계 (의도적으로 남겨둠)

- **영어 키워드만 매칭한다**: 데모에서 "가격 정책을 어떻게 잡아야 할까?"(한국어)는 4단계(매칭 없음 → 범용 에이전트)로 떨어지는데, 이건 의미상 진짜 새로운 판단이 필요해서가 아니라 `taxonomy.mjs` 키워드가 전부 영어라서다. 실제 오케스트레이터라면 이 지점에서 (a) 짧은 번역/키워드 추출 LLM 호출을 한 번 끼워 넣거나 (b) 다국어 키워드를 taxonomy에 추가해야 한다. 지금은 "규칙 매칭이 실패하면 일단 범용 에이전트로 넘긴다"는 안전한 fallback으로 남겨뒀다.
- **키워드 하나가 여러 의미를 가지면 오분류한다**: 처음엔 6.1 CI/CD에 "pipeline"이라는 단어 하나만 키워드로 넣었더니 "academic-pipeline"(학술 논문 파이프라인), "audio pipeline"(음성인식 파이프라인)까지 CI/CD로 잘못 묶였다. "deployment pipeline", "build pipeline"처럼 구체적인 구로 좁혀서 고쳤다 — 이 사례가 규칙 기반 분류의 근본적 약점을 보여준다: 키워드가 짧고 일반적일수록 넓은 리콜과 낮은 정밀도를 맞바꾼다. 다음 Phase에서 LLM 기반 분류로 갈아탈 때 이 트레이드오프가 사라진다.

## 스킬 패키징 (Phase 3): 왜 전부 `skills/frontdesk/` 안으로 옮겼나

애초엔 `scripts/`, `data/`, `taxonomy.mjs`가 저장소 루트에 있었다. 그런데 이 프로젝트 자체를 "ponytail처럼 남이 설치해서 쓰는 스킬"로 배포하기로 하면서, `npx skills add owner/repo@skill`나 Claude Code 플러그인 설치가 실제로 무엇을 복사해가는지 `anthropics/skills`, `vercel-labs/agent-skills` 저장소를 직접 열어 확인했다: **`skills/<name>/` 폴더 하나만** 자기완결적으로 복사된다 (그 폴더 밖의 파일은 따라오지 않는다). 그래서 라우터가 의존하는 모든 것(`taxonomy.mjs`, `data/catalog.json`, `scripts/*.mjs`)을 `skills/frontdesk/` 안으로 옮겼다. 저장소 루트에는 사람이 읽는 설계 문서(`README.md`, `ARCHITECTURE.md`, `LICENSE`)만 남긴다. 실제 스킬 정의는 [`skills/frontdesk/SKILL.md`](skills/frontdesk/SKILL.md).

## 스타터팩 (Phase 4): "설치하면 알아서 다 갖춰지는" 요청에 대한 답

`scripts/pick-best-of-breed.mjs`가 13개 부서마다 `type: skill`(=`npx skills add`로 바로 설치 가능)이면서 `weak_match`가 아닌(신뢰도 높게 분류된) 항목 중 **설치 수(installs) 1위**를 뽑아 `data/starter-pack.json`을 만든다. `scripts/install-starter-pack.mjs`가 그 목록을 실제로 `npx skills add`로 설치한다.

```bash
node scripts/pick-best-of-breed.mjs --per=department   # 부서당 1개 (기본, 12개 — 13번 부서는 확실한 후보 없음)
node scripts/pick-best-of-breed.mjs --per=category      # 세부분야(~57개)당 1개, 더 촘촘하지만 설치량도 많음
node scripts/install-starter-pack.mjs                   # 미리보기만 (기본)
node scripts/install-starter-pack.mjs --yes             # 실제 설치
```

**정직하게 짚어야 할 것: 이건 "가장 성능이 뛰어난" 스킬을 고르는 게 아니라 "가장 많이 설치된" 스킬을 고르는 것이다.** 성능/품질을 측정할 방법이 아직 없어서(ARCHITECTURE.md 다른 절 참고, "품질 필터링" 항목) installs를 대리 지표로 쓴다. `weak_match` 제외 필터는 실제로 효과가 있었다 — 처음 돌렸을 때 `7.3 RAG/벡터검색` 대표로 `microsoft/azure-skills@azure-storage`(순수 Azure Storage 문서 스킬, RAG와 무관)가 뽑혔는데, 이건 "rag" 검색 시드에 우연히 걸려 약하게 분류된 항목이었다. `weak_match` 항목을 제외하니 `wshobson/agents@prompt-engineering-patterns`처럼 실제로 그 부서에 맞는 항목이 뽑혔다.

이 작업 중에 분류기 자체의 구조적 약점도 하나 더 찾아 고쳤다: skills.sh 항목의 이름은 `owner/repo@skill` 형태인데, `github/awesome-copilot@pytest-coverage`(pytest 커버리지 도구)가 repo 이름에 들어있는 "awesome" 때문에 `13.1 큐레이션 목록`으로 강하게(weak_match=false) 오분류되고 있었다. repo 경로는 브랜딩성 단어를 포함하기 쉬워 신뢰도가 낮다고 보고, `scripts/classify.mjs`의 강한 매칭 단계에서는 `@` 뒤의 스킬 이름만 쓰고 repo 경로는 seed와 함께 약한 매칭에서만 쓰도록 고쳤다.

안전 노트: `install-starter-pack.mjs`는 기본적으로 미리보기만 하고 `--yes`를 명시해야 실제로 설치한다. `skills` CLI 자신도 설치 직후 "이 스킬들은 full agent permission으로 돌아가니 검토하라"고 경고하며, 실제로 스킬 설치 시 Socket/Snyk 같은 보안 스캔 결과를 같이 보여준다(직접 확인함) — 그 경고를 우회하지 않는 게 이 스크립트의 설계 원칙이다.

## 파이프라인 (Phase 4): 아이디어 → 배포 → 운영

`scripts/pipeline.mjs`는 새 오케스트레이션 엔진이 아니라 **기존 taxonomy/catalog/라우팅 로직을 부서 단위로 제한해서 재사용**한 8단계 워크플로다:

| 단계 | 이름 | 부서 |
|---|---|---|
| 1 | 아이디어/전략 | 1 |
| 2 | 프로덕트 정의 | 2 |
| 3 | 디자인 | 3 |
| 4 | 개발 | 4, 5, 6, 7 |
| 5 | 품질/보안 | 8 |
| 6 | 마케팅/세일즈 | 9, 10 |
| 7 | 배포 | 6 (CI/CD·IaC 중심) |
| 8 | 운영 | 6, 11 (관측·거버넌스 중심) |

각 단계는 그 부서로 범위를 제한한 `matchingCategories`(스킬 카탈로그 분류에 쓰는 것과 동일한 함수, `scripts/lib/classify-core.mjs`)를 단계별 기본 키워드 + 사용자의 프로젝트 설명으로 돌려서 가장 맞는 세부분야를 찾고, 그 안의 상위 후보를 보여준다.

```bash
node scripts/pipeline.mjs "AI 기반 레시피 추천 앱"              # 8단계 전체 로드맵
node scripts/pipeline.mjs "AI 기반 레시피 추천 앱" --stage=3    # 3단계(디자인)만
```

**자율성 수준(설계 결정)**: 배포/운영 단계는 실제 서비스에 영향을 줄 수 있어 **단계마다 사람이 확인하고 다음으로 넘어가는 것을 전제**로 설계했다 (전 구간 완전 자동 실행은 하지 않음). 이 확인 루프 자체는 스크립트가 아니라 `SKILL.md`의 지시에 따라 Claude가 대화로 수행한다 — "로드맵 먼저 보여주기 → 단계별로 자세히 보여주고 승인받기 → 승인 후에만 다음 단계"라는 순서를 SKILL.md에 명시해뒀다.

**알려진 한계**: 프로젝트 설명이 짧거나 그 부서 키워드를 담고 있지 않으면, 단계별 기본 시드 키워드가 결과를 지배한다 (예: "레시피 추천 앱"이라는 설명만으로는 1단계가 항상 "프라이싱 전략"으로 치우침 — 그 부서 시드 키워드 중 "pricing"이 가장 먼저 매칭되기 때문). 진짜 프로젝트별 맞춤 추천을 하려면 각 단계에서 사용자에게 좀 더 구체적인 방향을 물어보는 게 낫다.

## 저장소 건강도 (Phase 5): installs보다 조금 더 나은 랭킹 신호

installs/stars 하나만으로 순위를 매기는 게 계속 마음에 걸렸다. "성능"을 직접 측정하는 건 여전히 못 하지만(실제로 실행해서 결과물을 비교해야 함, 아래 "다음에 할 수 있는 일" 참고), 그 전 단계로 두 가지를 검토했다:

- **Reddit 언급 수**: 가장 유명한 두 사례(ponytail 14만 스타, headcount)로 먼저 실제 검색을 해봤는데, 셋 다 웹서치로 잡히는 Reddit 언급 자체가 없었다. 가장 화제였던 것도 안 잡히면 나머지 1,300여 건은 더 가망이 없다고 판단해 포기했다.
- **저장소 건강도**: 대신 GitHub API로 무료로, 실행 없이 얻을 수 있는 신호로 구성했다. `scripts/repo-health.mjs`가 카탈로그의 고유 저장소 977개 각각에 대해 `gh api repos/{owner}/{repo}`를 한 번씩 불러(캐시됨, 중단돼도 이어서 가능) 다음을 계산한다:

  ```
  health_score = 100 × (0.5×recency + 0.25×not_archived + 0.1×has_license + 0.15×adoption)
  ```
  - `recency`: 마지막 push가 30일 이내면 1.0, 이후 구간별로 감소, 2년 넘으면 0
  - `not_archived`: GitHub에서 archived 처리됐으면 0
  - `has_license`: 라이선스 파일 유무
  - `adoption`: fork 수를 로그 스케일로 (별점보다 fork가 "실제로 가져다 썼다"는 신호에 더 가깝다고 봄)

  **실측 결과, 중요한 한계를 하나 발견했다**: 점수 분포의 중앙값이 100점이다. 이 생태계 자체가 2026년 기준 매우 활발한 트렌드라 대부분의 저장소가 최근에 관리되고 있어서, `health_score`가 상위권 안에서는 거의 변별력이 없다(다들 100점). 그래서 이걸 **순위 매기는 용도가 아니라 걸러내는 용도**로 쓰기로 했다: `scripts/lib/ranking.mjs`의 `rankedCandidates()`가 `health_score < 40`(방치되었거나 라이선스도 없고 아무도 fork 안 한 것)인 항목을 후보에서 제외하고, 나머지는 여전히 installs/stars로 정렬한다. `route.mjs`, `pipeline.mjs`, `pick-best-of-breed.mjs`가 각자 구현하던 "카테고리 안에서 상위 후보 뽑기" 로직도 이 모듈로 통합했다.

  **정직하게**: 이건 "가장 인기 있는 것 중에 방치되지 않은 것"을 고르는 것이지, 여전히 "가장 성능이 뛰어난 것"을 고르는 게 아니다. 그래도 순수 인기도보다는 한 걸음 나은 필터다.

```bash
node scripts/repo-health.mjs   # 신규/누락된 저장소만 조회 (캐시: data/repo-health.json), catalog.json에 health_score 병합
```

## 목표 대비 현황 (정직하게)

애초 목표는 "이것 하나만 쓰면, 상황에 맞는 가장 좋은 스킬을 저절로 가져와서 아이디어부터 배포·운영까지 다 된다"였다. Phase 5까지의 현황:

| 목표 | 상태 |
|---|---|
| 이거 하나만 설치하면 됨 | ✅ 스킬 하나로 설치, SKILL.md가 Claude에게 우선 참고하도록 지시 |
| 상황에 맞는 스킬을 저절로 "가져옴"(설치까지) | 🟡 라우터(`route.mjs`)는 추천만 함. 스타터팩(`install-starter-pack.mjs`)은 실제 설치까지 하지만 "부서당 1개, 인기 기준"이라는 정해진 세트지, 매 상황에 맞춰 동적으로 고른 뒤 그때그때 설치하는 건 아직 아님 |
| **가장 성능이 뛰어난** 것으로 고름 | 🟡 Reddit 언급은 신호가 없어 포기. 저장소 건강도(archived·라이선스·fork)로 방치된 것은 걸러내지만, 나머지는 여전히 installs/stars로 정렬 — 진짜 성능 측정은 아님 |
| 아이디어→배포→운영 파이프라인 | ✅ 8단계 파이프라인 존재, 단 사람 확인 필수(전 자동 아님) — 이 프로젝트에서 원래 의도한 자율성 수준과 일치 |

## 데이터 흐름

```
GitHub (gh CLI)  ─┐
                   ├─→ data/raw/**  ─→ classify.mjs ─→ data/catalog.json ─→ enrich-descriptions.mjs (인기 항목 설명 보강)
skills.sh (skills CLI) ─┘                                      │                        │
                                                                 │                        └─→ CATALOG.md (사람용)
                                                                 └─→ route.mjs (규칙 기반 라우터, data/route-cache.json)
```

(모든 경로는 `skills/frontdesk/` 기준)

- **수집**: `scripts/collect-github.mjs`, `scripts/collect-skillssh.mjs` — 시드 키워드/토픽 기반, 확장 가능
- **분류**: `scripts/classify.mjs` — `taxonomy.mjs`의 키워드 힌트로 자동 분류(로직은 `scripts/lib/classify-core.mjs`에 공유), 실패 항목은 `data/unclassified.json`으로 격리해 수동 검토
- **설명 보강**: `scripts/enrich-descriptions.mjs` — skills.sh 검색 결과엔 설명이 없어, 인기 상위 N개의 실제 `SKILL.md`를 GitHub에서 가져와 frontmatter의 description을 채움
- **출력**: `scripts/build-catalog-md.mjs` — 부서별 마크다운 문서 생성 (약한 매칭은 ⚠로 표시)
- **라우팅**: `scripts/route.mjs` — 판단 사다리 프로토타입 (위 섹션 참고), Claude 입장에서 이 전체가 `SKILL.md`를 통해 노출됨

**중요한 실행 순서**: `classify.mjs`는 `data/raw/**`에서 매번 카탈로그를 통째로 재생성하므로, `enrich-descriptions.mjs`로 보강한 설명이 그다음 `classify` 실행 때 사라진다. 반드시 `classify → enrich → build:catalog` 순서로 실행해야 한다 (`npm run all`이 이 순서를 보장한다).

## 다음에 할 수 있는 일

1. **LLM 기반 분류로 전환**: 키워드 매칭의 한계(다국어, 다의어)를 넘으려면 규칙 매칭 실패 시에만 LLM 호출로 넘어가는 하이브리드 구조가 필요
2. ~~품질 필터링~~ ✅ **완료 (Phase 5)**: `scripts/repo-health.mjs`가 라이선스·최근 커밋·archived 여부·fork 수로 `health_score`를 계산해 방치된 저장소를 걸러냄 (위 "저장소 건강도" 섹션)
3. **설명 보강 확대**: 현재 인기 상위 80개만 보강됨 — 나머지 skills.sh 항목(600여 건)도 우선순위를 낮춰 점진적으로 보강
4. **커버리지 확장**: 현재 27개 GitHub 시드 + 36개 skills.sh 키워드로 1,311건 확보 — 여전히 얇은 부서가 있다면 시드 추가
5. **남은 미분류 23건 재검토**: 대부분 이름만으로는 분야를 알 수 없는 범용 도구(harness, terminal utility 등) — 새 카테고리보다는 그냥 수동 태깅이 나을 수 있음
6. ~~실제 설치 검증~~ ✅ **완료**: `npx skills add TLSRUF/frontdesk@frontdesk`와 `npx skills add https://github.com/TLSRUF/frontdesk` 둘 다 실제로 설치되는 것을 확인함(별도 빈 디렉터리에서 실제 실행). Claude Code가 description만으로 알아서 트리거하는지는 아직 실전 세션에서 검증 안 함 — 이건 여전히 남은 항목.
7. ~~skills.sh 등재~~ **조사 완료, 별도 등재 절차 없음**: `vercel-labs/skills`(skills.sh 공식 CLI) 저장소를 확인한 결과 PR/심사 큐 같은 제출 절차는 없다. 공개 GitHub 저장소에 `SKILL.md`만 있으면 누구든 `npx skills add`로 즉시 설치 가능하고, 웹사이트 리더보드는 실제 설치 텔레메트리 기반으로 보인다(문서로 100% 확정하지는 못함). 즉 "심사받아 등재"가 아니라 "실제로 쓰이면 자연히 리더보드에 노출"되는 구조로 추정됨.
8. **스타터팩을 "그때그때 동적 설치"로 발전**: 지금은 "부서당 인기 1위, 고정 세트"를 미리 설치하는 방식이다. 실제 목표("상황에 맞게 저절로 가져옴")에 더 가까우려면, `route.mjs`가 2/3단계 후보를 반환했을 때 그 자리에서 바로(사용자 확인 후) `npx skills add`까지 실행하는 경로를 추가하는 게 다음 단계
9. **진짜 성능 측정**: 저장소 건강도는 "방치 여부"만 걸러내지 실제 코드/스킬 품질은 안 잰다. 다음 후보:
   - skills CLI가 설치 시 보여주는 Socket/Snyk/Gen 보안 스캔 결과를 데이터로 끌어와 신뢰도 신호에 추가
   - 스타터팩처럼 범위가 좁을 때(부서당 1개)는 LLM이 SKILL.md 내용의 명확성/실행가능성을 채점(LLM-as-judge)
   - 가장 확실하지만 가장 비싼 방법: 표준 작업 하나를 정해 후보 스킬들로 실제 실행시켜 결과물을 비교

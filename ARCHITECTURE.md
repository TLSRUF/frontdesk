# 통합 AI 개발 툴 — 아키텍처 비전 (Phase 1~10 설계 문서)

이 문서는 [`skills/frontdesk/CATALOG.md`](skills/frontdesk/CATALOG.md)에 정리된 1,348개의 에이전트/스킬 데이터를 기반으로, "아이디어 → 수익모델 → 마케팅 → 디자인 → 개발"을 한 번에 처리하는 통합 AI 툴을 어떻게 만들지에 대한 설계 방향을 정리한다. Phase 2에서 판단 사다리의 규칙 기반 프로토타입(`skills/frontdesk/scripts/route.mjs`)까지 구현했고, Phase 3에서 이 전체를 [Agent Skills 스펙](https://skills.sh)에 맞춰 `skills/frontdesk/`로 패키징해 다른 프로젝트에 `npx skills add`로 설치 가능하게 만들었다. Phase 4에서 "부서별 대표 스킬 자동 설치(스타터팩)"와 "아이디어→배포/운영 8단계 파이프라인"을 추가했고, Phase 5에서 저장소 건강도 필터를, Phase 6에서 라우터에 `--install`(요청별 즉시 설치)을, Phase 7에서 보안 감사 점수(audit_score) 필터를, Phase 8에서 스타터팩 픽에 대한 LLM 채점을, Phase 9에서 미분류 항목 수동 분류(`manual-overrides.json`)를, Phase 10에서 owner 범위 수집으로 외부 카탈로그(Shubhamsaboo/awesome-llm-apps)를 흡수하며 반복되는 repo-경로 오분류 버그를 근본적으로 고쳤다 — 아래 각 섹션 참고.

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
node scripts/pick-best-of-breed.mjs --per=department   # 부서당 1개 (기본, 13개 부서 전부 — Phase 10에서 13번 부서 픽도 채움)
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

## 보안 감사 점수 (Phase 7): health_score보다 변별력 있는 신호를 찾음

`npx skills add`로 실제 설치할 때 CLI가 "Security Risk Assessments" 표(Gen/Socket/Snyk)를 보여주는 걸 이전부터 봤었다 — 이걸 데이터로 끌어올 수 있는지 확인하려고 `vercel-labs/skills`(skills CLI 자체)의 소스코드(`src/telemetry.ts`)를 읽었더니, **인증 없이 공개로 열려 있는 엔드포인트**를 찾았다:

```
GET https://add-skill.vercel.sh/audit?source=<owner>/<repo>&skills=<slug1,slug2,...>
```

`scripts/audit-scores.mjs`가 스킬을 보유한 고유 저장소 322개 각각에 대해(그 저장소의 스킬 slug를 콤마로 묶어 한 번에) 이 API를 호출해(캐시됨: `data/audit-scores.json`) `ath`/`socket`/`snyk`/`zeroleaks` 네 파트너의 위험도(`safe`~`critical`)를 0~100 점수로 바꾼 뒤 평균해 `audit_score`로 저장한다.

**첫 시도에서 322개 중 262개가 HTTP 429(rate limit)로 실패했다** — 요청 사이에 지연을 전혀 안 뒀기 때문. 요청 사이 250ms 지연 + 429 발생 시 지수 백오프(1s→2s→4s→8s) 재시도를 추가하니 322개 중 3개만 실패로 줄었다.

**health_score와 달리 이건 실제로 변별력이 있었다**: 622건에 대해 최소 8.3점, 중앙값 91.7점, 최고 93.8점으로 분포가 넓게 퍼져 있다 — 예를 들어 `danzam98/claude-skills-toolkit@saas-billing-patterns-for-stripe-and-paypal`은 8.3점으로 실제 위험 신호가 뚜렷했다. 그래도 이 역시 health_score와 같은 원칙으로 쓴다: `scripts/lib/ranking.mjs`에 `isSafe()`를 추가해 `audit_score < 50`인 항목을 후보에서 제외하는 **필터**로만 쓰고, 순위는 여전히 installs/stars다.

**정직하게**: 이건 "이 스킬이 안전한가"를 재는 것이지 여전히 "이 스킬이 일을 잘하는가"를 재는 게 아니다. 코드에 알려진 취약점이 없다는 것과 작업을 잘 해낸다는 것은 다른 얘기다. 하지만 stars/installs/health_score보다 한 걸음 더 실질적인 신뢰 신호이고, 최소한 "위험한 코드는 아니다"는 것 하나는 확인해준다.

```bash
node scripts/audit-scores.mjs   # 신규/누락된 저장소만 조회, catalog.json에 audit_score 병합
```

## LLM 채점 (Phase 8): installs 1위가 항상 최선은 아니라는 걸 직접 확인함

health_score와 audit_score는 둘 다 "걸러내는" 용도지 "이게 좋다"고 판단하는 용도는 아니다. 진짜 "이 스킬이 명확하고 실행 가능한가"를 보려면 내용을 읽고 판단해야 한다 — 그래서 스타터팩의 12개 픽(부서당 1개, 범위가 좁아서 비용이 감당됨) 각각의 실제 `SKILL.md` 전문을 가져와 직접 읽고 명확성·실행가능성·범용성 기준으로 1~10점을 매겼다 (`data/starter-pack-llm-judge.json`).

**결과, 평균 7.9점이었고 흥미로운 불일치를 하나 발견했다**: `larksuite/cli@lark-okr`(프로덕트 매니지먼트 부서 픽, installs 378,900으로 그 부서 1위)이 6점으로 가장 낮았다 — 잘 만들어진 스킬이지만 Lark/Feishu라는 특정 상용 플랫폼의 `lark-cli` 바이너리에 종속된 좁은 래퍼이고 중국어로 작성돼 있어서, "프로덕트 매니지먼트 부서를 대표하는 범용 스킬"로는 부적합하다. 반대로 9점을 받은 4개(`pricing`, `vercel-react-best-practices`, `webapp-testing`, `seo-audit`)는 installs도 높고 범용성도 높아 대체로 일치했다 — 즉 인기와 실제 유용성의 괴리는 "특정 플랫폼에 종속된 스킬이 그 플랫폼 사용자들 사이에서만 installs가 몰린 경우"에 두드러지는 것으로 보인다.

**이 채점으로 실제 스타터팩 선정 로직을 바꾸지는 않았다** — 이번 범위는 "이미 뽑힌 픽을 채점해서 한계를 확인"하는 것이었지 "재선정"이 아니었다. 부서당 후보 1개만 봐서는 "이게 그 부서에서 제일 나은가"는 판단할 수 없고 "이게 괜찮은가"만 판단할 수 있다 — 재선정까지 하려면 부서당 상위 3~5개를 전부 채점해서 비교해야 공정하다(다음 후보로 남겨둠).

**이 방법의 한계**: 1,348건 전체에 적용하기엔 비용이 크다(각 항목의 SKILL.md를 실제로 읽어야 함). 스타터팩처럼 범위가 좁을 때만 현실적이다. 또한 이건 한 세션에서 한 번 수행한 정성 평가이지, 재현 가능한 정량적 벤치마크가 아니다(BENCHMARK.md의 정량 벤치마크와는 성격이 다르다).

## 외부 카탈로그 조사: Shubhamsaboo/awesome-llm-apps (Phase 10)

사용자가 [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps)(139K★, 트렌드 1위)를 가져와서 방향성이 맞는지 보고 참고할 게 있으면 업그레이드하자고 요청해서 조사했다.

**방향성 평가**: 절반만 맞는다. 이 저장소의 대부분(`starter_ai_agents/`, `advanced_ai_agents/`, `always_on_agents/` — 100개 넘는 Python 예제 앱)은 **클론해서 돌려보는 예제/튜토리얼 모음**이지, frontdesk처럼 "설치 하나로 좁은 작업에 바로 쓰는 스킬"이 아니다. 하지만 `agent_skills/` 계열은 정확히 우리와 같은 종류다 — 실제 설치 가능한 Claude Skill이고, skills.sh에 `owner/repo@skill` 형태로 정식 인덱싱되어 있었다.

**실제로 가져온 것**: GitHub 콘텐츠 API로 본 `agent_skills/` 폴더에는 8개만 보였지만, skills.sh CLI로 조회하니 이 저장소(및 같은 작성자의 `taste-skill` 저장소)에 **25개 이상**의 설치 가능한 스킬이 있었다(fullstack-developer 8K설치, academic-researcher 6.8K, code-reviewer 4.6K 등) — 우리 기존 36개 키워드 시드로는 이런 니치한 이름을 못 찾았을 것들이다. 이걸 계기로 `scripts/collect-skillssh.mjs`에 **owner 범위 검색**(`npx skills find <query> --owner <owner>`)을 새로 추가했다 — 앞으로 다른 다작 작성자의 스킬을 찾을 때도 재사용 가능한 일반적인 수집 능력이 됐다.

**이 과정에서 실제로 버그를 하나 더 찾아 고쳤다**: skills.sh 검색 결과는 설명(description)이 항상 비어 있는데, 이런 항목이 많은 저장소를 한꺼번에 수집하니 `weak_match` 폴백 단계에서 repo 경로("awesome-llm-apps"의 "awesome")가 다시 문제를 일으켰다 — `technical-writer`, `python-expert`처럼 설명도 없고 특정 키워드와도 안 맞는 스킬 15개가 전부 "13.1 큐레이션 목록"으로 잘못 분류됐다. 이건 예전에 `github/awesome-copilot@pytest-coverage` 사례로 이미 한 번 겪었던 문제가 다른 형태로 재발한 것이다. 근본 원인(repo 경로는 못 믿는다)에 맞게, 이번엔 repo 경로를 강한 매칭뿐 아니라 **약한 매칭에서도 아예 제외**했다 — `hesreallyhim/awesome-claude-code`처럼 실제로 설명에 "awesome"이 들어있는 진짜 큐레이션 리스트는 여전히 정확히 분류되는 것도 확인했다(회귀 없음).

**결과**: 25건 신규 수집 중 5건은 키워드로 자동 분류(ux-designer, code-reviewer, advisor-orchestrator-worker 등), 16건은 이름과 실제 용도를 읽고 `manual-overrides.json`에 직접 분류(project-graveyard → 11.1 프로젝트 관리, scope-creep-detector/commit-archaeologist/dependency-doctor → 8.2 코드 리뷰, thinking-out-loud → 13.4 등), 4건(fullstack-developer, python-expert, academic-researcher, editor)은 여러 부서에 걸치거나 너무 일반적이라 억지로 분류하지 않고 미분류로 남겼다. 카탈로그가 1,325건 → **1,348건**으로 늘었고, 부수적으로 **스타터팩 13번 부서(AI 에이전트 생태계/메타 도구)의 빈자리도 처음으로 채워졌다**(`shubhamsaboo/awesome-llm-apps@thinking-out-loud`).

## 목표 대비 현황 (정직하게)

애초 목표는 "이것 하나만 쓰면, 상황에 맞는 가장 좋은 스킬을 저절로 가져와서 아이디어부터 배포·운영까지 다 된다"였다. Phase 5까지의 현황:

| 목표 | 상태 |
|---|---|
| 이거 하나만 설치하면 됨 | ✅ 스킬 하나로 설치, SKILL.md가 Claude에게 우선 참고하도록 지시 |
| 상황에 맞는 스킬을 저절로 "가져옴"(설치까지) | ✅ `route.mjs --install`이 요청마다 맞는 스킬을 찾아 그 자리에서 설치한다(사용자 확인 후). 스타터팩은 별도로 "부서당 1개, 인기 기준" 고정 세트를 미리 까는 보완적 경로로 남아있음 |
| **가장 성능이 뛰어난** 것으로 고름 | 🟡 Reddit 언급은 신호가 없어 포기. 저장소 건강도 + 보안 감사로 방치/위험한 것은 걸러내지만, 통과한 후보들 사이는 여전히 installs/stars로 정렬. 스타터팩 12개를 LLM으로 채점해보니 실제로 installs 1위가 최선이 아닌 사례(lark-okr, 특정 플랫폼 종속)를 확인함 — "안전하고 인기 있는 것"이지 진짜 성능 측정은 아직 아님, 재선정까지는 안 함 |
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

1. ~~LLM 기반 분류로 전환~~ **검토 완료, 현재 방식 유지로 결정**: `route.mjs` 자체에 API 호출을 넣는 "진짜" 하이브리드도 고려했지만, Claude Code 안에서 쓸 땐 이미 Claude가 곁에 있어서 스크립트가 별도로 LLM을 또 부르는 게 이 프로젝트의 "불필요하게 무거운 걸 부르지 마라"는 철학과 어긋난다. 대신 SKILL.md가 "4단계(매칭 실패) 시 Claude가 직접 taxonomy.mjs를 훑어보라"고 지시해 **추가 비용 없이** 같은 효과를 낸다. Claude 없이 순수 CLI로만 쓰는 경우(CI 등)를 위한 진짜 API 통합은 필요해지면 재검토
2. ~~품질 필터링~~ ✅ **완료 (Phase 5)**: `scripts/repo-health.mjs`가 라이선스·최근 커밋·archived 여부·fork 수로 `health_score`를 계산해 방치된 저장소를 걸러냄 (위 "저장소 건강도" 섹션)
3. **설명 보강 확대**: 현재 인기 상위 80개만 보강됨 — 나머지 skills.sh 항목(600여 건)도 우선순위를 낮춰 점진적으로 보강
4. ~~커버리지 확장~~ 🟡 **진행 중**: 27개 GitHub 시드 + 36개 skills.sh 키워드 + owner 범위 검색(Phase 10)으로 1,348건 확보. Owner 범위 검색을 다른 다작 스킬 작성자에게도 반복 적용하면 더 늘어날 여지가 있음
5. ~~남은 미분류 23건 재검토~~ ✅ **완료 (Phase 9)**: 23건을 직접 읽고 14건은 `data/manual-overrides.json`(키워드 매칭이 놓친 항목을 사람이 직접 분류하는, `classify.mjs`가 자동 매칭보다 우선 적용하는 예외 목록)으로 분류했다(archify/diagram-design → 11.2 문서화, atlas/cc-switch → 13.5 세션 유틸리티, ORG2/harness/CLIProxyAPI → 13.2 에이전트 하네스, i-have-adhd → 13.4 IDE 컨벤션, arscontexta → 12.3 메모리, rig → 12.4 멀티에이전트 프레임워크, flowy → 4.1 프론트엔드, skills/agent-skills/baoyu-skills → 13.1 큐레이션 목록). 남은 9건(Open-ClaudeCode, embeddedskills, terminal-browser, engram, python-for-devops, webhook, n8n-data-manager, wsbalancer, llm-action)은 임베디드 개발·연구 아카이브·학습 플랫폼·순수 인프라 유틸리티 등 이 taxonomy의 13개 부서 어디에도 깔끔하게 안 맞아 의도적으로 미분류로 남겼다. 카탈로그 1,348건 분류, 새 카테고리를 늘리는 대신 예외 목록으로 처리하는 패턴을 마련해뒀다.
6. ~~실제 설치 검증~~ ✅ **완료**: `npx skills add TLSRUF/frontdesk@frontdesk`와 `npx skills add https://github.com/TLSRUF/frontdesk` 둘 다 실제로 설치되는 것을 확인함(별도 빈 디렉터리에서 실제 실행). Claude Code가 description만으로 알아서 트리거하는지는 아직 실전 세션에서 검증 안 함 — 이건 여전히 남은 항목.
7. ~~skills.sh 등재~~ **조사 완료, 별도 등재 절차 없음**: `vercel-labs/skills`(skills.sh 공식 CLI) 저장소를 확인한 결과 PR/심사 큐 같은 제출 절차는 없다. 공개 GitHub 저장소에 `SKILL.md`만 있으면 누구든 `npx skills add`로 즉시 설치 가능하고, 웹사이트 리더보드는 실제 설치 텔레메트리 기반으로 보인다(문서로 100% 확정하지는 못함). 즉 "심사받아 등재"가 아니라 "실제로 쓰이면 자연히 리더보드에 노출"되는 구조로 추정됨.
8. ~~스타터팩을 "그때그때 동적 설치"로 발전~~ ✅ **완료 (Phase 6)**: `route.mjs`에 `--install` 플래그를 추가했다. 기본 실행(플래그 없이)은 여전히 추천만 하고, 사용자가 승인한 뒤 **같은 명령에 `--install`만 붙여 재실행**하면 캐시된 결과를 그대로 써서(재매칭 없이) `type: "skill"` 후보를 `npx skills add`로 그 자리에서 설치한다. `type: "github-repo"` 후보는 Agent Skills 스펙을 따른다는 보장이 없어 자동 설치하지 않고 `git clone` 안내만 한다(실제로 "terraform infra and seo copywriting" 같은 혼합 질의로 3단계 경로까지 검증함 — hashicorp/terraform은 clone 안내로, skills.sh 항목 2개는 실제 설치로 정확히 갈렸다).
9. **진짜 성능 측정**: 저장소 건강도(health_score)와 보안 감사(audit_score, Phase 7)는 "방치되지 않았고 위험하지 않은가"만 걸러내지 실제 코드/스킬이 작업을 잘 해내는지는 여전히 안 잰다. 다음 후보:
   - ~~skills CLI가 설치 시 보여주는 Socket/Snyk/Gen 보안 스캔 결과를 데이터로 끌어와 신뢰도 신호에 추가~~ ✅ **완료 (Phase 7)**: 위 "보안 감사 점수" 섹션
   - ~~스타터팩처럼 범위가 좁을 때(부서당 1개)는 LLM이 SKILL.md 내용의 명확성/실행가능성을 채점(LLM-as-judge)~~ ✅ **완료 (Phase 8)**: 위 "LLM 채점" 섹션 — installs 1위가 항상 최선이 아니라는 실제 사례(lark-okr)를 찾음
   - 가장 확실하지만 가장 비싼 방법: 표준 작업 하나를 정해 후보 스킬들로 실제 실행시켜 결과물을 비교 — 아직 안 함

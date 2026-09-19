# 통합 AI 개발 툴 — 아키텍처 비전 (Phase 1~2 설계 문서)

이 문서는 [`skills/frontdesk/CATALOG.md`](skills/frontdesk/CATALOG.md)에 정리된 1,311개의 에이전트/스킬 데이터를 기반으로, "아이디어 → 수익모델 → 마케팅 → 디자인 → 개발"을 한 번에 처리하는 통합 AI 툴을 어떻게 만들지에 대한 설계 방향을 정리한다. Phase 2에서 판단 사다리의 규칙 기반 프로토타입(`skills/frontdesk/scripts/route.mjs`)까지 구현했고, Phase 3에서 이 전체를 [Agent Skills 스펙](https://skills.sh)에 맞춰 `skills/frontdesk/`로 패키징해 다른 프로젝트에 `npx skills add`로 설치 가능하게 만들었다 — 아래 "라우터 프로토타입"과 "스킬 패키징" 섹션 참고.

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
2. **품질 필터링**: stars/installs만으로는 품질을 담보 못함 — 라이선스, 최근 커밋 여부, 유지보수 상태 등 신뢰도 지표 추가
3. **설명 보강 확대**: 현재 인기 상위 80개만 보강됨 — 나머지 skills.sh 항목(600여 건)도 우선순위를 낮춰 점진적으로 보강
4. **커버리지 확장**: 현재 27개 GitHub 시드 + 36개 skills.sh 키워드로 1,311건 확보 — 여전히 얇은 부서가 있다면 시드 추가
5. **남은 미분류 23건 재검토**: 대부분 이름만으로는 분야를 알 수 없는 범용 도구(harness, terminal utility 등) — 새 카테고리보다는 그냥 수동 태깅이 나을 수 있음
6. **실제 설치 검증**: `npx skills add TLSRUF/frontdesk@frontdesk`로 다른(빈) 프로젝트에서 설치가 실제로 되는지, Claude Code가 SKILL.md의 description만 보고 적절한 시점에 스스로 이 스킬을 불러오는지 검증
7. **skills.sh 등재**: 지금은 git URL로만 설치 가능 — skills.sh 인덱스에 정식 등재되면 검색으로도 발견됨

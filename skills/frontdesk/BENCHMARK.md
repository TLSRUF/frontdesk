# frontdesk 벤치마크

이 문서는 두 가지를 다룬다:

1. **frontdesk 라우터 자체의 분류 성능** — 재현 가능한 실측치 (`node scripts/benchmark.mjs`)
2. **비슷한 프로젝트와의 카탈로그 규모 비교** — 각 프로젝트가 GitHub에 공개한 수치를 그대로 인용한 기능 비교 (다른 프로젝트를 직접 설치/실행해서 잰 성능 벤치마크가 아니다)

두 종류를 섞지 않는 이유: 다른 저장소의 스킬을 실제로 설치해 똑같은 조건으로 실행 성능을 재는 건 이번 범위에서 공정하게 재현하기 어렵다(각 프로젝트가 하는 일 자체가 다르다 — 아래 "다른 프로젝트들" 참고). 그래서 **우리가 실제로 통제하고 재현할 수 있는 것**(우리 자신의 분류기, 그리고 이번 프로젝트에서 실제로 고친 버그의 전/후)만 성능 수치로 주장하고, 다른 프로젝트는 사실 확인된 규모 비교로만 다룬다.

## 1. 라우터 분류 성능

### 방법론

- 테스트셋: [`data/benchmark-testset.json`](data/benchmark-testset.json), 87개 작업 설명을 직접 작성해 13개 부서에 고르게 분포시켰다.
  - 78개: 영어, 정답 카테고리가 명확한 "in-domain" 케이스 (예: `"set up rag with a vector database"` → `7.3`)
  - 4개: 정답이 "매칭 없음"이어야 하는 off-domain 케이스 (시 쓰기, 날씨 질문 등) + `"storage"` 안에 `"rag"`가 들어있어 오분류를 유발했던 실제 회귀 케이스 1개
  - 9개: 한국어/중국어 케이스 (알려진 한계를 수치로 남기기 위함)
- 비교 대상 3가지 (전부 같은 코드베이스, 같은 테스트셋으로 실행):
  1. **frontdesk (현재)** — `scripts/lib/classify-core.mjs`의 실제 구현 (단어 시작 경계 정규식)
  2. **naive substring (수정 전 방식)** — 이 프로젝트 초기에 실제로 썼던, 단순 `.includes()`만 쓰는 방식 (`storage`가 `rag`를 포함한다고 오판하던 그 버전)
  3. **다수결 베이스라인** — 카탈로그에서 가장 큰 부서를 항상 찍는, 표준적인 ML 최소 기준선
- 지표: 부서(department) 단위 정확도, off-domain 케이스에서의 오탐률, 1회 분류당 실제 소요 시간(5,000회 반복 측정)

### 결과

<img src="assets/benchmark-accuracy.svg" alt="Classification accuracy comparison" width="720">

<img src="assets/benchmark-false-positive.svg" alt="False positive rate comparison" width="720">

| | 정확도 (78건) | 오탐률 (4건) |
|---|---:|---:|
| **frontdesk (현재)** | **88.5%** (69/78) | **0%** |
| naive substring (수정 전) | 87.2% (68/78) | 25% |
| 다수결 베이스라인 | 7.7% (6/78) | 100% |

**정확도 자체는 큰 차이가 안 난다 (88.5% vs 87.2%)** — 대부분의 테스트 문장이 키워드를 명확히 포함하고 있어서 둘 다 잘 잡는다. **진짜 차이는 오탐률(0% vs 25%)**: naive 방식은 "storage"에 "rag"가 부분 문자열로 들어있다는 이유로 완전히 무관한 요청까지 `7.3 RAG/벡터검색`으로 잘못 분류했다. 이게 이 프로젝트 진행 중 실제로 발견하고 고친 버그다 (자세한 경위는 [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)의 "프로토타입의 알려진 한계" 참고). 다수결 베이스라인은 예상대로 정확도가 낮고(항상 가장 큰 부서만 찍으므로) 오탐률은 100%(항상 뭔가를 찍으므로 "매칭 없음"을 낼 수가 없다).

**속도/비용**: 1회 분류에 평균 **0.05ms** (5,000회 반복 실측, LLM 호출 없음 → 토큰 비용 0). 비교를 위해 참고하면, LLM에게 "이 작업이 어느 카테고리냐"고 매번 물어보는 방식은 초 단위 지연과 입출력 토큰 비용이 들 수밖에 없다 — 정확한 수치는 모델/프롬프트마다 다르므로 여기서 단정하지 않지만, 규칙 매칭이 그 비용을 완전히 우회한다는 게 이 라우터의 핵심 가치다 ([`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) "라우터 프로토타입" 참고).

### 알려진 한계 (같은 실행에서 그대로 드러남)

- **비영어(한국어 3건 + 중국어 2건) 5건 중 정확도 40% (2/5)** — 키워드가 전부 영어라서다. 정확히는, 정답을 맞춘 2건도 중국어 문장 안에 우연히 영어 약어(`PRD`, `SEO`)가 그대로 섞여 있었기 때문이지, 중국어를 이해해서가 아니다. 순수 한국어 문장 3건은 전부 놓쳤다.
- **동음이의/다의어 키워드로 인한 오분류**: 벤치마크를 처음 돌렸을 때 두 가지를 새로 발견해서 고쳤다 —
  - `"design a new logo and brand identity"`가 `5.3 인증/Identity`로 잘못 분류됨 (키워드 `identity`가 "브랜드 정체성"과 "로그인 정체성"을 구분 못함) → `identity provider`, `identity management`, `user identity`처럼 더 구체적인 구로 좁혀서 고침
  - `"build a crm for tracking leads"`가 `9.5 이메일/CRM`으로 잘못 분류됨 (`crm` 키워드가 두 카테고리에 중복 등록되어 있었음) → `10.1 세일즈 아웃리치`에만 남기고 제거
- **동사 활용형(테스트/테스팅, tune/tuning) 불일치로 인한 미탐**: `"load test"` vs 키워드 `"load testing"`, `"fine-tune"` vs 키워드 `"fine-tuning"` 같은 경우 놓친다. 진짜 형태소 분석이 아니라 정규식 기반이라 생기는 근본적 한계이며, 이번엔 의도적으로 고치지 않았다 — 테스트 문장 하나하나에 맞춰 키워드를 늘리면 벤치마크 자체가 자기충족적이 되기 때문이다.
- **동률 처리가 항상 "더 구체적인" 카테고리를 고르진 않는다**: `"run an a/b testing experiment"`는 `testing`(8.1)과 `a/b testing`(9.6) 양쪽에 다 걸려 동률이 나고, 부서 번호가 빠른 8.1이 이긴다. 정답은 9.6이었다.

### 재현하기

```bash
cd skills/frontdesk
node scripts/benchmark.mjs
```

`data/benchmark-results.json`에 전체 결과(개별 miss/false-positive 목록 포함)가, `assets/*.svg`에 차트가 저장된다.

## 2. 비슷한 프로젝트와의 카탈로그 규모 비교

<img src="assets/catalog-size-comparison.svg" alt="Catalog size comparison" width="720">

| 프로젝트 | 스킬/항목 수 | 부서 수 | 메커니즘 | stars |
|---|---:|---:|---|---:|
| **frontdesk** | 1,311 | 13 | 외부(GitHub+skills.sh) 스킬을 수집해 부서별로 분류하고 규칙 기반으로 라우팅 | - |
| [headcount](https://github.com/cbrock84/headcount) | 125+ | 15+ | 자체 제작 스킬로 구성된 "회사 조직" 시뮬레이션 | 1,626 |
| [skene-cookbook](https://github.com/SkeneTechnologies/skene-cookbook) | 700+ | 비공개 | 스킬 모음, 분류/라우팅 로직 비공개 | 53 |

(2026-09-19 기준, 각 저장소의 GitHub API 응답과 README 자체 설명에서 직접 확인. 전체 원본은 [`data/comparison.json`](data/comparison.json).)

메커니즘이 다른 두 프로젝트도 참고로 남긴다 (카탈로그 규모 비교에는 넣지 않았다 — 애초에 하는 일이 다르다):

- [harness](https://github.com/revfactory/harness) (9,024★) — 기존 카탈로그에서 고르는 게 아니라, 요청마다 새 전문 에이전트 팀을 그때그때 설계/생성한다.
- [the-architect](https://github.com/Hainrixz/the-architect) (505★) — 라우팅이 아니라 프로젝트 아키텍처/블루프린트 설계가 목적이다.

**이건 성능 벤치마크가 아니라 규모/메커니즘 비교다.** 다른 프로젝트를 실제로 설치해서 정확도나 속도를 재지 않았다 — 그건 이번 범위에서 공정하게 할 수 없었다 (서로 하는 일이 다르고, 임의의 서드파티 코드를 실행하는 것 자체도 신중해야 한다). 위 표의 숫자는 전부 각 프로젝트가 스스로 공개한 사실이다.

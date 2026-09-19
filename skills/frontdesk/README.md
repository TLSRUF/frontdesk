# frontdesk (스킬)

이 폴더는 [`SKILL.md`](SKILL.md)를 포함한, 다른 프로젝트에 그대로 설치 가능한 **자기완결적 스킬 패키지**다. 프로젝트 전체 배경과 설계 문서는 저장소 루트의 [`README.md`](../../README.md), [`ARCHITECTURE.md`](../../ARCHITECTURE.md)를 참고한다.

## 설치

```bash
npx skills add TLSRUF/frontdesk@frontdesk
```

또는 Claude Code에서 저장소를 직접 가리켜서 설치할 수도 있다 (skills.sh 인덱스에 등재되기 전까지는 이 방법을 권장):

```bash
npx skills add https://github.com/TLSRUF/frontdesk
```

설치되면 Claude가 "이 작업에 맞는 기존 스킬/도구가 있나?" 같은 상황에서 자동으로 이 스킬을 참고한다. 수동으로 확인하려면:

```bash
node scripts/route.mjs "recommend a testing automation tool"
```

## 이 폴더의 구성

- `SKILL.md` — Claude(또는 다른 에이전트)가 읽는 실제 스킬 정의
- `taxonomy.mjs` — 13개 부서 분류 체계
- `data/catalog.json` — 분류된 카탈로그 원본 (1,311건)
- `scripts/` — 수집(`collect-*.mjs`) → 분류(`classify.mjs`) → 보강(`enrich-descriptions.mjs`) → 문서화(`build-catalog-md.mjs`) → 라우팅(`route.mjs`) 파이프라인
- `CATALOG.md` — 사람이 읽는 카탈로그 전체 목록

카탈로그를 최신화하려면 `npm run all` (저장소 루트 README 참고).

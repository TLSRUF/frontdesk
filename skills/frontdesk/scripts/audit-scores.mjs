// "다음에 할 수 있는 일" 9번(진짜 성능 측정)의 첫 번째 후보: skills CLI가 설치할 때
// 보여주는 것과 같은 보안 감사(Socket/Snyk/등)를 API로 직접 끌어온다.
//
// `npx skills add` 실행 중 소스코드(vercel-labs/skills의 src/telemetry.ts)를 읽어서
// 찾았다 — 인증 없이 공개로 열려 있는 엔드포인트다:
//   GET https://add-skill.vercel.sh/audit?source=<owner>/<repo>&skills=<slug1,slug2,...>
//
// 이것도 "성능"이 아니라 "안전한가"를 재는 것이다 — 코드가 잘 작성됐는지, 작업을 잘
// 해내는지는 여전히 모른다. 하지만 stars/installs/health_score보다 한 걸음 더 실질적인
// 신뢰 신호이고, 최소한 "이 스킬이 위험한 코드를 담고 있진 않다"는 것 하나는 확인해준다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const AUDIT_URL = "https://add-skill.vercel.sh/audit";
const CACHE_PATH = "data/audit-scores.json";

const RISK_SCORE = { safe: 100, low: 75, medium: 50, high: 25, critical: 0 };

function riskToScore(risk) {
  return risk in RISK_SCORE ? RISK_SCORE[risk] : null;
}

function compositeScore(auditEntry) {
  if (!auditEntry) return null;
  const scores = [auditEntry.ath?.risk, auditEntry.socket?.risk, auditEntry.snyk?.risk, auditEntry.zeroleaks?.risk]
    .map(riskToScore)
    .filter((s) => s != null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function repoAndSlug(item) {
  const [repo, slug] = item.id.replace("skillssh:", "").split("@");
  return { repo, slug };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAudit(repo, slugs, retries = 4) {
  const params = new URLSearchParams({ source: repo, skills: slugs.join(",") });
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${AUDIT_URL}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      const backoff = 1000 * 2 ** attempt; // 1s, 2s, 4s, 8s
      await sleep(backoff);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const skillItems = catalog.filter((it) => it.type === "skill");

const byRepo = new Map();
for (const item of skillItems) {
  const { repo, slug } = repoAndSlug(item);
  if (!byRepo.has(repo)) byRepo.set(repo, []);
  byRepo.get(repo).push(slug);
}

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const repos = [...byRepo.keys()];
// 실패(에러)로 캐시된 것도 다시 시도 대상에 넣는다 — 성공한 것만 "완료"로 친다.
const todo = repos.filter((r) => !cache[r] || cache[r].error);

console.log(`[audit-scores] 스킬 보유 저장소 ${repos.length}개, 재조회 필요 ${todo.length}개 시작 (요청 사이 250ms 간격)`);

let done = 0;
let failed = 0;
for (const repo of todo) {
  try {
    const data = await fetchAudit(repo, byRepo.get(repo));
    cache[repo] = { data, fetched_at: new Date().toISOString() };
  } catch (err) {
    cache[repo] = { error: err.message, fetched_at: new Date().toISOString() };
    failed++;
  }
  done++;
  await sleep(250); // 레이트리밋(HTTP 429) 예방
  if (done % 50 === 0) {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`[audit-scores] ${done}/${todo.length} 처리 (실패 ${failed})`);
  }
}
writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log(`[audit-scores] 완료: ${todo.length}개 신규 조회, 실패 ${failed}개 -> ${CACHE_PATH}`);

let merged = 0;
for (const item of catalog) {
  if (item.type !== "skill") continue;
  const { repo, slug } = repoAndSlug(item);
  const entry = cache[repo];
  const auditEntry = entry && !entry.error ? entry.data[slug] : null;
  const score = compositeScore(auditEntry);
  if (score != null) {
    item.audit_score = score;
    merged++;
  } else {
    item.audit_score = null;
  }
}
writeFileSync("data/catalog.json", JSON.stringify(catalog, null, 2));
console.log(`[audit-scores] catalog.json에 audit_score 병합 완료 (${merged}/${skillItems.length}건, 나머지는 감사 데이터 없음)`);

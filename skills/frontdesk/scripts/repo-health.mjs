// "성능"을 직접 측정할 방법이 없으니, installs/stars(인기도)보다 조금이라도 더 나은
// 대리 지표로 "저장소 건강도"를 계산한다. GitHub API로 무료로, 실행 없이 얻을 수 있는
// 신호만 쓴다: 최근 유지보수 여부, archived 여부, 라이선스 유무, fork를 통한 실제 채택 정도.
//
// 정직하게 짚을 것: 이것도 "실제 코드/스킬 품질"을 재는 게 아니라 "관리되고 신뢰할 만한가"를
// 잰다. Reddit 언급 수를 검토했지만(ponytail처럼 가장 유명한 스킬조차 검색으로 잡히는 언급이
// 없어서) 포기했고, 진짜 성능 측정(실행해서 결과 비교)은 ARCHITECTURE.md "다음에 할 수 있는 일"에
// 남겨둔 별도 과제다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CACHE_PATH = "data/repo-health.json";

function extractRepoPath(item) {
  if (item.type === "skill") {
    return item.id.replace("skillssh:", "").split("@")[0];
  }
  const m = item.source_url.match(/github\.com\/([^/]+\/[^/]+)/);
  return m ? m[1] : null;
}

function daysSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function recencyScore(pushedAt) {
  const days = daysSince(pushedAt);
  if (days <= 30) return 1.0;
  if (days <= 90) return 0.8;
  if (days <= 180) return 0.6;
  if (days <= 365) return 0.35;
  if (days <= 730) return 0.15;
  return 0;
}

function adoptionScore(forks) {
  if (forks <= 0) return 0;
  return Math.min(1, Math.log10(forks + 1) / Math.log10(100));
}

function computeHealth(repoData) {
  const recency = recencyScore(repoData.pushed_at);
  const notArchived = repoData.archived ? 0 : 1;
  const hasLicense = repoData.license ? 1 : 0;
  const adoption = adoptionScore(repoData.forks_count || 0);
  const score = 100 * (0.5 * recency + 0.25 * notArchived + 0.1 * hasLicense + 0.15 * adoption);
  return Math.round(score * 10) / 10;
}

function fetchRepo(repoPath) {
  const raw = execFileSync("gh", ["api", `repos/${repoPath}`], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  const r = JSON.parse(raw);
  return {
    pushed_at: r.pushed_at,
    archived: !!r.archived,
    license: r.license?.spdx_id || null,
    forks_count: r.forks_count || 0,
    open_issues_count: r.open_issues_count || 0,
    stargazers_count: r.stargazers_count || 0
  };
}

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const repoPaths = [...new Set(catalog.map(extractRepoPath).filter(Boolean))];

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const todo = repoPaths.filter((r) => !cache[r]);

console.log(`[repo-health] 고유 저장소 ${repoPaths.length}개, 캐시에 없는 ${todo.length}개 조회 시작`);

let done = 0;
let failed = 0;
for (const repoPath of todo) {
  try {
    const data = fetchRepo(repoPath);
    cache[repoPath] = { ...data, health_score: computeHealth(data), fetched_at: new Date().toISOString() };
  } catch (err) {
    cache[repoPath] = { error: err.message.split("\n")[0], fetched_at: new Date().toISOString() };
    failed++;
  }
  done++;
  if (done % 50 === 0) {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); // 중간 저장 (중단돼도 이어서 가능)
    console.log(`[repo-health] ${done}/${todo.length} 처리 (실패 ${failed})`);
  }
}
writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log(`[repo-health] 완료: ${todo.length}개 신규 조회, 실패 ${failed}개 -> ${CACHE_PATH}`);

// catalog.json에 health_score를 병합해 저장한다 (원본 raw 데이터는 안 건드림 —
// classify.mjs를 다시 돌려도 이 스크립트를 다시 돌리면 복구됨)
let merged = 0;
for (const item of catalog) {
  const repoPath = extractRepoPath(item);
  const health = repoPath ? cache[repoPath] : null;
  if (health && !health.error) {
    item.health_score = health.health_score;
    merged++;
  } else {
    item.health_score = null;
  }
}
writeFileSync("data/catalog.json", JSON.stringify(catalog, null, 2));
console.log(`[repo-health] catalog.json에 health_score 병합 완료 (${merged}/${catalog.length}건)`);

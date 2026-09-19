// ARCHITECTURE.md에서 설명한 ponytail식 판단 사다리의 프로토타입.
// 작업 설명을 받아 "무거운 범용 에이전트를 부르기 전에" 카탈로그에서
// 좁은 범위의 스킬로 해결 가능한지부터 확인한다.
//
// 사용법:
//   node scripts/route.mjs "우리 서비스 가격 정책을 어떻게 잡아야 할까?"          # 추천만
//   node scripts/route.mjs "..." --install                                    # 추천 후 그 자리에서 설치까지
//
// 안전 노트: --install 없이 실행하면 추천만 하고 아무것도 설치하지 않는다.
// SKILL.md는 Claude에게 "먼저 --install 없이 보여주고 사용자 확인을 받은 뒤에만
// --install로 다시 실행하라"고 지시한다 — 이 스크립트 자체가 그 확인을 강제하지는
// 않으므로 호출하는 쪽(SKILL.md/Claude)이 그 순서를 지켜야 한다.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { allCategories } from "../taxonomy.mjs";
import { matchingCategories, normalize } from "./lib/classify-core.mjs";
import { rankedCandidates } from "./lib/ranking.mjs";

const CACHE_PATH = "data/route-cache.json";
const CATEGORIES = allCategories();
const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
}

function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function toCandidate(item) {
  return { name: item.name, url: item.source_url, type: item.type, install: item.install };
}

function topItems(categoryId, n = 3) {
  return rankedCandidates(catalog, categoryId, { n }).map(toCandidate);
}

function route(task) {
  const key = normalize(task);
  const cache = loadCache();

  // 1단계: 캐시 확인 — 같은(또는 정규화 후 동일한) 요청을 이미 라우팅했는가?
  if (cache[key]) {
    return { step: 1, reason: "이미 캐시된 라우팅 결과 재사용 (무호출)", result: cache[key] };
  }

  const matches = matchingCategories(task, CATEGORIES);

  // 4단계: 카탈로그에 매칭되는 부서/스킬이 전혀 없음 — 범용 에이전트가 필요
  if (matches.length === 0) {
    const result = { type: "general-agent", note: "카탈로그에 매칭되는 좁은 스킬이 없음 — 범용 LLM 추론 필요" };
    cache[key] = result;
    saveCache(cache);
    return { step: 4, reason: "키워드 매칭 0건", result };
  }

  const topHits = matches[0].hits;
  const strongMatches = matches.filter((m) => m.hits === topHits);

  // 2단계: 단일 카테고리가 뚜렷하게 우세 — 그 부서의 스킬 하나(들)만 로드
  if (strongMatches.length === 1) {
    const cat = strongMatches[0].cat;
    const items = topItems(cat.id);
    const result = { type: "single-category", category: `${cat.id} ${cat.dept} > ${cat.name}`, candidates: items };
    cache[key] = result;
    saveCache(cache);
    return { step: 2, reason: `"${cat.name}" 카테고리가 가장 강하게 매칭 (키워드 ${topHits}개 일치)`, result };
  }

  // 3단계: 여러 부서가 동률로 매칭 — 각 부서에서 하나씩, 순서대로 조합
  const combo = strongMatches.slice(0, 3).map((m) => {
    const items = topItems(m.cat.id, 1);
    return { category: `${m.cat.id} ${m.cat.dept} > ${m.cat.name}`, candidate: items[0] || null };
  });
  const result = { type: "multi-category", steps: combo };
  cache[key] = result;
  saveCache(cache);
  return { step: 3, reason: `${strongMatches.length}개 부서가 동률로 매칭 — 순차 조합 필요`, result };
}

// npx skills add spec --agent X -y 형태만 실행한다. github-repo(type !== "skill")는
// SKILL.md 스펙을 따르는 게 보장 안 되니 자동 설치하지 않고 clone 명령만 보여준다.
function installCandidate(candidate, agent) {
  if (candidate.type !== "skill") {
    console.log(`     (github-repo 타입은 자동 설치 안 함 — 수동으로: ${candidate.install})`);
    return { installed: false, reason: "not-a-skill-type" };
  }
  const spec = candidate.install.replace(/^npx skills add /, "");
  try {
    execFileSync("npx", ["-y", "skills", "add", spec, "--agent", agent, "-y"], { encoding: "utf8", shell: true, stdio: "inherit" });
    return { installed: true };
  } catch (err) {
    return { installed: false, reason: err.message.split("\n")[0] };
  }
}

function printResult(task, { step, reason, result }, { doInstall, agent }) {
  console.log(`\n요청: "${task}"`);
  console.log(`판단 사다리: ${step}단계 — ${reason}`);
  if (result.type === "general-agent") {
    console.log(`  → ${result.note}`);
  } else if (result.type === "single-category") {
    console.log(`  → 카테고리: ${result.category}`);
    for (const c of result.candidates) console.log(`     - ${c.name} (${c.url})`);
    if (doInstall && result.candidates[0]) {
      console.log(`  설치 중: ${result.candidates[0].name} ...`);
      const r = installCandidate(result.candidates[0], agent);
      console.log(r.installed ? `  ✓ 설치 완료` : `  ✗ 설치 실패: ${r.reason || ""}`);
    } else if (!doInstall && result.candidates[0]) {
      console.log(`  (실제 설치하려면 --install을 붙여 다시 실행 — 먼저 사용자에게 확인받을 것)`);
    }
  } else if (result.type === "multi-category") {
    for (const s of result.steps) {
      console.log(`  → [${s.category}]`);
      if (s.candidate) {
        console.log(`     - ${s.candidate.name} (${s.candidate.url})`);
        if (doInstall) {
          console.log(`  설치 중: ${s.candidate.name} ...`);
          const r = installCandidate(s.candidate, agent);
          console.log(r.installed ? `  ✓ 설치 완료` : `  ✗ 설치 실패: ${r.reason || ""}`);
        }
      }
    }
    if (!doInstall && result.steps.some((s) => s.candidate)) {
      console.log(`  (실제 설치하려면 --install을 붙여 다시 실행 — 먼저 사용자에게 확인받을 것)`);
    }
  } else {
    console.log(`  → (캐시됨) ${JSON.stringify(result)}`);
  }
}

const rawArgs = process.argv.slice(2);
const doInstall = rawArgs.includes("--install");
const agentArg = rawArgs.find((a) => a.startsWith("--agent="));
const agent = agentArg ? agentArg.split("=")[1] : "claude-code";
const task = rawArgs.filter((a) => !a.startsWith("--")).join(" ").trim();

if (!task) {
  console.log("사용법: node scripts/route.mjs \"작업 설명\" [--install] [--agent=claude-code]\n");
  console.log("데모 예시를 실행합니다 (--install 없이, 추천만):\n");
  const demos = [
    "우리 서비스 가격 정책을 어떻게 잡아야 할까?",
    "새 기능 랜딩페이지 SEO 최적화하고 이메일 뉴스레터도 보내야 해",
    "테라폼으로 인프라 구성하고 CI/CD 파이프라인도 짜줘",
    "오늘 날씨가 어떨지 시로 하나 써줘"
  ];
  for (const d of demos) printResult(d, route(d), { doInstall: false, agent });
} else {
  printResult(task, route(task), { doInstall, agent });
}

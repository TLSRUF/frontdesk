// skills.sh 공식 CLI(`npx skills search`)로 스킬을 수집한다.
// skills.sh의 공개 REST API는 Vercel OIDC 인증이 필요해 막혀 있지만,
// 이 CLI는 인증 없이 동작하며 owner/repo@skill, install 수, URL을 그대로 준다.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT_DIR = "data/raw/skillssh";
mkdirSync(OUT_DIR, { recursive: true });

// 12개 부서를 고르게 커버하는 검색 키워드
const KEYWORDS = [
  "market research",
  "pricing",
  "product requirements",
  "wireframe",
  "design system",
  "accessibility",
  "react",
  "mobile app",
  "api design",
  "database migration",
  "terraform",
  "observability",
  "rag",
  "prompt engineering",
  "testing",
  "security audit",
  "seo",
  "copywriting",
  "email marketing",
  "billing stripe",
  "project management",
  "documentation",
  "roadmap",
  "user research",
  "okr",
  "sales outreach",
  "crm",
  "customer support",
  "hiring",
  "job description",
  "legal contract",
  "compliance",
  "agent memory",
  "context engineering",
  "mobile app"
];

// 특정 저장소/작성자를 통째로 훑어야 할 때(예: 일반 키워드 검색으로는 안 걸리는 니치한
// 스킬 이름들 — "project-graveyard", "scope-creep-detector" 등). `skills find <query> --owner
// <owner>`는 그 owner 소유 저장소로 검색을 제한한다. 쿼리 하나로는 다 안 걸려서 여러 개를 합친다.
const OWNER_QUERIES = [
  { owner: "shubhamsaboo", queries: ["agent", "code", "skill", "review", "design", "writing", "research", "plan", "data"] }
];

const ANSI_RE = /\u001b\[[0-9;]*m/g;
const ENTRY_RE = /^([\w.-]+\/[\w.-]+)@([\w.-]+)\s+([\d.]+[KM]?)\s+installs$/;
const URL_RE = /^└\s+(https?:\/\/\S+)/;

function parseOutput(raw) {
  const lines = raw
    .replace(ANSI_RE, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const m = ENTRY_RE.exec(lines[i]);
    if (!m) continue;
    const [, repo, skill, installsRaw] = m;
    const urlLine = lines[i + 1] || "";
    const um = URL_RE.exec(urlLine);
    results.push({
      id: `skillssh:${repo}@${skill}`,
      name: `${repo}@${skill}`,
      type: "skill",
      source_url: um ? um[1] : `https://skills.sh/${repo}`,
      metric: { installs: parseInstalls(installsRaw) },
      description: "",
      topics: [],
      install: `npx skills add ${repo}@${skill}`
    });
  }
  return results;
}

function parseInstalls(raw) {
  const n = parseFloat(raw);
  if (raw.endsWith("M")) return Math.round(n * 1_000_000);
  if (raw.endsWith("K")) return Math.round(n * 1_000);
  return Math.round(n);
}

function searchSkills(keyword) {
  const raw = execFileSync("npx", ["-y", "skills", "search", keyword], {
    encoding: "utf8",
    shell: true,
    maxBuffer: 10 * 1024 * 1024
  });
  return parseOutput(raw);
}

function findSkillsByOwner(query, owner) {
  const raw = execFileSync("npx", ["-y", "skills", "find", query, "--owner", owner], {
    encoding: "utf8",
    shell: true,
    maxBuffer: 10 * 1024 * 1024
  });
  return parseOutput(raw);
}

let total = 0;
for (const keyword of KEYWORDS) {
  try {
    const items = searchSkills(keyword);
    const slug = keyword.replace(/\s+/g, "-");
    writeFileSync(`${OUT_DIR}/${slug}.json`, JSON.stringify(items.map((it) => ({ ...it, seed_keyword: keyword })), null, 2));
    total += items.length;
    console.log(`[skillssh] "${keyword}" -> ${items.length}건`);
  } catch (err) {
    console.error(`[skillssh] "${keyword}" 실패:`, err.message);
  }
}

for (const { owner, queries } of OWNER_QUERIES) {
  const merged = new Map();
  for (const q of queries) {
    try {
      const items = findSkillsByOwner(q, owner);
      for (const it of items) merged.set(it.id, it);
    } catch (err) {
      console.error(`[skillssh] owner:${owner} query:"${q}" 실패:`, err.message);
    }
  }
  const items = [...merged.values()].map((it) => ({ ...it, seed_keyword: `owner:${owner}` }));
  writeFileSync(`${OUT_DIR}/owner-${owner}.json`, JSON.stringify(items, null, 2));
  total += items.length;
  console.log(`[skillssh] owner:${owner} (${queries.length}개 쿼리 합산) -> ${items.length}건`);
}

console.log(`[skillssh] 총 ${total}건 수집 완료 (중복 포함, ${OUT_DIR}/*.json)`);

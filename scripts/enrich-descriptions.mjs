// skills.sh CLI의 search 결과에는 description이 없다.
// 인기 스킬(installs 기준 상위 N개) 한정으로 실제 SKILL.md를 GitHub에서 가져와
// frontmatter의 description을 채워 넣는다. (전수로 하면 느리므로 인기 항목 우선)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TOP_N = Number(process.argv[2] || 80);

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const candidates = catalog
  .filter((it) => it.id.startsWith("skillssh:") && !it.description)
  .sort((a, b) => (b.metric?.installs || 0) - (a.metric?.installs || 0))
  .slice(0, TOP_N);

const byRepo = new Map();
for (const item of candidates) {
  const [repo, skill] = item.id.replace("skillssh:", "").split("@");
  if (!byRepo.has(repo)) byRepo.set(repo, []);
  byRepo.get(repo).push({ skill, item });
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function extractDescription(md) {
  // SKILL.md frontmatter: --- \n name: ... \n description: ... \n ---
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  const block = fm ? fm[1] : md.slice(0, 2000);
  const m = /^description:\s*(.+)$/m.exec(block);
  if (!m) return null;
  let desc = m[1].trim();
  // 여러 줄 YAML 블록 스칼라(>-, |)는 건너뛰고 첫 줄만 사용
  desc = desc.replace(/^["']|["']$/g, "");
  return desc.slice(0, 220);
}

let updated = 0;
let repoIdx = 0;
for (const [repo, skills] of byRepo.entries()) {
  repoIdx++;
  let tree;
  try {
    const branch = gh(["api", `repos/${repo}`, "--jq", ".default_branch"]).trim();
    // 주의: `-f recursive=1`을 쓰면 gh가 메서드를 POST로 바꿔 404가 난다. 쿼리스트링으로 직접 붙여야 GET을 유지한다.
    const treeRaw = gh(["api", `repos/${repo}/git/trees/${branch}?recursive=1`, "--jq", ".tree[].path"]);
    tree = treeRaw.split("\n").filter(Boolean);
  } catch (err) {
    console.error(`[enrich] ${repo} 트리 조회 실패:`, err.message.split("\n")[0]);
    continue;
  }

  for (const { skill, item } of skills) {
    const path =
      tree.find((p) => p.toLowerCase() === `${skill}/skill.md`.toLowerCase()) ||
      tree.find((p) => p.toLowerCase().endsWith(`/${skill}/skill.md`.toLowerCase())) ||
      tree.find((p) => p.toLowerCase() === `skills/${skill}/skill.md`.toLowerCase()) ||
      tree.find((p) => p.toLowerCase().endsWith(`${skill}.md`.toLowerCase()) && p.toLowerCase().includes(skill.toLowerCase()));
    if (!path) continue;
    try {
      const b64 = gh(["api", `repos/${repo}/contents/${path}`, "--jq", ".content"]);
      const content = Buffer.from(b64, "base64").toString("utf8");
      const desc = extractDescription(content);
      if (desc) {
        item.description = desc;
        updated++;
      }
    } catch (err) {
      // 개별 파일 실패는 건너뛴다
    }
  }
  console.log(`[enrich] (${repoIdx}/${byRepo.size}) ${repo} 처리 완료`);
}

writeFileSync("data/catalog.json", JSON.stringify(catalog, null, 2));
console.log(`[enrich] 총 ${updated}건 설명 보강 완료`);

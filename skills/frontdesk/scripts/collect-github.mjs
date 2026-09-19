// GitHub 저장소를 gh CLI(REST search API)로 수집한다.
// 인증된 gh 세션을 그대로 재사용하므로 별도 토큰 설정이 필요 없다.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT_DIR = "data/raw/github";
mkdirSync(OUT_DIR, { recursive: true });

// 12개 부서를 고르게 커버하는 시드 토픽 (GitHub topic 태그 기준)
const SEEDS = [
  "agent-skills",
  "ai-agents",
  "claude-code",
  "claude-code-plugin",
  "mcp-server",
  "cursor-rules",
  "llm-agent",
  "prompt-engineering",
  "ai-coding-assistant",
  "multi-agent-systems",
  "rag",
  "vector-database",
  "design-system",
  "accessibility",
  "terraform",
  "devops-automation",
  "marketing-automation",
  "llmops",
  "product-management",
  "sales-automation",
  "crm",
  "customer-support",
  "documentation-generator",
  "agent-memory",
  "context-engineering",
  "hiring",
  "compliance"
];

function ghSearch(topic) {
  const q = `topic:${topic} stars:>30`;
  const args = [
    "api",
    "-X", "GET",
    "search/repositories",
    "-f", `q=${q}`,
    "-f", "sort=stars",
    "-f", "order=desc",
    "-f", "per_page=30"
  ];
  const raw = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const json = JSON.parse(raw);
  return (json.items || []).map((r) => ({
    id: `github:${r.full_name}`,
    name: r.name,
    owner: r.owner?.login,
    type: "github-repo",
    source_url: r.html_url,
    metric: { stars: r.stargazers_count },
    description: r.description || "",
    topics: r.topics || [],
    license: r.license?.spdx_id || null,
    seed_topic: topic
  }));
}

let total = 0;
for (const topic of SEEDS) {
  try {
    const items = ghSearch(topic);
    writeFileSync(`${OUT_DIR}/${topic}.json`, JSON.stringify(items, null, 2));
    total += items.length;
    console.log(`[github] topic:${topic} -> ${items.length}건`);
  } catch (err) {
    console.error(`[github] topic:${topic} 실패:`, err.message);
  }
}
console.log(`[github] 총 ${total}건 수집 완료 (중복 포함, ${OUT_DIR}/*.json)`);

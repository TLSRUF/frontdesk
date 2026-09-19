// data/catalog.json을 부서 -> 세부분야 순으로 그룹핑해 사람이 읽기 좋은 CATALOG.md를 생성한다.
import { readFileSync, writeFileSync } from "node:fs";
import { departments } from "../taxonomy.mjs";

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));

function metricLabel(item) {
  if (item.metric?.stars != null) return `⭐ ${item.metric.stars}`;
  if (item.metric?.installs != null) return `⬇ ${item.metric.installs.toLocaleString()} installs`;
  return "";
}

let md = `# AI 개발 에이전트/스킬 카탈로그\n\n`;
md += `GitHub과 skills.sh에서 수집해 실제 개발 회사 조직도 기준으로 분류한 카탈로그입니다. 총 ${catalog.length}건.\n\n`;
md += `자동 생성 파일입니다 — 직접 수정하지 말고 \`npm run all\`로 재생성하세요.\n\n`;
md += `---\n\n`;

for (const dept of departments) {
  const deptItems = catalog.filter((c) => c.category?.startsWith(dept.id + "."));
  if (deptItems.length === 0) continue;
  md += `## ${dept.id}. ${dept.name} (${deptItems.length}건)\n\n`;
  for (const cat of dept.categories) {
    const items = deptItems.filter((c) => c.category === cat.id);
    if (items.length === 0) continue;
    md += `### ${cat.id} ${cat.name}\n\n`;
    for (const item of items) {
      const metric = metricLabel(item);
      md += `- **[${item.name}](${item.source_url})**${metric ? ` (${metric})` : ""} — ${item.description || "_설명 없음_"}\n`;
    }
    md += `\n`;
  }
}

writeFileSync("CATALOG.md", md);
console.log(`[build] CATALOG.md 생성 완료 (${catalog.length}건)`);

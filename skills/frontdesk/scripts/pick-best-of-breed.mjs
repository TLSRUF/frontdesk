// 부서(또는 세부분야)별로 "npx skills add"로 바로 설치 가능한(type: "skill") 항목 중
// 설치 수(installs) 1위를 뽑아 스타터팩 목록을 만든다.
//
// 중요한 정직성 노트: 이건 "가장 성능이 뛰어난" 스킬이 아니라 "가장 많이 설치된" 스킬이다.
// installs는 인기도 지표이지 품질/성능 측정치가 아니다 (BENCHMARK.md, ARCHITECTURE.md 참고).
// 더 나은 신호가 생기기 전까지 쓸 수 있는 유일한 정량적 대리 지표라서 쓰는 것뿐이다.
import { readFileSync, writeFileSync } from "node:fs";
import { departments, allCategories } from "../taxonomy.mjs";
import { isHealthy } from "./lib/ranking.mjs";

const args = process.argv.slice(2);
const perArg = args.find((a) => a.startsWith("--per="));
const per = perArg ? perArg.split("=")[1] : "department"; // "department" | "category"
if (!["department", "category"].includes(per)) {
  console.error(`--per은 department 또는 category만 가능 (받은 값: ${per})`);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
// weak_match(검색 시드로만 걸린, 신뢰도 낮은 분류)는 제외한다 — 예를 들어 "azure-storage"가
// "rag" 검색 결과에 우연히 섞여 들어와 7.3 RAG/벡터검색으로 분류된 적이 있었는데,
// 그런 항목을 "이 부서 대표 스킬"로 추천하면 안 된다.
// health_score가 너무 낮은(archived되었거나 라이선스도 없고 아무도 fork 안 한) 것도 제외한다.
const installable = catalog.filter((it) => it.type === "skill" && it.install && !it.weak_match && isHealthy(it));

function groupKey(item) {
  return per === "department" ? item.category.split(".")[0] : item.category;
}

const groups = new Map();
for (const item of installable) {
  const key = groupKey(item);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

const deptName = new Map(departments.map((d) => [d.id, d.name]));
const catName = new Map(allCategories().map((c) => [c.id, `${c.dept} > ${c.name}`]));

const picks = [];
for (const [key, items] of groups.entries()) {
  items.sort((a, b) => (b.metric?.installs || 0) - (a.metric?.installs || 0));
  const top = items[0];
  picks.push({
    group: key,
    group_name: per === "department" ? deptName.get(key) : catName.get(key),
    name: top.name,
    source_url: top.source_url,
    installs: top.metric?.installs || 0,
    health_score: top.health_score ?? null,
    install: top.install
  });
}

picks.sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true }));

writeFileSync(
  "data/starter-pack.json",
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      granularity: per,
      note: "installs(설치 수) 기준 인기 1위이지, 실측 성능/품질 순위가 아님. archived·라이선스 없음·fork 없음 등으로 health_score가 낮은 항목은 미리 제외함 — ARCHITECTURE.md/BENCHMARK.md의 한계 참고",
      picks
    },
    null,
    2
  )
);

console.log(`[pick-best-of-breed] ${per} 기준 ${picks.length}개 선정 -> data/starter-pack.json`);
for (const p of picks) {
  console.log(`  [${p.group}] ${p.group_name} -> ${p.name} (${p.installs.toLocaleString()} installs)`);
}

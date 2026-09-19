// 아이디어 → 기획 → 디자인 → 개발 → 품질/보안 → 마케팅 → 배포 → 운영, 8단계 파이프라인.
// 새 오케스트레이션 엔진이 아니라 기존 taxonomy.mjs/data/catalog.json을 그대로 재사용한다:
// 각 단계를 특정 부서(department)로 제한해서 matchingCategories를 돌리고, 그 부서 안에서
// 가장 잘 맞는 세부분야의 상위 후보를 보여준다.
//
// 이 스크립트는 추천만 한다 — 설치나 다음 단계 진행은 하지 않는다. 단계 사이 확인은
// SKILL.md의 지시에 따라 Claude가 대화로 진행한다 (사람이 매 단계 확인하고 넘어감).
import { readFileSync } from "node:fs";
import { departments, allCategories } from "../taxonomy.mjs";
import { matchingCategories } from "./lib/classify-core.mjs";

const STAGES = [
  { id: 1, name: "아이디어/전략", depts: ["1"], seed: "market research idea validation business model pricing strategy" },
  { id: 2, name: "프로덕트 정의", depts: ["2"], seed: "product requirements roadmap user research metrics" },
  { id: 3, name: "디자인", depts: ["3"], seed: "wireframe ui design system prototype accessibility" },
  { id: 4, name: "개발", depts: ["4", "5", "6", "7"], seed: "frontend backend api database infrastructure data engineering" },
  { id: 5, name: "품질/보안", depts: ["8"], seed: "testing code review security audit load testing" },
  { id: 6, name: "마케팅/세일즈", depts: ["9", "10"], seed: "seo copywriting ads email marketing sales outreach billing" },
  { id: 7, name: "배포", depts: ["6"], seed: "ci/cd github actions deployment pipeline terraform infrastructure as code" },
  { id: 8, name: "운영", depts: ["6", "11"], seed: "observability monitoring logging project management documentation compliance" }
];

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const ALL_CATEGORIES = allCategories();
const deptName = new Map(departments.map((d) => [d.id, d.name]));

function topItems(categoryId, n = 3) {
  return catalog
    .filter((it) => it.category === categoryId && !it.weak_match)
    .sort((a, b) => (b.metric?.stars ?? b.metric?.installs ?? 0) - (a.metric?.stars ?? a.metric?.installs ?? 0))
    .slice(0, n);
}

function runStage(stage, projectDescription) {
  const categoriesInScope = ALL_CATEGORIES.filter((c) => stage.depts.includes(c.deptId));
  const query = `${stage.seed} ${projectDescription}`;
  const matches = matchingCategories(query, categoriesInScope);
  if (matches.length === 0) {
    return { stage, category: null, items: [] };
  }
  const topHits = matches[0].hits;
  const best = matches.filter((m) => m.hits === topHits)[0].cat;
  return { stage, category: best, items: topItems(best.id) };
}

function printStage(result) {
  const deptLabel = result.stage.depts.map((d) => deptName.get(d)).join(" / ");
  console.log(`\n## ${result.stage.id}단계: ${result.stage.name} (${deptLabel})`);
  if (!result.category) {
    console.log(`  이 프로젝트 설명만으로는 세부분야를 좁히지 못했습니다 — ${deptLabel} 부서 안에서 직접 살펴보세요.`);
    return;
  }
  console.log(`  → ${result.category.id} ${result.category.name}`);
  if (result.items.length === 0) {
    console.log(`  (신뢰도 높은 후보 없음 — CATALOG.md에서 이 카테고리를 직접 확인하세요)`);
  }
  for (const item of result.items) {
    const metric = item.metric?.stars != null ? `⭐${item.metric.stars}` : `⬇${item.metric?.installs?.toLocaleString()}`;
    console.log(`    - ${item.name} (${metric}) ${item.source_url}`);
  }
}

const args = process.argv.slice(2);
const stageArg = args.find((a) => a.startsWith("--stage="));
const onlyStage = stageArg ? Number(stageArg.split("=")[1]) : null;
const projectDescription = args.filter((a) => !a.startsWith("--")).join(" ") || "";

if (!projectDescription) {
  console.log('사용법: node scripts/pipeline.mjs "프로젝트 설명" [--stage=N]');
  console.log("예: node scripts/pipeline.mjs \"AI 기반 레시피 추천 앱\"");
  process.exit(1);
}

console.log(`# 파이프라인: "${projectDescription}"`);
console.log(`단계마다 사람이 확인하고 다음으로 넘어가는 걸 전제로 한다 — 이 스크립트는 각 단계의 추천만 보여준다.`);

const stagesToRun = onlyStage ? STAGES.filter((s) => s.id === onlyStage) : STAGES;
if (onlyStage && stagesToRun.length === 0) {
  console.error(`--stage=${onlyStage}는 존재하지 않음 (1~${STAGES.length})`);
  process.exit(1);
}

for (const stage of stagesToRun) {
  printStage(runStage(stage, projectDescription));
}

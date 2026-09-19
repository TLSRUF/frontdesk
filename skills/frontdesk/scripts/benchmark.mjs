// frontdesk 라우터의 분류 정확도/속도를 실측하고, 우리가 실제로 겪었던 버그(단순
// substring 매칭의 "storage"→"rag" 오탐)를 고친 전/후를 정량적으로 비교한다.
// 다른 프로젝트를 설치해서 실행 성능을 비교하는 게 아니라(그건 공정하게 재현하기 어렵다),
// 우리 자신의 세 가지 분류 방식을 같은 테스트셋에 대해 돌려서 비교하는 재현 가능한 벤치마크다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { allCategories } from "../taxonomy.mjs";
import { bestMatch as currentBestMatch, normalize } from "./lib/classify-core.mjs";
import { barChart } from "./lib/svg-bar-chart.mjs";

const CATEGORIES = allCategories();
const testset = JSON.parse(readFileSync("data/benchmark-testset.json", "utf8"));
const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));

// --- 비교 대상 1: 순진한 substring 매칭 (우리가 처음 썼던, 버그 있던 방식) ---
function naiveBestMatch(text, categories) {
  const t = text.toLowerCase();
  let best = null;
  let bestHits = 0;
  for (const cat of categories) {
    const hits = cat.keywords.filter((kw) => t.includes(kw.toLowerCase())).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = cat;
    }
  }
  return best;
}

// --- 비교 대상 2: 다수결 베이스라인 (카탈로그에서 가장 큰 부서를 항상 찍기) ---
const deptCounts = {};
for (const item of catalog) {
  const dept = item.category.split(".")[0];
  deptCounts[dept] = (deptCounts[dept] || 0) + 1;
}
const majorityDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0][0];

function deptOf(categoryId) {
  return categoryId ? categoryId.split(".")[0] : null;
}

const englishInDomain = testset.filter((t) => t.expected !== null && !t.language);
const nullCases = testset.filter((t) => t.expected === null);
const nonEnglish = testset.filter((t) => t.language);

function evaluate(name, classifyFn) {
  let correct = 0;
  const misses = [];
  for (const { task, expected } of englishInDomain) {
    const predicted = classifyFn(task);
    const predictedDept = deptOf(predicted?.id);
    if (predictedDept === deptOf(expected)) {
      correct++;
    } else {
      misses.push({ task, expected, predicted: predicted?.id ?? null });
    }
  }
  let falsePositives = 0;
  const falsePositiveDetails = [];
  for (const { task } of nullCases) {
    const predicted = classifyFn(task);
    if (predicted) {
      falsePositives++;
      falsePositiveDetails.push({ task, predicted: predicted.id });
    }
  }
  return {
    name,
    accuracy: +((correct / englishInDomain.length) * 100).toFixed(1),
    correct,
    total: englishInDomain.length,
    misses,
    falsePositiveRate: +((falsePositives / nullCases.length) * 100).toFixed(1),
    falsePositiveDetails
  };
}

// 차트/리포트에 그대로 쓰이는 라벨이라 CJK 폰트 렌더링 위험을 피하려 영어로 통일한다.
const results = [
  evaluate("frontdesk (current, word-boundary)", (t) => currentBestMatch(t, CATEGORIES)),
  evaluate("naive substring (pre-fix)", (t) => naiveBestMatch(t, CATEGORIES)),
  evaluate(`majority baseline (always dept ${majorityDept})`, () => ({ id: `${majorityDept}.0` }))
];

// 비영어(한국어/중국어) 하위셋 — 현재 구현의 알려진 한계를 수치로 남겨둔다
let nonEnglishCorrect = 0;
for (const { task, expected } of nonEnglish) {
  const predicted = currentBestMatch(task, CATEGORIES);
  if (deptOf(predicted?.id) === deptOf(expected)) nonEnglishCorrect++;
}
const nonEnglishAccuracy = +((nonEnglishCorrect / nonEnglish.length) * 100).toFixed(1);

// 속도 실측 (LLM 호출 없이 순수 정규식 매칭 — 실제 wall-clock 시간)
const ITERS = 5000;
const sample = englishInDomain[0].task;
const t0 = performance.now();
for (let i = 0; i < ITERS; i++) currentBestMatch(sample, CATEGORIES);
const t1 = performance.now();
const avgMs = (t1 - t0) / ITERS;

const report = {
  generated_at: new Date().toISOString(),
  testset_size: testset.length,
  english_in_domain: englishInDomain.length,
  null_cases: nullCases.length,
  non_english_cases: nonEnglish.length,
  results,
  non_english: { accuracy: nonEnglishAccuracy, correct: nonEnglishCorrect, total: nonEnglish.length, note: "영어 키워드만 매칭하는 현재 구현의 알려진 한계 (ARCHITECTURE.md 참고)" },
  latency_ms_per_call: +avgMs.toFixed(4),
  latency_note: `${ITERS}회 반복 측정한 실측값. LLM 호출이 없는 순수 정규식 매칭이라 토큰 비용이 0이다.`
};

mkdirSync("data", { recursive: true });
writeFileSync("data/benchmark-results.json", JSON.stringify(report, null, 2));

console.log(`\n영어 in-domain 테스트 ${englishInDomain.length}건 기준 정확도 (부서 단위):`);
for (const r of results) {
  console.log(`  ${r.name}: ${r.accuracy}% (${r.correct}/${r.total})`);
}
console.log(`\n오탐(off-domain ${nullCases.length}건 중 억지로 카테고리를 붙인 비율):`);
for (const r of results) {
  console.log(`  ${r.name}: ${r.falsePositiveRate}%`);
}
console.log(`\n비영어(한국어/중국어) ${nonEnglish.length}건 정확도: ${nonEnglishAccuracy}% (알려진 한계)`);
console.log(`분류 1회 평균 소요 시간: ${avgMs.toFixed(4)}ms (LLM 호출 없음, 토큰 비용 0)`);

// --- 차트 생성 ---
mkdirSync("assets", { recursive: true });

// 라벨은 영어로 고정한다 (README가 한국어/영어/중국어로 나뉘어도 이미지 하나를 공유하기 위함 —
// GitHub에 임베드된 SVG는 보는 사람의 폰트 환경에 따라 CJK 글자가 깨질 위험이 있다).
const accuracyChart = barChart({
  title: "Classification accuracy (English in-domain test set)",
  subtitle: `n=${englishInDomain.length}, department-level match · reproduce with \`node scripts/benchmark.mjs\``,
  bars: results.map((r, i) => ({ label: r.name, value: r.accuracy, color: ["#4f46e5", "#f59e0b", "#9ca3af"][i] })),
  unit: "%",
  maxValue: 100
});
writeFileSync("assets/benchmark-accuracy.svg", accuracyChart);

const fpChart = barChart({
  title: "False-positive rate on off-domain requests (lower is better)",
  subtitle: `n=${nullCases.length}, includes the "storage"-contains-"rag" regression case we fixed`,
  bars: results.map((r, i) => ({ label: r.name, value: r.falsePositiveRate, color: ["#4f46e5", "#dc2626", "#9ca3af"][i] })),
  unit: "%",
  maxValue: 100
});
writeFileSync("assets/benchmark-false-positive.svg", fpChart);

const comparison = JSON.parse(readFileSync("data/comparison.json", "utf8"));
const catalogChart = barChart({
  title: "Catalog size vs. similar projects (self-reported, feature comparison — not a runtime benchmark)",
  subtitle: `as of ${comparison.as_of} · figures from each project's own GitHub README/description`,
  bars: comparison.projects.map((p, i) => ({ label: p.name, value: p.catalog_size, color: ["#4f46e5", "#10b981", "#f59e0b"][i] })),
  unit: " skills",
  maxValue: Math.max(...comparison.projects.map((p) => p.catalog_size)) * 1.15
});
writeFileSync("assets/catalog-size-comparison.svg", catalogChart);

console.log("\n차트 생성 완료: assets/benchmark-accuracy.svg, assets/benchmark-false-positive.svg, assets/catalog-size-comparison.svg");

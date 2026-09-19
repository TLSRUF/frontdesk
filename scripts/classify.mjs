// data/raw/** 의 모든 항목을 읽어 taxonomy.mjs 키워드에 매칭시켜 category를 부여한다.
// 매칭 실패 항목은 unclassified.json으로 분리한다.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { allCategories } from "../taxonomy.mjs";

const RAW_DIRS = ["data/raw/github", "data/raw/skillssh"];
const CATEGORIES = allCategories();

function loadRaw() {
  const items = [];
  for (const dir of RAW_DIRS) {
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const f of files) {
      const arr = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
      items.push(...arr);
    }
  }
  return items;
}

function haystack(item) {
  return [item.name, item.description, ...(item.topics || []), item.seed_topic, item.seed_keyword]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyOne(item) {
  const text = haystack(item);
  let best = null;
  let bestHits = 0;
  for (const cat of CATEGORIES) {
    const hits = cat.keywords.filter((kw) => text.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = cat;
    }
  }
  return bestHits > 0 ? best : null;
}

const raw = loadRaw();

// owner/repo 또는 skill id 기준 중복 제거 (같은 항목이 여러 시드에서 발견될 수 있음)
const dedup = new Map();
for (const item of raw) {
  const key = item.id;
  if (!dedup.has(key)) {
    dedup.set(key, item);
  } else {
    // 이미 있으면 stars/installs가 더 큰 쪽, seed는 병합
    const existing = dedup.get(key);
    existing._seeds = existing._seeds || [existing.seed_topic || existing.seed_keyword];
    existing._seeds.push(item.seed_topic || item.seed_keyword);
  }
}

const catalog = [];
const unclassified = [];

for (const item of dedup.values()) {
  const cat = classifyOne(item);
  const entry = {
    id: item.id,
    name: item.name,
    type: item.type,
    source_url: item.source_url,
    metric: item.metric,
    description: item.description || "",
    license: item.license || null,
    install: item.install || (item.type === "github-repo" ? `git clone ${item.source_url}` : ""),
    category: cat ? cat.id : null,
    category_name: cat ? `${cat.dept} > ${cat.name}` : null
  };
  if (cat) catalog.push(entry);
  else unclassified.push(entry);
}

// 부서/카테고리, 그다음 인기도(stars 또는 installs) 순 정렬
catalog.sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category, undefined, { numeric: true });
  const pa = a.metric?.stars ?? a.metric?.installs ?? 0;
  const pb = b.metric?.stars ?? b.metric?.installs ?? 0;
  return pb - pa;
});

mkdirSync("data", { recursive: true });
writeFileSync("data/catalog.json", JSON.stringify(catalog, null, 2));
writeFileSync("data/unclassified.json", JSON.stringify(unclassified, null, 2));

console.log(`[classify] 원본 ${raw.length}건 -> 중복제거 ${dedup.size}건`);
console.log(`[classify] 분류됨 ${catalog.length}건 -> data/catalog.json`);
console.log(`[classify] 미분류 ${unclassified.length}건 -> data/unclassified.json`);

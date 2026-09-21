// data/raw/** 의 모든 항목을 읽어 taxonomy.mjs 키워드에 매칭시켜 category를 부여한다.
// 매칭 실패 항목은 unclassified.json으로 분리한다.
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { allCategories } from "../taxonomy.mjs";
import { bestMatch } from "./lib/classify-core.mjs";

const RAW_DIRS = ["data/raw/github", "data/raw/skillssh"];
const CATEGORIES = allCategories();
const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

// 키워드 매칭이 놓친 항목을 사람이 직접 읽고 분류한 예외 목록. 여기 있으면 자동 매칭보다 우선한다.
const OVERRIDES_PATH = "data/manual-overrides.json";
const manualOverrides = existsSync(OVERRIDES_PATH)
  ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")).overrides
  : {};

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

// 검색 시드(seed_topic/seed_keyword)는 skills.sh의 퍼지/시맨틱 검색이 관련 없는 결과도 섞어
// 반환하는 경우가 있어(예: "rag" 검색에 "azure-storage"가 걸림) 신뢰도가 낮다.
// 그래서 1차는 name+description+topics(신뢰도 높음)만으로 매칭하고,
// 실패했을 때만 2차로 seed까지 포함해 재시도한다(신뢰도 낮음, weak_match로 표시).
//
// skills.sh 항목의 name은 "owner/repo@skill" 형태다. repo 이름이 "awesome-copilot"이나
// "awesome-llm-apps"처럼 브랜딩성 단어를 포함하면, 그 repo의 모든 스킬이 실제 내용과 무관하게
// 그 단어로 매칭되는 문제가 생긴다. 처음엔 이걸 "약한 신호"로 격하시켰는데(강한 매칭에서만
// 제외), shubhamsaboo/awesome-llm-apps처럼 설명이 비어있는 스킬이 많은 저장소를 수집하면서
// 약한 매칭 단계에서도 같은 문제가 재발했다(예: description 없는 "technical-writer" 스킬이
// repo명의 "awesome" 때문에 엉뚱하게 "큐레이션 목록"으로 분류됨). 그래서 repo 경로는 강한
// 매칭이든 약한 매칭이든 아예 분류에 안 쓰기로 했다 — 스킬 이름 자체, 설명, 토픽, (약한
// 매칭에서만) 검색 시드만 쓴다.
function skillNameOnly(name) {
  const at = name.indexOf("@");
  return at === -1 ? name : name.slice(at + 1);
}

function haystack(item, includeSeed) {
  const parts = [skillNameOnly(item.name), item.description, ...(item.topics || [])];
  if (includeSeed) parts.push(item.seed_topic, item.seed_keyword);
  return parts.filter(Boolean).join(" ");
}

function classifyOne(item) {
  if (manualOverrides[item.id]) {
    const cat = CATEGORY_BY_ID.get(manualOverrides[item.id]);
    if (cat) return { cat, weak: false, manual: true };
  }
  const strong = bestMatch(haystack(item, false), CATEGORIES);
  if (strong) return { cat: strong, weak: false };
  const weak = bestMatch(haystack(item, true), CATEGORIES);
  return weak ? { cat: weak, weak: true } : null;
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

let weakCount = 0;
for (const item of dedup.values()) {
  const result = classifyOne(item);
  const entry = {
    id: item.id,
    name: item.name,
    type: item.type,
    source_url: item.source_url,
    metric: item.metric,
    description: item.description || "",
    license: item.license || null,
    install: item.install || (item.type === "github-repo" ? `git clone ${item.source_url}` : ""),
    category: result ? result.cat.id : null,
    category_name: result ? `${result.cat.dept} > ${result.cat.name}` : null,
    weak_match: result ? result.weak : undefined,
    manual_override: result?.manual ? true : undefined
  };
  if (result) {
    catalog.push(entry);
    if (result.weak) weakCount++;
  } else {
    unclassified.push(entry);
  }
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
console.log(`[classify] 분류됨 ${catalog.length}건 (약한 매칭 ${weakCount}건 포함) -> data/catalog.json`);
console.log(`[classify] 미분류 ${unclassified.length}건 -> data/unclassified.json`);

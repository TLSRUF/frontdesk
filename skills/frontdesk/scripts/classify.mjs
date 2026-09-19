// data/raw/** 의 모든 항목을 읽어 taxonomy.mjs 키워드에 매칭시켜 category를 부여한다.
// 매칭 실패 항목은 unclassified.json으로 분리한다.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { allCategories } from "../taxonomy.mjs";
import { bestMatch } from "./lib/classify-core.mjs";

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

// 검색 시드(seed_topic/seed_keyword)는 skills.sh의 퍼지/시맨틱 검색이 관련 없는 결과도 섞어
// 반환하는 경우가 있어(예: "rag" 검색에 "azure-storage"가 걸림) 신뢰도가 낮다.
// 그래서 1차는 name+description+topics(신뢰도 높음)만으로 매칭하고,
// 실패했을 때만 2차로 seed까지 포함해 재시도한다(신뢰도 낮음, weak_match로 표시).
//
// skills.sh 항목의 name은 "owner/repo@skill" 형태다. repo 이름이 "awesome-copilot"처럼
// 브랜딩성 단어를 포함하면, 그 repo의 모든 스킬이 실제 내용과 무관하게 그 단어로 강하게
// 매칭되는 문제가 생긴다(예: pytest-coverage 스킬이 repo명의 "awesome" 때문에
// "큐레이션 목록" 카테고리로 잘못 분류됨). 그래서 repo 경로는 약한 신호로만 쓰고,
// 스킬 이름 자체(및 설명/토픽)만 강한 신호로 쓴다.
function splitSkillName(name) {
  const at = name.indexOf("@");
  if (at === -1) return { strongPart: name, weakPart: "" };
  return { strongPart: name.slice(at + 1), weakPart: name.slice(0, at) };
}

function haystack(item, includeSeed) {
  const { strongPart, weakPart } = splitSkillName(item.name);
  const parts = [strongPart, item.description, ...(item.topics || [])];
  if (includeSeed) parts.push(weakPart, item.seed_topic, item.seed_keyword);
  return parts.filter(Boolean).join(" ");
}

function classifyOne(item) {
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
    weak_match: result ? result.weak : undefined
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

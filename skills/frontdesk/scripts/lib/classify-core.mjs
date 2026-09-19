// classify.mjs와 route.mjs가 공유하는 키워드 매칭 로직.
export const normalize = (s) => s.toLowerCase().replace(/[-_/@]/g, " ");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const keywordRegexCache = new Map();
export function keywordRegex(kw) {
  const norm = normalize(kw);
  if (!keywordRegexCache.has(norm)) {
    // 시작 경계(\b)만 강제한다: "storage"가 "rag"를 포함한다는 식의 중간-단어
    // 오탐은 막으면서, "product requirement"가 "product requirements"(복수형)에는
    // 걸리도록 끝은 열어 둔다.
    keywordRegexCache.set(norm, new RegExp(`\\b${escapeRegex(norm)}\\w*`));
  }
  return keywordRegexCache.get(norm);
}

export function matchingCategories(text, categories) {
  const norm = normalize(text);
  return categories
    .map((cat) => ({ cat, hits: cat.keywords.filter((kw) => keywordRegex(kw).test(norm)).length }))
    .filter((m) => m.hits > 0)
    .sort((a, b) => b.hits - a.hits);
}

export function bestMatch(text, categories) {
  const matches = matchingCategories(text, categories);
  return matches[0]?.cat ?? null;
}

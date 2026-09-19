// route.mjs, pipeline.mjs, pick-best-of-breed.mjs가 각자 구현하던 "카테고리 안에서
// 상위 후보 뽑기" 로직을 하나로 합친 것.
//
// 정직한 한계: health_score(저장소 건강도)는 대부분의 항목이 90~100에 몰려있어
// (이 생태계 자체가 2026년 기준 활발한 트렌드라 대부분 최근에 관리되고 있음)
// 세밀한 순위를 매기는 데는 안 맞는다. 그래서 순위(sort)는 여전히 installs/stars로
// 매기고, health_score는 "방치되었거나(archived) 라이선스도 없고 아무도 fork 안 한"
// 것들을 걸러내는 최소 기준선(필터)으로만 쓴다. weak_match(신뢰도 낮은 분류)도 기본
// 제외한다.
export const MIN_HEALTH = 40;

export function isHealthy(item, minHealth = MIN_HEALTH) {
  return item.health_score == null || item.health_score >= minHealth;
}

export function rankedCandidates(catalog, categoryId, { n = 3, allowWeak = false, minHealth = MIN_HEALTH } = {}) {
  return catalog
    .filter((it) => it.category === categoryId)
    .filter((it) => allowWeak || !it.weak_match)
    .filter((it) => isHealthy(it, minHealth))
    .sort((a, b) => (b.metric?.stars ?? b.metric?.installs ?? 0) - (a.metric?.stars ?? a.metric?.installs ?? 0))
    .slice(0, n);
}

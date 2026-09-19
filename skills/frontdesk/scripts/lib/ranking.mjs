// route.mjs, pipeline.mjs, pick-best-of-breed.mjs가 각자 구현하던 "카테고리 안에서
// 상위 후보 뽑기" 로직을 하나로 합친 것.
//
// 정직한 한계: health_score(저장소 건강도)는 대부분의 항목이 90~100에 몰려있어
// (이 생태계 자체가 2026년 기준 활발한 트렌드라 대부분 최근에 관리되고 있음)
// 세밀한 순위를 매기는 데는 안 맞는다. audit_score(Socket/Snyk 등 보안 감사, skills.sh의
// 공개 감사 API에서 가져옴)는 훨씬 변별력이 좋다(8~94점 분포). 그래도 이건 "안전한가"를
// 재는 것이지 "일을 잘하는가"를 재는 게 아니다 — 그래서 둘 다 순위(sort)가 아니라
// 최소 기준선(필터)으로만 쓴다. 순위는 여전히 installs/stars다. weak_match(신뢰도 낮은
// 분류)도 기본 제외한다.
export const MIN_HEALTH = 40;
export const MIN_AUDIT = 50;

export function isHealthy(item, minHealth = MIN_HEALTH) {
  return item.health_score == null || item.health_score >= minHealth;
}

export function isSafe(item, minAudit = MIN_AUDIT) {
  return item.audit_score == null || item.audit_score >= minAudit;
}

export function rankedCandidates(
  catalog,
  categoryId,
  { n = 3, allowWeak = false, minHealth = MIN_HEALTH, minAudit = MIN_AUDIT } = {}
) {
  return catalog
    .filter((it) => it.category === categoryId)
    .filter((it) => allowWeak || !it.weak_match)
    .filter((it) => isHealthy(it, minHealth))
    .filter((it) => isSafe(it, minAudit))
    .sort((a, b) => (b.metric?.stars ?? b.metric?.installs ?? 0) - (a.metric?.stars ?? a.metric?.installs ?? 0))
    .slice(0, n);
}

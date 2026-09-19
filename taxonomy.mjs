// 실제 개발 회사 조직도를 본떠 세분화한 분류 체계.
// 각 세부 분야는 id(부서.일련번호), name, keywords(자동 분류용 힌트)를 가진다.
// keywords는 소문자로 비교되며 repo/skill의 name+description+topics에 대해 substring 매칭된다.

export const departments = [
  {
    id: "1",
    name: "전략/기획 (Strategy)",
    categories: [
      { id: "1.1", name: "시장조사/경쟁분석", keywords: ["market research", "competitive analysis", "competitor", "market analysis"] },
      { id: "1.2", name: "아이디어 검증", keywords: ["idea validation", "ideation", "brainstorm", "concept validation", "mvp"] },
      { id: "1.3", name: "비즈니스모델/수익화", keywords: ["business model", "monetization", "revenue model", "saas pricing"] },
      { id: "1.4", name: "프라이싱 전략", keywords: ["pricing strategy", "pricing", "price optimization"] },
      { id: "1.5", name: "투자유치/피치덱", keywords: ["pitch deck", "fundraising", "investor", "startup pitch"] }
    ]
  },
  {
    id: "2",
    name: "프로덕트 매니지먼트",
    categories: [
      { id: "2.1", name: "PRD/요구사항 작성", keywords: ["prd", "product requirement", "spec writing", "requirements doc"] },
      { id: "2.2", name: "로드맵/우선순위", keywords: ["roadmap", "prioritization", "backlog"] },
      { id: "2.3", name: "유저 리서치/피드백", keywords: ["user research", "user interview", "feedback analysis", "customer research"] },
      { id: "2.4", name: "지표/분석 정의", keywords: ["product analytics", "metrics definition", "kpi", "north star metric"] }
    ]
  },
  {
    id: "3",
    name: "디자인",
    categories: [
      { id: "3.1", name: "UX/와이어프레임", keywords: ["wireframe", "ux design", "user flow", "ux research"] },
      { id: "3.2", name: "UI 비주얼 디자인", keywords: ["ui design", "visual design", "figma"] },
      { id: "3.3", name: "디자인 시스템", keywords: ["design system", "component library", "design tokens"] },
      { id: "3.4", name: "프로토타이핑", keywords: ["prototyping", "prototype", "mockup"] },
      { id: "3.5", name: "접근성 (a11y)", keywords: ["accessibility", "a11y", "wcag"] },
      { id: "3.6", name: "브랜딩/에셋 생성", keywords: ["branding", "logo design", "illustration", "asset generation", "icon design"] }
    ]
  },
  {
    id: "4",
    name: "엔지니어링-프론트엔드",
    categories: [
      { id: "4.1", name: "웹 프론트엔드", keywords: ["react", "vue", "svelte", "next.js", "nextjs", "frontend", "tailwind"] },
      { id: "4.2", name: "모바일", keywords: ["react native", "flutter", "ios development", "android development", "swiftui"] },
      { id: "4.3", name: "프론트엔드 성능", keywords: ["web vitals", "frontend performance", "bundle size", "lighthouse"] }
    ]
  },
  {
    id: "5",
    name: "엔지니어링-백엔드",
    categories: [
      { id: "5.1", name: "API 설계", keywords: ["api design", "rest api", "graphql", "openapi"] },
      { id: "5.2", name: "DB/마이그레이션", keywords: ["database migration", "schema design", "sql", "postgres", "orm"] },
      { id: "5.3", name: "인증/Identity", keywords: ["authentication", "oauth", "identity", "authorization", "jwt"] },
      { id: "5.4", name: "마이크로서비스/아키텍처", keywords: ["microservices", "backend architecture", "distributed systems"] }
    ]
  },
  {
    id: "6",
    name: "엔지니어링-인프라/DevOps",
    categories: [
      { id: "6.1", name: "CI/CD", keywords: ["ci/cd", "github actions", "continuous deployment", "pipeline"] },
      { id: "6.2", name: "IaC", keywords: ["terraform", "pulumi", "infrastructure as code", "cloudformation", "iac"] },
      { id: "6.3", name: "옵저버빌리티/모니터링", keywords: ["observability", "monitoring", "logging", "tracing", "grafana"] },
      { id: "6.4", name: "FinOps/비용최적화", keywords: ["finops", "cost optimization", "cloud cost"] }
    ]
  },
  {
    id: "7",
    name: "엔지니어링-데이터/ML/AI",
    categories: [
      { id: "7.1", name: "데이터 파이프라인/ETL", keywords: ["etl", "data pipeline", "data engineering"] },
      { id: "7.2", name: "모델 학습", keywords: ["model training", "fine-tuning", "machine learning", "pytorch"] },
      { id: "7.3", name: "RAG/벡터검색", keywords: ["rag", "retrieval augmented generation", "vector search", "embeddings", "vector database"] },
      { id: "7.4", name: "에이전트 오케스트레이션/프롬프트엔지니어링", keywords: ["agent orchestration", "prompt engineering", "multi-agent", "llm agent", "ai agent"] },
      { id: "7.5", name: "평가/벤치마크", keywords: ["evaluation", "benchmark", "llm eval", "promptfoo"] }
    ]
  },
  {
    id: "8",
    name: "품질/보안",
    categories: [
      { id: "8.1", name: "테스트 자동화", keywords: ["test automation", "unit testing", "e2e testing", "playwright", "testing"] },
      { id: "8.2", name: "코드 리뷰", keywords: ["code review", "pr review", "static analysis"] },
      { id: "8.3", name: "보안 리뷰/pentest", keywords: ["security review", "pentest", "vulnerability scan", "security audit"] },
      { id: "8.4", name: "부하/성능 테스트", keywords: ["load testing", "performance testing", "stress test"] }
    ]
  },
  {
    id: "9",
    name: "마케팅/그로스",
    categories: [
      { id: "9.1", name: "SEO", keywords: ["seo", "search engine optimization"] },
      { id: "9.2", name: "콘텐츠/카피라이팅", keywords: ["copywriting", "content marketing", "blog writing"] },
      { id: "9.3", name: "유료광고", keywords: ["paid ads", "google ads", "facebook ads", "ad campaign"] },
      { id: "9.4", name: "SNS 마케팅", keywords: ["social media marketing", "instagram", "tiktok marketing"] },
      { id: "9.5", name: "이메일/CRM", keywords: ["email marketing", "crm", "lifecycle marketing", "newsletter"] },
      { id: "9.6", name: "그로스 실험/A-B테스트", keywords: ["growth hacking", "a/b testing", "ab-testing", "conversion optimization"] }
    ]
  },
  {
    id: "10",
    name: "세일즈/매출",
    categories: [
      { id: "10.1", name: "세일즈 아웃리치", keywords: ["sales outreach", "cold email", "lead generation"] },
      { id: "10.2", name: "결제/빌링 연동", keywords: ["stripe", "billing", "payment integration", "subscription billing"] },
      { id: "10.3", name: "고객지원 자동화", keywords: ["customer support", "helpdesk", "support automation", "chatbot support"] }
    ]
  },
  {
    id: "11",
    name: "운영/거버넌스",
    categories: [
      { id: "11.1", name: "프로젝트 관리", keywords: ["project management", "task tracking", "jira", "linear"] },
      { id: "11.2", name: "문서화", keywords: ["documentation generation", "docs generation", "technical writing"] },
      { id: "11.3", name: "법무/컴플라이언스", keywords: ["compliance", "legal document", "terms of service", "gdpr"] },
      { id: "11.4", name: "채용/HR", keywords: ["hiring", "job description", "recruiting", "hr automation"] }
    ]
  },
  {
    id: "12",
    name: "메타/효율화 레이어",
    categories: [
      { id: "12.1", name: "토큰 절약/프롬프트 압축", keywords: ["token efficient", "prompt compression", "context compression", "yagni", "ponytail", "few token", "reduce token", "token consumption", "less code", "meta-prompting", "context engineering"] },
      { id: "12.2", name: "에이전트 라우팅 메타에이전트", keywords: ["agent router", "orchestrator", "swarm", "agent coordination"] },
      { id: "12.3", name: "메모리/컨텍스트 관리", keywords: ["agent memory", "context management", "long-term memory", "rag memory", "self-correcting memory", "remembers"] },
      { id: "12.4", name: "멀티에이전트 조율 프레임워크", keywords: ["langchain", "autogen", "crewai", "multi-agent framework"] }
    ]
  },
  {
    id: "13",
    name: "AI 에이전트 생태계/메타 도구",
    categories: [
      { id: "13.1", name: "큐레이션 목록/스킬 레지스트리", keywords: ["awesome", "curated list", "curated collection", "skills marketplace"] },
      { id: "13.2", name: "범용 코딩 에이전트/하네스", keywords: ["agent harness", "coding agent from scratch", "build a coding agent", "agent builder", "terminal agent", "ai gateway", "agent organization", "spec-driven", "vibecode", "vibe coding"] },
      { id: "13.3", name: "에이전트 안전/거버넌스", keywords: ["safety net", "guardrail", "destructive git", "pre-execution guard"] },
      { id: "13.4", name: "IDE 규칙/컨벤션", keywords: ["cursor rules", ".mdc", "coding convention", "output-style", "agents.md"] },
      { id: "13.5", name: "세션/워크플로 유틸리티", keywords: ["session manager", "resume any ai coding session", "cross-model", "terminal session", "workflow for ai coding"] }
    ]
  }
];

export function allCategories() {
  return departments.flatMap((d) => d.categories.map((c) => ({ ...c, dept: d.name, deptId: d.id })));
}

# frontdesk (技能)

<sub><a href="README.md">한국어</a> &middot; <a href="README.en.md">English</a></sub>

这个文件夹(包括 [`SKILL.md`](SKILL.md))是一个**自包含的技能包**,可以原样安装到其他项目中。项目的整体背景和设计文档请参见仓库根目录的 [`README.md`](../../README.md) 和 [`ARCHITECTURE.md`](../../ARCHITECTURE.md)。

## 安装

```bash
npx skills add TLSRUF/frontdesk@frontdesk
```

或者直接用 git URL 安装(两种方式都已实测可用):

```bash
npx skills add https://github.com/TLSRUF/frontdesk
```

skills.sh 并没有单独的提交/审核流程 —— 只要公开仓库里有 `SKILL.md`,任何人都能立即用上面的命令安装;排行榜上的曝光似乎是根据实际安装的遥测数据而定(已核实 `vercel-labs/skills` 仓库,详见 [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md))。

安装后,Claude 在遇到"这个任务有没有现成的技能/工具可用"这类情况时会自动参考这个技能。手动检查的方法:

```bash
node scripts/route.mjs "recommend a testing automation tool"
```

## 文件夹结构

- `SKILL.md` —— Claude(或其他智能体)实际读取的技能定义
- `taxonomy.mjs` —— 13 个部门的分类体系
- `data/catalog.json` —— 分类后的目录原始数据(1,348 条)
- `data/unclassified.json` —— 自动分类失败的条目(9 条 —— 嵌入式开发工具、研究档案等确实不适合这套分类体系的内容)
- `data/manual-overrides.json` —— 关键词匹配漏掉的条目,由人工分类的例外列表(14 条;`classify.mjs` 会优先应用这些,再进行自动匹配)
- `scripts/` —— 采集(`collect-*.mjs`)→ 分类(`classify.mjs`)→ 补充(`enrich-descriptions.mjs`)→ 健康度(`repo-health.mjs`)→ 安全审计(`audit-scores.mjs`)→ 生成文档(`build-catalog-md.mjs`)→ 路由(`route.mjs`)→ 基准测试(`benchmark.mjs`)→ 启动包(`pick-best-of-breed.mjs`、`install-starter-pack.mjs`)→ 流水线(`pipeline.mjs`)的完整流水线
- `CATALOG.md` —— 面向人类阅读的完整目录列表
- `BENCHMARK.md` —— 分类准确率/误判率基准测试,以及与同类项目的规模对比
- `data/starter-pack.json` —— 各部门代表技能列表(用 `npm run starter-pack` 重新生成)
- `data/starter-pack-llm-judge.json` —— 对这 12 个候选实际阅读 SKILL.md 内容后的评分结果(包含一个"安装量第一并非最佳选择"的真实案例)

用 `npm run all` 更新目录,用 `npm run benchmark` 运行基准测试,用 `node scripts/install-starter-pack.mjs --yes` 安装启动包,用 `node scripts/pipeline.mjs "项目描述"` 运行流水线(详见仓库根目录 README)。

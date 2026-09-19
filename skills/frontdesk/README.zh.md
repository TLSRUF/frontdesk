# frontdesk (技能)

<sub><a href="README.md">한국어</a> &middot; <a href="README.en.md">English</a></sub>

这个文件夹(包括 [`SKILL.md`](SKILL.md))是一个**自包含的技能包**,可以原样安装到其他项目中。项目的整体背景和设计文档请参见仓库根目录的 [`README.md`](../../README.md) 和 [`ARCHITECTURE.md`](../../ARCHITECTURE.md)。

## 安装

```bash
npx skills add TLSRUF/frontdesk@frontdesk
```

或者在 Claude Code 中直接指向该仓库安装(在 skills.sh 索引正式收录之前推荐这种方式):

```bash
npx skills add https://github.com/TLSRUF/frontdesk
```

安装后,Claude 在遇到"这个任务有没有现成的技能/工具可用"这类情况时会自动参考这个技能。手动检查的方法:

```bash
node scripts/route.mjs "recommend a testing automation tool"
```

## 文件夹结构

- `SKILL.md` —— Claude(或其他智能体)实际读取的技能定义
- `taxonomy.mjs` —— 13 个部门的分类体系
- `data/catalog.json` —— 分类后的目录原始数据(1,311 条)
- `scripts/` —— 采集(`collect-*.mjs`)→ 分类(`classify.mjs`)→ 补充(`enrich-descriptions.mjs`)→ 生成文档(`build-catalog-md.mjs`)→ 路由(`route.mjs`)→ 基准测试(`benchmark.mjs`)的完整流水线
- `CATALOG.md` —— 面向人类阅读的完整目录列表
- `BENCHMARK.md` —— 分类准确率/误判率基准测试,以及与同类项目的规模对比

用 `npm run all` 更新目录,用 `npm run benchmark` 运行基准测试(详见仓库根目录 README)。

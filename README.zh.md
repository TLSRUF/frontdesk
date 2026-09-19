# frontdesk

<sub><a href="README.md">한국어</a> &middot; <a href="README.en.md">English</a></sub>

AI 开发请求的"前台" — 收到请求时不会立刻调用笨重的通用智能体,而是先判断这属于 13 个部门(从战略/创意验证到工程、设计、市场营销)中的哪一个。这是打造一个能一次性处理软件公司全部职能(从创意验证到收入模式、市场营销、设计、开发)的统一 AI 工具的第一步。它是从 GitHub 和 [skills.sh](https://skills.sh) 收集的 AI 开发者智能体/技能目录,按真实公司组织架构的粒度进行了细致分类。

## 这个项目本身也是一个可安装的 Skill

`skills/frontdesk/` 是一个遵循 [Agent Skills 规范](https://skills.sh) 的自包含技能包 —— 安装方式和安装 [ponytail](https://github.com/DietrichGebert/ponytail) 一样:

```bash
npx skills add TLSRUF/frontdesk@frontdesk
```

安装后,Claude 在处理任务前会先确认"是否已经有现成的技能可以解决这个问题"。技能本身的使用说明见 [`skills/frontdesk/SKILL.md`](skills/frontdesk/SKILL.md),面向人类阅读的介绍见 [`skills/frontdesk/README.md`](skills/frontdesk/README.md)。

## 产出物

- **[skills/frontdesk/CATALOG.md](skills/frontdesk/CATALOG.md)** —— 按 13 个部门 / 约 57 个细分领域分类的 1,311 条智能体/技能列表(面向人类阅读的最终成果)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** —— 基于这个目录构建统一编排器的设计方向,以及基于规则的路由器原型说明(把 [ponytail](https://github.com/DietrichGebert/ponytail) 的低 token 判断阶梯应用到"选择智能体"而非"写代码"上)
- **[skills/frontdesk/taxonomy.mjs](skills/frontdesk/taxonomy.mjs)** —— 分类体系定义(部门/细分领域/关键词提示)
- **`skills/frontdesk/data/catalog.json`** —— 分类后的最终数据(机器可读的原始数据)
- **`skills/frontdesk/data/unclassified.json`** —— 自动分类失败的条目(供人工复核,共 23 条)
- **`skills/frontdesk/scripts/route.mjs`** —— 判断阶梯路由器原型(`npm run route -- "任务描述"`)

## 启动包(Starter Pack)与流水线(Pipeline)

- **启动包** —— 满足"只装这一个,各部门最好的技能就自动齐全"这个诉求。`npm run starter-pack` 会在 13 个部门中,从分类置信度高、且**未被废弃**的条目里挑出安装量最高的一个(目前共 12 个部门有结果)——是否废弃通过 `health_score` 判断,依据是 GitHub 是否标记为 archived、有没有许可证、以及 fork 数。然后用 `node scripts/install-starter-pack.mjs --yes` 一次性全部安装。**需要说明:这里选的是"在仍被维护的技能里安装量最高"的,而不是"性能最好"的技能** —— 目前仍然没有衡量真实性能的方法(我们也试过用 Reddit 提及次数作为替代指标,但连 ponytail 都搜不到任何有效信号,所以放弃了这个思路)。
- **流水线** —— 复用现有的目录/路由器,按"创意 → 产品定义 → 设计 → 开发 → 质量/安全 → 市场营销/销售 → 部署 → 运维"8 个阶段给出建议:`node scripts/pipeline.mjs "项目描述"`。由于部署和运维会影响真实服务,这个流水线设计为**每个阶段都需要人工确认后才进入下一阶段**,而不是从头到尾全自动执行。

完整的设计考量和局限性见 [`ARCHITECTURE.md`](ARCHITECTURE.md) 中的"스타터팩"/"파이프라인"/"목표 대비 현황"章节(标题是韩文,但代码块和表格本身不受语言影响)。

## 性能 / 基准测试

<img src="skills/frontdesk/assets/benchmark-accuracy.svg" alt="Classification accuracy comparison" width="600">
<img src="skills/frontdesk/assets/benchmark-false-positive.svg" alt="False positive rate comparison" width="600">

我们用自己编写的 87 条测试任务实测了路由器的分类准确率(可用 `node scripts/benchmark.mjs` 复现):

| | 准确率(英文 78 条) | 误判率(领域外 4 条) |
|---|---:|---:|
| **frontdesk(当前版本)** | **88.5%** | **0%** |
| 朴素子字符串匹配(本项目最初的做法) | 87.2% | 25% |
| 多数基线(总是猜同一个部门) | 7.7% | 100% |

真正有意义的差距不是准确率(88.5% vs 87.2%),而是**误判率(0% vs 25%)** —— 朴素匹配方式仅仅因为单词 "storage" 里包含子字符串 "rag",就把完全无关的请求错误分类到 `7.3 RAG/向量检索`,这是我们在开发过程中实际发现并修复的一个 bug。单次分类平均耗时 0.05 毫秒,不调用 LLM,token 成本为零。

与类似的目录型项目在规模上的对比(这是各项目自行公开的数字对比,不是运行性能基准测试):

<img src="skills/frontdesk/assets/catalog-size-comparison.svg" alt="Catalog size comparison" width="600">

完整方法论、发现的 bug 和已知局限详见 [`skills/frontdesk/BENCHMARK.md`](skills/frontdesk/BENCHMARK.md)(韩语撰写,但图表和数字本身不受语言影响)。

## 重新生成目录

在 `skills/frontdesk/` 目录下:

```bash
npm run all   # collect:github → collect:skillssh → classify → enrich → build:catalog → starter-pack
```

各步骤:

```bash
npm run collect:github    # 用 gh CLI 收集 GitHub 仓库 (data/raw/github/)
npm run collect:skillssh  # 用 `npx skills search` 收集 skills.sh 技能 (data/raw/skillssh/)
npm run classify          # 用 taxonomy.mjs 的关键词自动分类 → data/catalog.json(每次都会从原始数据重新生成)
npm run enrich            # 从热门 skills.sh 条目的 SKILL.md 中回填真实描述
npm run build:catalog     # 生成 CATALOG.md
npm run repo-health       # 计算 health_score(是否废弃/许可证/fork 数)→ 合并进 catalog.json(有缓存,只抓取新仓库)
npm run starter-pack      # 挑选各部门的代表技能 → data/starter-pack.json
npm run install-starter-pack -- --yes   # 实际安装启动包
npm run pipeline -- "项目描述"            # 打印 8 阶段流水线路线图
npm run route -- "recommend a testing automation tool"   # 路由器演示
npm run benchmark         # 运行准确率/误判率基准测试并重新生成图表
```

`classify` 每次都会从原始数据完整重建目录,所以必须在 `enrich` 之前执行(顺序颠倒会导致已回填的描述被清空)。`npm run all` 已经保证了这个顺序。

需要已登录的 `gh` CLI(`gh auth status`)和 Node.js 18+。

## 采集范围

- **GitHub**:27 个种子主题(`agent-skills`、`ai-agents`、`mcp-server`、`rag`、`terraform`、`product-management`、`sales-automation` 等),star 数 30 以上
- **skills.sh**:36 个关键词(每个部门的代表性关键词)

这是覆盖 13 个部门的代表性样本,而非全量抓取。在 `skills/frontdesk/scripts/collect-*.mjs` 中添加种子即可扩展。

## 为什么把脚本/数据全部放进技能文件夹

`npx skills add` 和 Claude Code 插件安装**只会复制 `skills/<name>/` 这一个文件夹**(我们直接查看了 vercel-labs/agent-skills 和 anthropics/skills 的真实仓库结构确认了这一点)。因此路由器依赖的 `taxonomy.mjs`、`data/catalog.json`、`scripts/*.mjs` 都必须放在这个文件夹里面,这样别人安装后,即使没有整个仓库,单靠这个技能文件夹也能独立运行。仓库根目录只保留面向人类的设计文档(`README.md`、`ARCHITECTURE.md`、`LICENSE`)。

## 为什么用 gh CLI / skills CLI 而不是 Playwright

最初的计划是用 Playwright 直接爬取 GitHub 和 skills.sh,但调研后发现:
- GitHub:`gh` CLI(REST 搜索 API)已经完成身份验证,能立即返回结构化的 JSON。
- skills.sh:其公开 REST API 需要身份验证,但官方 CLI(`npx skills search`)无需验证即可返回相同的数据。

两者都比浏览器渲染更轻量、更稳定,能获取到同样的数据,因此我们采用了这种方式。(详见 ARCHITECTURE.md)

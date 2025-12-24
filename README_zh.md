# agent-foreman

> AI Agent 长任务执行框架 — 让 AI 像人类团队一样高效协作

[![npm version](https://img.shields.io/npm/v/agent-foreman.svg)](https://www.npmjs.com/package/agent-foreman)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | [详细使用指南](./docs/USAGE.md)

## 痛点

AI 编程助手在处理复杂项目时，常常会掉进这三个坑：

1. **贪多嚼不烂** — 试图一口气搞定所有功能，结果代码乱成一团
2. **虎头蛇尾** — 还没验证就急着宣布「搞定了」，实际一堆 bug
3. **走过场式测试** — 测试覆盖不到位，上线后问题频出

## 破局之道

**agent-foreman** 提供了一套结构化的工作框架，让 AI 能够：

- 通过外部文件**持久化记忆**，不再「失忆」
- **专注单一功能**，配合清晰的验收标准
- 通过进度日志实现**无缝交接**，换个 Agent 接着干
- **追踪变更影响**，改一处知全局

---

## 安装

```bash
# 快速安装（二进制）
curl -fsSL https://raw.githubusercontent.com/mylukin/agent-foreman/main/scripts/install.sh | bash

# 通过 npm
npm install -g agent-foreman

# 或直接使用 npx
npx agent-foreman --help
```

手动下载：[GitHub Releases](https://github.com/mylukin/agent-foreman/releases)

---

## Claude Code 插件（推荐）

agent-foreman 设计为 **Claude Code 插件**，这是推荐的使用方式。

### 1. 安装插件

```
/plugin marketplace add mylukin/agent-foreman
/plugin install agent-foreman
```

### 2. 斜杠命令

| 命令 | 说明 |
|------|------|
| `/agent-foreman:status` | 查看项目状态和进度 |
| `/agent-foreman:init` | 用项目目标初始化框架 |
| `/agent-foreman:analyze` | 分析现有项目结构 |
| `/agent-foreman:spec` | 通过多专家委员会将需求转化为任务文件 |
| `/agent-foreman:next` | 获取下一个优先任务 |
| `/agent-foreman:run` | 自动完成所有待办任务 |

### 3. 使用示例

**初始化新项目：**
```
/agent-foreman:init 搭建一个用户管理 REST API
```

**查看状态并开始工作：**
```
/agent-foreman:status
/agent-foreman:next
```

**自动完成所有任务：**
```
/agent-foreman:run
```

**处理指定任务：**
```
/agent-foreman:run auth.login
```

### 4. 命令参数

命令支持自然语言和标志参数：

```
/agent-foreman:init --mode new        # 全新开始，替换现有
/agent-foreman:init --mode scan       # 仅预览，不保存
/agent-foreman:analyze --verbose      # 详细输出
```

---

## CLI 命令

独立使用 CLI（不通过 Claude Code）：

| 命令 | 说明 |
|------|------|
| `init [goal]` | 初始化或升级框架 |
| `init --analyze` | 仅生成 ARCHITECTURE.md |
| `init --scan` | 仅检测验证能力 |
| `next [feature_id]` | 显示下一个待处理任务 |
| `status` | 显示当前项目状态 |
| `check [feature_id]` | 验证代码变更或任务完成状态 |
| `done <feature_id>` | 验证、标记完成并自动提交 |
| `fail <feature_id>` | 标记任务为失败 |
| `impact <feature_id>` | 分析变更影响 |
| `tdd [mode]` | 查看或设置 TDD 模式 (strict/recommended/disabled) |
| `agents` | 显示可用的 AI 代理 |
| `install` | 安装 Claude Code 插件 |
| `uninstall` | 卸载 Claude Code 插件 |

详细参数请参阅 [详细使用指南](./docs/USAGE.md)。

---

## 为什么管用

道理很简单：**AI 需要和人类团队一样的协作工具**。

人类工程师也不靠脑子记事。我们用：
- Git 管理版本
- Issue 跟踪任务
- 文档做交接
- 测试保质量

agent-foreman 把这套打法搬给了 AI：

| 人类的做法 | AI 的等价物 |
|-----------|------------|
| Scrum 看板 | `ai/tasks/index.json` |
| 站会纪要 | `progress.log` |
| CI/CD 流水线 | `init.sh check` |
| Code Review | 验收标准 |

### 结构化存储格式

每个任务以 Markdown 文件存储，包含 YAML frontmatter：

```yaml
---
id: auth.login
status: failing
priority: 1
---
# 用户可以登录

## 验收标准
1. 有效凭证返回 JWT 令牌
2. 无效凭证返回 401 错误
```

该格式的优势：
- **人类可读** — 便于查看和编辑
- **结构化元数据** — YAML frontmatter 用于状态追踪
- **模式验证** — 防止无效状态
- **Git 友好** — 清晰的 diff 便于代码审查

---

## 工作流程

agent-foreman 采用 **TDD (测试驱动开发)** 理念：先定义验收标准，再实现功能，最后验证通过。

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          AGENT-FOREMAN 工作流                             │
│                        (基于 TDD 测试驱动开发)                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  初始化阶段                                                               │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐                            │
│  │ analyze │───▶│   scan   │───▶│   init   │                            │
│  │ 分析项目 │    │ 扫描能力 │    │ 生成配置 │                            │
│  └─────────┘    └──────────┘    └──────────┘                            │
│                                       │                                  │
│                                       ▼                                  │
│                             定义验收标准 (RED)                            │
│                             ai/tasks/index.json                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TDD 开发循环                                                             │
│                                                                          │
│      ┌──────────────────────────────────────────────────────┐           │
│      │                          循环                        │           │
│      ▼                                                      │           │
│  ┌──────────┐    ┌──────────────────────────────────────┐  │           │
│  │  next    │───▶│  RED: 查看验收标准 (预期行为)         │  │           │
│  │ 获取任务 │    │  验收标准 = 失败的测试用例             │  │           │
│  └──────────┘    └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                  ┌──────────────────────────────────────┐  │           │
│                  │  GREEN: 实现功能                      │  │           │
│                  │  编写最少代码让验收标准通过            │  │           │
│                  └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                  ┌──────────────────────────────────────┐  │           │
│                  │  check <id> (可选)                    │  │           │
│                  │  - 运行测试验证实现                   │  │           │
│                  │  - AI 验证验收标准                    │  │           │
│                  └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                  ┌──────────────────────────────────────┐  │           │
│                  │  done <id>                            │  │           │
│                  │  - 标记功能完成                       │  │           │
│                  │  - 自动提交 (REFACTOR 可选)           │  │           │
│                  └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                          ┌───────────────┐                 │           │
│                          │ 还有任务？    │─────有──────────┘           │
│                          └───────────────┘                              │
│                                   │ 没有                                │
│                                   ▼                                     │
│                  ┌───────────────────────────────────────┐             │
│                  │  全部通过！(100%)                     │             │
│                  │  ARCHITECTURE.md 已更新               │             │
│                  └───────────────────────────────────────┘             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**TDD 核心理念：**
- **RED** — 先定义验收标准（等同于失败的测试）
- **GREEN** — 编写最少代码让标准通过
- **REFACTOR** — 在测试保护下重构优化

---

## 核心文件

| 文件 | 用途 |
|------|------|
| `ai/tasks/index.json` | 任务索引，带状态摘要 |
| `ai/tasks/{module}/{id}.md` | 单个任务定义 (Markdown + YAML frontmatter) |
| `ai/progress.log` | 进度日志，用于会话交接 |
| `ai/init.sh` | 环境启动脚本 |
| `ai/capabilities.json` | 项目能力缓存 |
| `CLAUDE.md` | AI 代理指令文件 |
| `docs/ARCHITECTURE.md` | AI 生成的项目架构文档 |

## 功能状态

| 状态 | 含义 |
|------|------|
| `failing` | 待实现 |
| `passing` | 已完成验收 |
| `blocked` | 被外部依赖卡住 |
| `needs_review` | 可能受其他改动影响，需复查 |
| `failed` | 已尝试实现但验证失败 |
| `deprecated` | 已废弃 |

---

## 最佳实践

1. **一次只做一件事** — 完成当前任务再切换
2. **及时更新状态** — 验收通过就标记
3. **关注影响范围** — 改完跑一下 impact 分析
4. **原子化提交** — 一个功能对应一个 commit
5. **先看再动手** — 开工前先读功能列表和进度日志

---

## 开源协议

MIT

## 作者

Lukin ([@mylukin](https://github.com/mylukin))

---

灵感来源：Anthropic 博客 [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

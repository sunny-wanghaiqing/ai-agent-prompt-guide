# ai-agent-prompt-guide

AI Agent 工具调用实战指南：从 **Tool Description 设计** 到 **LangChain Agent 落地**。

> 模型不会读你的函数实现，它只看 Tool Description + 参数 Schema。Description 写不好，Agent 就不调、乱调、传错参数。

## 项目内容

| 模块 | 说明 |
|------|------|
| [tool-test/](./tool-test/) | LangChain Tool 从零学习到场景实战 |
| [tool-test/01-mcp-tool-description-design.md](./tool-test/01-mcp-tool-description-design.md) | MCP Tool Description 设计方法论（四要素法 + 踩坑实录） |

## 核心方法

**Tool Description 四要素**：What（做什么）→ When（何时调用）→ How（怎么用）→ Limit（边界限制）

**Agent 复利结构**：
- 不变骨架 — `runAgent` 循环、Tool 定义格式、模型初始化
- 可变配置 — `TOOLS`、`SYSTEM_RULES`、`DEMO_QUERY`、`MCP_SERVERS`

## 快速开始

### 阅读设计文档

直接打开 [tool-test/01-mcp-tool-description-design.md](./tool-test/01-mcp-tool-description-design.md)，了解如何让 Agent 精准调用 MCP 工具。

### 动手实战

```bash
cd tool-test
cp .env.example .env   # 填入 OPENAI_API_KEY
npm install
npm start
```

在 Cursor 中学习 / 生成代码：

```
# 零基础学习（阶段 1 → 2 → 3 → 5）
按 tool-test/PROMPT.md，从阶段 1 开始，我是零基础

# 按场景实战
按 tool-test/PROMPT.md + scenarios/mini-cursor.yaml 生成代码
```

## 目录结构

```
├── tool-test/
│   ├── 01-mcp-tool-description-design.md  # MCP Tool Description 设计
│   ├── PROMPT.md                          # 学习 + 实战主提示词
│   ├── scenarios/                         # 场景配置（填空即用）
│   └── src/                               # 示例代码
└── .cursor/rules/                      # Cursor 规则
```

## License

MIT

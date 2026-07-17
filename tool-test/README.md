# tool-test — LangChain Tool 学习与实战

从零学会 Tool / Agent，并在真实项目中复利复用。

## 目录结构

```
tool-test/
├── PROMPT.md              # 主提示词（学习 + 实战）
├── README.md              # 本文件
├── scenarios/             # 场景变量配置（填空即用）
│   ├── file-agent.yaml
│   ├── mini-cursor.yaml
│   ├── mcp-query.yaml
│   └── multi-mcp.yaml
├── src/                   # 生成的示例代码
├── package.json
└── .env.example
```

## 快速开始

### 1. 学习模式（零基础）

在 Cursor 中发送：

```
按 tool-test/PROMPT.md，从阶段 1 开始，我是零基础
```

按阶段 1 → 2 → 3 → 5 顺序学习，阶段 2 是最关键的一课。

### 2. 实战模式（按场景生成）

```
按 tool-test/PROMPT.md + scenarios/mini-cursor.yaml 生成代码
```

### 3. 扩展模式（加新 Tool）

```
基于 all-tools.mjs，新增 git_status Tool，其他骨架不变
```

## 学习路径

| 阶段 | 文件 | 学什么 |
|------|------|--------|
| 1 | hello-langchain.mjs | LLM 基础调用 |
| 2 | tool-file-read.mjs | Tool 三要素 + Agent 循环 ★ |
| 3 | all-tools.mjs | 工具库模块化 |
| 4 | node-exec.mjs | spawn 子进程原理 |
| 5 | mini-cursor.mjs | 完整本地 Agent |
| 6 | my-mcp-server + langchain-mcp-test + mcp-test | MCP 服务化 |

## 复利原则

**不变（copy 复用）**：`runAgent` 循环、Tool 定义格式、模型初始化

**可变（按场景填）**：`{TOOLS}`、`{SYSTEM_RULES}`、`{DEMO_QUERY}`、`{MCP_SERVERS}`

详见 [PROMPT.md](./PROMPT.md)。

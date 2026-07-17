# LangChain Tool 学习与实战生成器

> 一份提示词，兼顾 **零基础学习** 与 **场景复利复用**。
> 骨架不变，填空即用。

---

## 如何使用

### 学习模式（零基础）

```
按 tool-test/PROMPT.md 生成代码，从阶段 1 开始，我是零基础，每阶段附带练习和自检清单。
```

### 实战模式（按场景填空）

```
按 tool-test/PROMPT.md + scenarios/{场景名}.yaml 生成代码。
```

### 扩展模式（在已有代码上加 Tool）

```
基于已有 all-tools.mjs，新增 Tool: {name}，其他骨架不变。
```

---

## Layer 0：概念速通（生成代码前必须先输出，200 字内）

用一句话 + 类比解释：

| 概念 | 解释 |
|------|------|
| **Tool** | LLM 可调用的函数，必须有 name、description、参数 schema |
| **bindTools** | 告诉 LLM「你能用这些工具」 |
| **Agent 循环** | LLM 思考 → 调工具 → 执行 → 结果喂回 → 再思考，直到完成 |
| **MCP** | 把 Tool 做成标准服务，本地/远程/跨进程都能接 |

**类比**：LLM = 大脑，Tool = 手，Agent 循环 = 反复「想→做→看结果」，MCP = 统一接口的外包团队。

**Tool 三要素（阶段 2 必须掌握）**：

1. `name` — 工具唯一标识（snake_case）
2. `description` — 告诉 LLM **何时调用**（最关键，决定会不会被调用）
3. `schema` — 参数格式（zod + `.describe()`，决定参数对不对）

---

## Layer 1：不变骨架（所有场景通用，不要改）

### 技术栈

```
Node.js ESM (.mjs)
@langchain/core + @langchain/openai + zod + dotenv + chalk
可选：@langchain/mcp-adapters + @modelcontextprotocol/sdk
```

### 模型初始化模板

```js
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME || "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
});
```

### Tool 定义模板

```js
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const xxxTool = tool(
  async (args) => {
    // 1. 执行逻辑
    // 2. console.log(`  [工具调用] xxx(...) - 结果摘要`)
    // 3. return 字符串（给 LLM 看的）
  },
  {
    name: 'snake_case_name',
    description: '【何时调用】+【输入是什么】+【返回什么】',
    schema: z.object({
      param: z.string().describe('参数说明，LLM 靠这个传对值'),
    }),
  }
);
```

### Agent 循环模板（所有 Agent 文件统一）

```js
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

async function runAgent(query, tools, systemPrompt, maxIterations = 30) {
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(query),
  ];
  const modelWithTools = model.bindTools(tools);

  for (let i = 0; i < maxIterations; i++) {
    console.log('⏳ 正在等待 AI 思考...');
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    if (!response.tool_calls?.length) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    console.log(`🔍 检测到 ${response.tool_calls.length} 个工具调用`);
    for (const call of response.tool_calls) {
      const t = tools.find(x => x.name === call.name);
      if (!t) continue;
      const result = await t.invoke(call.args);
      const content = typeof result === 'string' ? result : (result?.text ?? String(result));
      messages.push(new ToolMessage({ content, tool_call_id: call.id }));
    }
  }
}
```

### MCP 连接模板

```js
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const mcpClient = new MultiServerMCPClient({ mcpServers: { /* 见 Layer 2 */ } });
const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);
// Agent 循环同上
// 结束时：await mcpClient.close();
```

### MCP Server 模板

```js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'my-mcp-server', version: '1.0.0' });

server.registerTool('tool_name', {
  description: '...',
  inputSchema: { param: z.string().describe('...') },
}, async ({ param }) => ({
  content: [{ type: 'text', text: '...' }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Layer 2：场景变量（每次按项目填空）

| 变量 | 说明 | 示例 |
|------|------|------|
| `{STAGE}` | 学习阶段 1~6 或 all | `2` |
| `{SCENARIO}` | 业务场景名 | `file-agent` |
| `{TOOLS}` | 本场景工具列表 | `read_file, write_file` |
| `{SYSTEM_RULES}` | System Prompt 业务规则 | 见 scenarios/*.yaml |
| `{DEMO_QUERY}` | 演示用用户问题 | `"读取 package.json 并解释"` |
| `{MCP_SERVERS}` | MCP 服务配置 | 见 scenarios/*.yaml |
| `{PROJECT_ROOT}` | 项目根路径占位符 | 不写死绝对路径 |

场景配置见 [`scenarios/`](./scenarios/) 目录。

---

## 学习路径（6 阶段）

每个阶段输出结构 **固定** 为：

1. **本课目标**（1 句话）
2. **与上节课的区别**（1 句话）
3. **代码**（可运行，文件顶部 3 行注释说明学习点）
4. **运行命令** + **预期输出**
5. **动手练习**（改 1 处观察变化）
6. **自检清单**（3 条，打勾即过关）

### 阶段一览

| 阶段 | 文件 | 目标 | 过关标准 |
|------|------|------|----------|
| 1 | `hello-langchain.mjs` | 会调 LLM | 能打印模型回复 |
| 2 | `tool-file-read.mjs` | 定义 1 个 Tool + 手动循环 | 能看到 `[工具调用]` 日志 |
| 3 | `all-tools.mjs` | 封装工具库 | 4 个 tool 可独立 import |
| 4 | `node-exec.mjs` | 理解 spawn 原理 | 不依赖 LangChain 能跑命令 |
| 5 | `mini-cursor.mjs` | 完整本地 Agent | 自动读/写/执行完成小任务 |
| 6a | `my-mcp-server.mjs` | 自建 MCP Server | stdio 方式可启动 |
| 6b | `langchain-mcp-test.mjs` | MCP Client 入门 | 跨进程调用 query_user |
| 6c | `mcp-test.mjs` | 多 MCP 聚合 Agent | 多服务协同完成任务 |

### 推荐学习顺序

```
阶段 1（5 min）→ 确认 LLM 能通
    ↓
阶段 2（30 min）→ 理解 Tool 三要素 + Agent 循环  ★ 最关键
    ↓
阶段 3~4（可选）→ 工具库 + spawn 原理
    ↓
阶段 5（1 h）→ 感受 Agent 自动干活
    ↓
阶段 6（按需）→ MCP 服务化
```

---

## 场景复利模板

### 场景 A：file-agent（文件/code 助手）

```yaml
TOOLS: [read_file]
DEMO_QUERY: "读取 ./src/tool-file-read.mjs 并解释代码"
SYSTEM_RULES: "先读文件再回答，不要猜测内容"
```

### 场景 B：mini-cursor（项目脚手架 Agent）

```yaml
TOOLS: [read_file, write_file, execute_command, list_directory]
DEMO_QUERY: "用 pnpm create vite 创建 React TodoList 项目"
SYSTEM_RULES: |
  - execute_command 用 workingDirectory，禁止 command 里再 cd
  - 错误: { command: "cd app && pnpm install", workingDirectory: "app" }
  - 正确: { command: "pnpm install", workingDirectory: "app" }
  - write_file 写 React 组件时记得 import 对应 css
```

### 场景 C：mcp-query（MCP 数据查询）

```yaml
MCP_SERVERS:
  my-mcp-server:
    command: node
    args: ["{PROJECT_ROOT}/src/my-mcp-server.mjs"]
DEMO_QUERY: "查一下用户 002 的信息"
SYSTEM_RULES: "优先调用 query_user，不要编造数据"
```

### 场景 D：multi-mcp（多 MCP 编排）

```yaml
MCP_SERVERS:
  my-mcp-server: { command: node, args: ["{PROJECT_ROOT}/src/my-mcp-server.mjs"] }
  amap-maps: { url: "https://mcp.amap.com/mcp?key={AMAP_KEY}" }
  filesystem: { command: npx, args: ["-y", "@modelcontextprotocol/server-filesystem", "{ALLOWED_PATHS}"] }
  chrome-devtools: { command: npx, args: ["-y", "chrome-devtools-mcp@latest"] }
DEMO_QUERY: "【用户自定义复杂任务】"
SYSTEM_RULES: "分步执行：先查数据 → 再写文件 → 再打开浏览器"
```

---

## 输出要求

1. 先输出 **Layer 0 概念**（零基础必读）
2. 再按 `{STAGE}` 生成代码
3. 附带 `package.json` + `.env.example`
4. 路径用 `{PROJECT_ROOT}`，不写死绝对路径
5. 最后输出 **复利清单**：

```
✅ 可直接复用（下次 copy 不动）：
  - runAgent 循环
  - Tool 定义格式
  - ChatOpenAI 初始化

📝 下次只需改：
  - {TOOLS} 列表
  - {SYSTEM_RULES}
  - {DEMO_QUERY}
  - {MCP_SERVERS}
```

---

## 用户调用示例

```
# 零基础从头学
按 tool-test/PROMPT.md，从阶段 1 开始，我是零基础

# 跳到某一阶段
按 tool-test/PROMPT.md，生成阶段 2

# 按场景实战
按 tool-test/PROMPT.md + scenarios/mini-cursor.yaml 生成代码

# 在已有基础上扩展
基于 all-tools.mjs，新增 fetch_api(url) Tool，DEMO_QUERY 改为调用 xxx API 并写入 report.md
```

---

## 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| LLM 不调工具 | description 没写「何时调用」 | 改 description，加触发条件 |
| 参数传错 | schema 缺 `.describe()` | 每个字段加 describe |
| cd 报错 | workingDirectory + cd 重复 | 只用 workingDirectory |
| MCP 连不上 | 路径写死或 env 未配 | 用 `{PROJECT_ROOT}` + 检查 .env |

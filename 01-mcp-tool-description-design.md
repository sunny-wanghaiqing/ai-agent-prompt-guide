# 场景一：MCP Tool Description 设计——让 Agent 精准调用你的工具

> 🎯 核心问题：你写了一个 MCP Server，但 Agent 就是不调、乱调、传错参数？问题 99% 出在 Tool Description 上。

---

## 一、为什么 Tool Description 是 MCP 的灵魂？

很多人以为 MCP 开发的重点是"实现工具函数"，其实不是。

**模型不会读你的函数实现代码，它唯一看到的就是 Tool Description + 参数 Schema。**

这意味着：

- Description 写不好 → 模型不知道什么时候该调这个工具
- 参数 describe 写不好 → 模型传错参数
- 工具太多、描述太长 → 上下文被撑爆，模型推理能力下降

Tool Description 的本质是 **ACI（Agent-Computer Interface）**——为 AI 设计的接口，和为人类设计 UI 一样重要。

---

## 二、我的场景：前端组件文档查询 MCP Server

### 2.1 业务背景

作为前端开发，我们团队有一个自建的组件库（约 60+ 组件）。新人入职、跨团队协作时，经常问：

- "有没有一个能选日期范围的组件？"
- "Table 组件支持虚拟滚动吗？"
- "上传组件最大支持多大文件？"

这些信息都在文档里，但没人想翻文档。于是我决定做一个 MCP Server，让 AI Agent 来回答这些问题。

### 2.2 要实现的工具清单

| 工具名 | 功能 |
|--------|------|
| `search_component` | 按关键词搜索组件 |
| `get_component_props` | 获取某个组件的 Props 定义 |
| `get_component_example` | 获取某个组件的使用示例 |

---

## 三、Tool Description 四要素法（What + When + How + Limit）

### ❌ 反面示例：模糊的 Description

```javascript
server.registerTool('search_component', {
  description: '搜索组件',
  inputSchema: {
    keyword: z.string().describe('关键词'),
  },
}, async ({ keyword }) => {
  // ...
});
```

这段代码有什么问题？

1. **"搜索组件"太模糊**——搜什么组件？搜索范围是什么？返回什么？
2. **"关键词"没有示例**——模型不知道应该传"DatePicker"还是"日期选择"还是"选日期的"
3. **没有边界说明**——模型不知道这个工具"不能做什么"

结果：模型要么不调这个工具，要么传入一大段自然语言作为关键词，导致搜不到结果。

### ✅ 正面示例：遵循四要素的 Description

```javascript
server.registerTool('search_component', {
  description: `在团队内部组件库中按关键词搜索 UI 组件。
当用户询问"有没有某个组件"或"哪个组件能实现某功能"时，使用此工具。
返回匹配的组件列表（名称 + 简介），最多返回 10 条结果。
注意：只能搜索内部组件库，不支持搜索 antd/element 等第三方组件。`,
  inputSchema: {
    keyword: z.string().describe('搜索关键词，支持组件名（如 "DatePicker"）或功能描述（如 "日期选择"）'),
  },
}, async ({ keyword }) => {
  // ...
});
```

拆解四要素：

| 要素 | 对应内容 | 作用 |
|------|----------|------|
| **What**（做什么） | "在团队内部组件库中按关键词搜索 UI 组件" | 告诉模型工具的功能 |
| **When**（什么时候用） | "当用户询问'有没有某个组件'或'哪个组件能实现某功能'时" | 告诉模型触发条件 |
| **How**（返回什么） | "返回匹配的组件列表（名称 + 简介），最多 10 条" | 告诉模型预期输出 |
| **Limit**（不能做什么） | "只能搜索内部组件库，不支持搜索第三方组件" | 防止模型越界调用 |

---

## 四、参数 Schema 的 describe 设计

参数的 `.describe()` 同样关键。模型会根据 describe 来决定传什么值。

### ❌ 反面示例

```javascript
inputSchema: {
  componentName: z.string().describe('组件名'),
  format: z.string().describe('格式'),
}
```

问题：
- "组件名"是 PascalCase 还是 kebab-case？是中文名还是英文名？
- "格式"是什么的格式？可选值是什么？

### ✅ 正面示例

```javascript
inputSchema: {
  componentName: z.string().describe('组件的英文名称，使用 PascalCase 格式，如 "DatePicker"、"FileUpload"、"VirtualTable"'),
  format: z.enum(['brief', 'detailed']).describe('返回格式。brief: 仅返回类型定义；detailed: 返回类型定义 + 说明 + 默认值'),
}
```

### 参数 describe 的三条原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **给出示例** | 比文字描述更直接 | `如 "DatePicker"、"FileUpload"` |
| **约束格式** | 减少模型猜测 | `使用 PascalCase 格式` |
| **枚举优于字符串** | 用 `z.enum()` 代替 `z.string()` | `z.enum(['brief', 'detailed'])` |

---

## 五、完整代码：前端组件文档查询 MCP Server

> ⚠️ 以下代码为我自己的原创实现，用于演示 Tool Description 设计技巧。

```javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// 模拟组件库数据（实际项目中从文档 JSON 加载）
const componentDB = {
  DatePicker: {
    name: 'DatePicker',
    description: '日期选择器，支持单选和范围选择',
    props: [
      { name: 'mode', type: '"date" | "range" | "month"', default: '"date"', desc: '选择模式' },
      { name: 'value', type: 'Date | [Date, Date]', default: 'undefined', desc: '当前选中值' },
      { name: 'disabled', type: 'boolean', default: 'false', desc: '是否禁用' },
      { name: 'format', type: 'string', default: '"YYYY-MM-DD"', desc: '日期显示格式' },
    ],
    example: `<DatePicker mode="range" format="YYYY/MM/DD" onChange={(dates) => console.log(dates)} />`,
  },
  FileUpload: {
    name: 'FileUpload',
    description: '文件上传组件，支持拖拽上传和多文件选择',
    props: [
      { name: 'maxSize', type: 'number', default: '10', desc: '单个文件最大体积（MB）' },
      { name: 'accept', type: 'string', default: '"*"', desc: '接受的文件类型' },
      { name: 'multiple', type: 'boolean', default: 'false', desc: '是否允许多选' },
      { name: 'action', type: 'string', default: '-', desc: '上传接口地址' },
    ],
    example: `<FileUpload maxSize={20} accept=".jpg,.png" multiple action="/api/upload" />`,
  },
  VirtualTable: {
    name: 'VirtualTable',
    description: '虚拟滚动表格，适用于大数据量场景（1万行以上）',
    props: [
      { name: 'columns', type: 'ColumnDef[]', default: '[]', desc: '列定义' },
      { name: 'dataSource', type: 'any[]', default: '[]', desc: '数据源' },
      { name: 'rowHeight', type: 'number', default: '48', desc: '行高（px）' },
      { name: 'overscan', type: 'number', default: '5', desc: '可视区域外预渲染的行数' },
    ],
    example: `<VirtualTable columns={columns} dataSource={bigData} rowHeight={52} />`,
  },
};

const server = new McpServer({
  name: 'fe-component-docs',
  version: '1.0.0',
});

// ========================================
// 工具 1：搜索组件
// ========================================
server.registerTool('search_component', {
  description: `在团队内部组件库中按关键词搜索 UI 组件。
当用户询问"有没有某个组件"、"哪个组件能实现某功能"、"组件库里有什么"时，使用此工具。
返回匹配的组件列表（名称 + 一句话简介）。
注意：只搜索内部组件库（约 60 个组件），不支持搜索 antd、element-ui 等第三方组件。`,
  inputSchema: {
    keyword: z.string().describe('搜索关键词。支持组件英文名（如 "DatePicker"）、中文功能描述（如 "日期选择"）、或功能关键词（如 "上传"、"表格"）'),
  },
}, async ({ keyword }) => {
  const lowerKeyword = keyword.toLowerCase();
  const results = Object.values(componentDB).filter(comp =>
    comp.name.toLowerCase().includes(lowerKeyword) ||
    comp.description.includes(keyword)
  );

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `未找到与"${keyword}"相关的组件。请尝试换一个关键词，或使用中文功能描述搜索。`,
      }],
    };
  }

  const list = results.map(c => `- **${c.name}**: ${c.description}`).join('\n');
  return {
    content: [{
      type: 'text',
      text: `找到 ${results.length} 个相关组件：\n${list}\n\n使用 get_component_props 可查看具体 Props。`,
    }],
  };
});

// ========================================
// 工具 2：获取组件 Props
// ========================================
server.registerTool('get_component_props', {
  description: `获取指定组件的完整 Props 类型定义。
当用户问"某组件有哪些参数"、"某组件怎么配置"、"某属性的默认值是什么"时，使用此工具。
返回该组件所有 Props 的名称、类型、默认值和说明。
前提：需要先用 search_component 确认组件名称存在。`,
  inputSchema: {
    componentName: z.string().describe('组件的英文名称，PascalCase 格式，如 "DatePicker"、"FileUpload"。必须是 search_component 返回过的名称。'),
  },
}, async ({ componentName }) => {
  const comp = componentDB[componentName];

  if (!comp) {
    return {
      content: [{
        type: 'text',
        text: `组件 "${componentName}" 不存在。请先用 search_component 搜索确认组件名称。常见错误：名称拼写错误、使用了 kebab-case（应使用 PascalCase）。`,
      }],
    };
  }

  const propsTable = comp.props
    .map(p => `| ${p.name} | \`${p.type}\` | \`${p.default}\` | ${p.desc} |`)
    .join('\n');

  return {
    content: [{
      type: 'text',
      text: `## ${comp.name}\n\n${comp.description}\n\n| 属性 | 类型 | 默认值 | 说明 |\n|------|------|--------|------|\n${propsTable}`,
    }],
  };
});

// ========================================
// 工具 3：获取组件使用示例
// ========================================
server.registerTool('get_component_example', {
  description: `获取指定组件的 JSX/TSX 使用示例代码。
当用户问"这个组件怎么用"、"给我一个示例"、"代码怎么写"时，使用此工具。
返回一段可直接复制使用的 React 代码片段。
注意：示例代码基于 React + TypeScript 环境。`,
  inputSchema: {
    componentName: z.string().describe('组件的英文名称，PascalCase 格式，如 "DatePicker"'),
  },
}, async ({ componentName }) => {
  const comp = componentDB[componentName];

  if (!comp) {
    return {
      content: [{
        type: 'text',
        text: `组件 "${componentName}" 不存在。请先用 search_component 搜索确认名称。`,
      }],
    };
  }

  return {
    content: [{
      type: 'text',
      text: `## ${comp.name} 使用示例\n\n\`\`\`tsx\n${comp.example}\n\`\`\`\n\n更多用法请参考内部文档站。`,
    }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 六、踩坑实录：我调了 3 次才让模型正确调用

### 踩坑 1：模型不调 search_component，直接瞎编

**现象**：用户问"有没有支持虚拟滚动的表格组件"，模型直接回答"推荐使用 antd 的 Table 组件"，根本没调我的工具。

**原因**：Description 里没写 When 要素，模型不知道什么时候应该调这个工具。

**修复**：加上触发条件——`当用户询问"有没有某个组件"、"哪个组件能实现某功能"时，使用此工具`。

### 踩坑 2：模型传入一整句话作为 keyword

**现象**：模型调用了 search_component，但传入的参数是 `{ keyword: "有没有支持虚拟滚动的表格组件" }`，导致搜不到结果。

**原因**：参数的 describe 只写了"搜索关键词"，没告诉模型应该传什么格式的值。

**修复**：在 describe 中加入示例——`支持组件英文名（如 "DatePicker"）、中文功能描述（如 "日期选择"）`。模型看到示例后会模仿格式，改为传入 `{ keyword: "表格" }` 或 `{ keyword: "虚拟滚动" }`。

### 踩坑 3：工具返回的错误信息模型看不懂

**现象**：用户传入一个不存在的组件名，工具返回 `null`，模型直接说"查询失败"就不继续了。

**原因**：工具返回了空值，模型无法决定下一步行动。

**修复**：返回明确的错误信息和下一步建议——`组件 "xxx" 不存在。请先用 search_component 搜索确认组件名称。`模型看到后会自动回退去调 search_component。

---

## 七、总结：Tool Description 设计清单

每次写完一个 MCP 工具的 Description 后，用这份清单自查：

- [ ] **What**：一句话说清楚这个工具做什么
- [ ] **When**：明确写出在什么情况下应该调用此工具
- [ ] **How**：说明返回数据的格式和数量限制
- [ ] **Limit**：说明这个工具"不能做什么"
- [ ] **参数示例**：每个参数的 describe 中包含至少一个具体示例
- [ ] **格式约束**：字符串参数是否指定了格式（PascalCase / kebab-case / 中文）
- [ ] **枚举替代**：可枚举的参数是否用了 `z.enum()` 而非 `z.string()`
- [ ] **错误信息**：工具出错时是否返回了"模型能理解的"错误提示 + 下一步建议
- [ ] **跨工具引导**：是否在返回结果中引导模型去调其他相关工具

---

## 八、扩展思考

> 这些 Description 设计原则不仅适用于 MCP，也适用于 LangChain 的 `tool()` 函数和 OpenAI 的 Function Calling。本质上，只要你在给模型"定义可用工具"，Description 的写法就直接决定了调用的准确率。

### 可以复用这套方法的场景

| 场景 | 需要设计 Description 的地方 |
|------|---------------------------|
| Cursor 插件开发 | 自定义 MCP Server 的工具描述 |
| LangChain Agent | `tool()` 函数的 `description` 参数 |
| OpenAI Function Calling | `functions` 数组中的 `description` 字段 |
| Claude Tool Use | `tools` 参数中的 `description` |
| 企业内部 Agent 平台 | 工具注册时的说明文档 |

---

*本文为「AI Agent 提示词实战手册」系列第一篇。基于作者在实际前端开发中使用 MCP 的真实经验整理，所有代码均为原创。*

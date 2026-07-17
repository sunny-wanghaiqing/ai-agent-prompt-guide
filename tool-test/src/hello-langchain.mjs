/**
 * LangChain + 千问大模型 + 自定义 Tool 入门示例
 *
 * 完整对话流程：
 * 用户提问 → 模型发起工具调用 → 代码执行工具 → ToolMessage 回传结果 → 模型整合结果回答
 */

import dotenv from "dotenv";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

// 加载 .env 中的密钥（.env 不要提交到 git）
dotenv.config();

// ============================================================
// 步骤 7：自定义 Tool 开发
// 流程：写执行函数 → 配置名称/描述 → Zod 声明参数 → bindTools 绑定
// ============================================================

/**
 * 模拟天气查询（真实项目里这里会调用天气 API）
 */
async function fetchWeather({ city }) {
  const mockData = {
    北京: "晴，25°C，微风",
    上海: "多云，28°C，东南风 3 级",
    深圳: "阵雨，30°C，湿度 80%",
  };
  return mockData[city] ?? `暂无 ${city} 的天气数据`;
}

// tool() 把普通函数包装成 LangChain 可识别的工具
const getWeatherTool = tool(fetchWeather, {
  name: "get_weather",
  description:
    "查询指定城市的实时天气。当用户询问某地天气、气温、是否下雨时使用此工具。",
  schema: z.object({
    city: z.string().describe("城市名称，例如：北京、上海、深圳"),
  }),
});

// ============================================================
// 步骤 5：初始化千问模型（通过 OpenAI 兼容接口）
// temperature: 0 → 关闭随机性，输出更稳定、更守规矩
// ============================================================

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME ?? "qwen-plus",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 把工具绑定到模型，模型才知道自己"能调用什么"
const modelWithTools = model.bindTools([getWeatherTool]);

// 工具名 → 工具实例，方便按名称执行
const toolsByName = {
  [getWeatherTool.name]: getWeatherTool,
};

// ============================================================
// 步骤 6 & 8：4 种消息类型 + SystemMessage 工具调用规范
// ============================================================

const systemPrompt = `你是一个天气助手。

【工具调用规范】
1. 用户问天气时，必须调用 get_weather 工具，不要编造天气数据。
2. 从用户问题中提取城市名作为 city 参数。
3. 收到工具返回结果后，用自然语言整理成简洁回答。`;

const messages = [
  // SystemMessage：设定 AI 身份、能力、规则
  new SystemMessage(systemPrompt),

  // HumanMessage：用户输入
  new HumanMessage("北京今天天气怎么样？"),
];

console.log("========== 第 1 轮：用户提问 ==========");
console.log("[HumanMessage]", messages[1].content);

// ============================================================
// 步骤 8：完整 Tool 调用循环
// ============================================================

async function runToolCallingLoop() {
  // 第 1 次调用：模型判断是否需要工具
  let aiResponse = await modelWithTools.invoke(messages);

  // AIMessage：AI 返回（可能包含 tool_calls，也可能直接是文本）
  messages.push(aiResponse);
  console.log("\n========== 第 2 轮：模型响应 ==========");
  console.log("[AIMessage] content:", aiResponse.content || "(空，将调用工具)");
  console.log("[AIMessage] tool_calls:", JSON.stringify(aiResponse.tool_calls, null, 2));

  // 如果模型发起了工具调用，就执行工具并把结果塞回对话
  while (aiResponse.tool_calls?.length > 0) {
    for (const toolCall of aiResponse.tool_calls) {
      const selectedTool = toolsByName[toolCall.name];
      if (!selectedTool) {
        throw new Error(`未找到工具: ${toolCall.name}`);
      }

      console.log(`\n========== 执行工具: ${toolCall.name} ==========`);
      console.log("参数:", toolCall.args);

      const toolResult = await selectedTool.invoke(toolCall.args);

      // ToolMessage：把工具执行结果回传给模型
      const toolMessage = new ToolMessage({
        content: toolResult,
        tool_call_id: toolCall.id,
      });
      messages.push(toolMessage);

      console.log("[ToolMessage]", toolResult);
    }

    // 第 2 次调用：模型根据工具结果生成最终回答
    aiResponse = await modelWithTools.invoke(messages);
    messages.push(aiResponse);

    console.log("\n========== 第 3 轮：模型整合工具结果 ==========");
    console.log("[AIMessage] 最终回答:", aiResponse.content);
  }

  // 模型没调工具，直接返回文本的情况
  if (!aiResponse.tool_calls?.length && aiResponse.content) {
    console.log("\n[AIMessage] 直接回答:", aiResponse.content);
  }

  return aiResponse.content;
}

try {
  const finalAnswer = await runToolCallingLoop();
  console.log("\n========== 完成 ==========");
  console.log("用户看到的最终回复:", finalAnswer);
} catch (error) {
  console.error("\n运行失败，请检查：");
  console.error("1. .env 中 OPENAI_API_KEY 是否已填写");
  console.error("2. 网络是否能访问 dashscope.aliyuncs.com");
  console.error("3. MODEL_NAME 是否有效（如 qwen-coder-turbo）");
  console.error("\n错误详情:", error.message);
  process.exit(1);
}

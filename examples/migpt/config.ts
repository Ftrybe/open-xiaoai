import { sleep } from "@mi-gpt/utils";
import { OpenXiaoAIConfig } from "./migpt/xiaoai.js";
import { dynamicConfig } from "./migpt/dynamic-config.js";

export const kOpenXiaoAIConfig: OpenXiaoAIConfig = {
  openai: {
    /**
     * 你的大模型服务提供商的接口地址
     *
     * 支持兼容 OpenAI 接口的大模型服务，比如：DeepSeek V3 等
     *
     * 注意：一般以 /v1 结尾，不包含 /chat/completions 部分
     * - ✅ https://api.openai.com/v1
     * - ❌ https://api.openai.com/v1/（最后多了一个 /
     * - ❌ https://api.openai.com/v1/chat/completions（不需要加 /chat/completions）
     */
    get baseURL() {
      return dynamicConfig.getOpenAIBaseURL() || "https://api.openai.com/v1";
    },
    /**
     * API 密钥
     */
    get apiKey() {
      return dynamicConfig.getOpenAIApiKey() || "sk-xxxxxxxxxx";
    },
    /**
     * 模型名称
     */
    get model() {
      return dynamicConfig.getOpenAIModel() || "deepseek-chat";
    },
  },
  prompt: {
    /**
     * 系统提示词，如需关闭可设置为：''（空字符串）
     * 现在从Web界面的设置中动态读取
     */
    get system() {
      return dynamicConfig.getSystemPrompt();
    },
  },
  context: {
    /**
     * 每次对话携带的最大历史消息数（如需关闭可设置为：0）
     * 现在从Web界面的设置中动态读取
     */
    get historyMaxLength() {
      return dynamicConfig.getHistoryMaxLength();
    },
  },
  /**
   * 只回答以下关键词开头的消息：
   * 现在从Web界面的设置中动态读取
   */
  get callAIKeywords() {
    return dynamicConfig.getCallAIKeywords();
  },
  /**
   * 自定义消息回复
   * 现在支持从Web界面动态配置的规则
   */
  async onMessage(engine, { text }) {
    // 首先尝试处理动态配置的规则
    const dynamicResult = await dynamicConfig.handleCustomMessage(engine, { text });
    if (dynamicResult) {
      return dynamicResult;
    }

    // 没有匹配的规则，返回null让系统继续默认处理
    return null;
  },
};

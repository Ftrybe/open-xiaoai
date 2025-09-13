import { webServer } from "./web-server.js";
import type { CustomRule, AppSettings } from "./web-server.js";
import { sleep } from "@mi-gpt/utils";
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const execAsync = promisify(exec);

// 备用sleep函数，以防导入失败
const fallbackSleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 安全的sleep函数，优先使用导入的版本，否则使用备用版本
const safeSleep = async (ms: number) => {
  try {
    if (typeof sleep === 'function') {
      return await sleep(ms);
    }
  } catch (error) {
    console.warn('使用导入的sleep函数失败，使用备用版本:', error);
  }
  return await fallbackSleep(ms);
};

export class DynamicConfig {
  private static instance: DynamicConfig;
  private rules: CustomRule[] = [];
  private settings: AppSettings = {
    callAIKeywords: ['请', '你'],
    systemPrompt: '你是一个智能助手，请根据用户的问题给出回答。',
    historyMaxLength: 10
  };

  public static getInstance(): DynamicConfig {
    if (!DynamicConfig.instance) {
      DynamicConfig.instance = new DynamicConfig();
    }
    return DynamicConfig.instance;
  }

  public reloadConfig() {
    this.rules = webServer.getCurrentRules();
    this.settings = webServer.getCurrentSettings();
  }

  public getCallAIKeywords(): string[] {
    return this.settings.callAIKeywords;
  }

  public getSystemPrompt(): string {
    return this.settings.systemPrompt;
  }

  public getHistoryMaxLength(): number {
    return this.settings.historyMaxLength;
  }

  public getOpenAIApiKey(): string | undefined {
    return this.settings.openai?.apiKey;
  }

  public getOpenAIBaseURL(): string | undefined {
    return this.settings.openai?.baseUrl;
  }

  public getOpenAIModel(): string | undefined {
    return this.settings.openai?.model;
  }

  public async handleCustomMessage(engine: any, { text }: { text: string }): Promise<any> {
    // 每次处理消息时重新加载配置，确保使用最新的规则
    this.reloadConfig();

    // 查找匹配的规则
    const rule = this.rules.find(r => this.matchesRule(text, r));
    
    if (!rule) {
      return null; // 没有匹配的规则，继续默认处理
    }

    console.log(`🎯 匹配到自定义规则: "${rule.trigger.keyword}" (${rule.trigger.type}) -> ${rule.response.type}`);

    // 验证engine对象的可用性
    if (!engine) {
      console.error('❌ 致命错误：Engine对象为空');
      return { text: '系统错误：Engine对象不可用' };
    }
    
    if (!engine.speaker) {
      console.error('❌ 致命错误：Speaker对象不可用');
      console.log('🔍 Engine对象内容:', Object.keys(engine));
      return { text: '系统错误：Speaker对象不可用' };
    }
    
    console.log('✅ Engine和Speaker对象验证通过');

    try {
      switch (rule.response.type) {
        case 'text':
          // 检查是否启用了打断小爱回复
          if (rule.response.abortXiaoAI) {
            // 打断原来小爱的回复
            await engine.speaker.abortXiaoAI();
            
            // 播放文字
            await safeSleep(2000); // 打断小爱后需要等待 2 秒，使其恢复运行后才能继续 TTS
            
            const blocking = rule.response.playBlocking !== false; // 默认阻塞
            await engine.speaker.play({ text: rule.response.text, blocking });
            
            return { handled: true };
          } else {
            // 不打断，直接返回文字
            return { text: rule.response.text };
          }

        case 'builtInCommand':
          // 执行内置指令
          if (rule.response.builtInCommand) {
            console.log('🎯 执行内置指令:', rule.response.builtInCommand);
            
            // 检查engine和speaker对象是否可用
            if (!engine || !engine.speaker) {
              console.error('❌ Engine或Speaker对象不可用');
              return { text: '执行失败：系统对象不可用' };
            }
            
            try {
              // 检查是否启用了打断小爱回复
              if (rule.response.abortXiaoAI) {
                console.log('🛑 打断小爱回复...');
                await engine.speaker.abortXiaoAI();
                await safeSleep(2000);
              }
              
              // 执行内置指令（比如开灯关灯等）
              console.log('📢 发送内置指令给小爱:', rule.response.builtInCommand);
              await engine.speaker.askXiaoAI(rule.response.builtInCommand, { silent: true });
              console.log('✅ 内置指令执行完成');
              
              return { handled: true };
            } catch (error: any) {
              console.error('❌ 内置指令执行失败:', error);
              return { text: `内置指令执行失败: ${error?.message || '未知错误'}` };
            }
          }
          return null;

        case 'audio':
          await engine.speaker.abortXiaoAI();
          await safeSleep(2000);
          
          if (rule.response.audioText) {
            await engine.speaker.play({ text: rule.response.audioText, blocking: true });
          }
          
          if (rule.response.audioUrl) {
            await engine.speaker.play({ url: rule.response.audioUrl });
          }
          
          return { handled: true };

        case 'localCode':
          return await this.executeLocalCode(engine, rule.response.localCode);

        case 'sandboxCode':
          return await this.executeSandboxCode(engine, rule.response.sandboxCode);

        case 'apiCall':
          return await this.executeApiCall(rule.response);

        case 'pythonRemote':
          return await this.executeRemoteCode(rule.response, 'python');

        case 'nodeRemote':
          return await this.executeRemoteCode(rule.response, 'node');

        case 'terminalCommand':
          return await this.executeTerminalCommand(rule.response);

        default:
          console.warn('未知的响应类型:', rule.response.type);
          return null;
      }
    } catch (error) {
      console.error('执行自定义规则时出错:', error);
      return { text: '执行自定义规则时发生错误' };
    }
  }

  private matchesRule(text: string, rule: CustomRule): boolean {
    const { type, keyword } = rule.trigger;
    
    switch (type) {
      case 'exact':
        return text === keyword;
      case 'startsWith':
        return text.startsWith(keyword);
      case 'contains':
        return text.includes(keyword);
      case 'endsWith':
        return text.endsWith(keyword);
      default:
        return false;
    }
  }

  private async executeLocalCode(engine: any, code?: string): Promise<any> {
    if (!code) return { handled: true };
    
    console.log('🔧 执行本地代码:', code.substring(0, 100) + (code.length > 100 ? '...' : ''));
    
    try {
      // 检查engine对象是否可用
      if (!engine) {
        console.error('❌ Engine对象不可用');
        return { text: '执行失败：Engine对象不可用' };
      }
      
      if (!engine.speaker) {
        console.error('❌ Speaker对象不可用');
        return { text: '执行失败：Speaker对象不可用' };
      }
      
      const asyncFunction = new Function('engine', 'sleep', `
        return (async () => {
          ${code}
        })();
      `);
      
      console.log('✅ 本地代码函数创建成功，开始执行...');
      const result = await asyncFunction(engine, safeSleep);
      console.log('✅ 本地代码执行完成，结果:', result);
      
      return result || { handled: true };
    } catch (error: any) {
      console.error('❌ 执行本地代码时出错:', error);
      console.error('错误详情:', {
        message: error?.message || '未知错误',
        stack: error?.stack || '无堆栈信息',
        name: error?.name || '未知错误类型'
      });
      return { text: `本地代码执行失败: ${error?.message || '未知错误'}` };
    }
  }

  private async executeSandboxCode(engine: any, code?: string): Promise<any> {
    if (!code) return { handled: true };
    
    try {
      // 创建一个受限的沙盒环境
      const sandbox = {
        console: {
          log: (...args: any[]) => console.log('[沙盒]', ...args),
          error: (...args: any[]) => console.error('[沙盒]', ...args),
        },
        setTimeout,
        clearTimeout,
        Math,
        Date,
        JSON,
        // 不提供 engine 访问权限，更安全
      };
      
      const sandboxFunction = new Function(
        ...Object.keys(sandbox),
        `
        return (async () => {
          ${code}
        })();
        `
      );
      
      const result = await sandboxFunction(...Object.values(sandbox));
      
      // 如果沙盒代码返回了文本，则作为回复
      if (typeof result === 'string') {
        return { text: result };
      }
      
      return result || { handled: true };
    } catch (error) {
      console.error('执行沙盒代码时出错:', error);
      throw error;
    }
  }

  private async executeApiCall(response: CustomRule['response']): Promise<any> {
    const { 
      apiUrl, 
      apiMethod = 'GET', 
      apiHeaders = {}, 
      apiBody, 
      apiResponseType = 'auto',
      apiResponsePath,
      apiResponseFallback = 'API调用成功，但响应解析失败'
    } = response;
    
    if (!apiUrl) {
      throw new Error('API URL 未配置');
    }
    
    try {
      const fetchOptions: RequestInit = {
        method: apiMethod,
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders,
        },
      };
      
      if (apiBody && ['POST', 'PUT'].includes(apiMethod)) {
        fetchOptions.body = apiBody;
      }
      
      const httpResponse = await fetch(apiUrl, fetchOptions);
      const rawData = await httpResponse.text();
      
      if (!httpResponse.ok) {
        throw new Error(`API调用失败: ${httpResponse.status} ${rawData}`);
      }
      
      // 解析响应数据
      const parsedText = this.parseApiResponse(rawData, apiResponseType, apiResponsePath, apiResponseFallback);
      
      return { text: parsedText };
    } catch (error) {
      console.error('API调用失败:', error);
      throw error;
    }
  }

  private parseApiResponse(
    rawData: string, 
    responseType: string, 
    responsePath?: string, 
    fallback?: string
  ): string {
    try {
      // 如果指定为纯文本类型，直接返回原始数据
      if (responseType === 'text') {
        return rawData;
      }

      // 尝试解析JSON
      let jsonData: any;
      try {
        jsonData = JSON.parse(rawData);
      } catch (parseError) {
        // 如果强制指定为JSON但解析失败，返回fallback
        if (responseType === 'json') {
          console.warn('JSON解析失败:', parseError);
          return fallback || rawData;
        }
        // 自动检测模式下，JSON解析失败则返回原始文本
        return rawData;
      }

      // 如果有指定JSON路径，尝试提取特定字段
      if (responsePath) {
        const extractedValue = this.extractJsonPath(jsonData, responsePath);
        if (extractedValue !== undefined && extractedValue !== null) {
          // 如果提取的值是对象或数组，转换为JSON字符串
          if (typeof extractedValue === 'object') {
            return JSON.stringify(extractedValue, null, 2);
          }
          // 否则转换为字符串
          return String(extractedValue);
        }
        // 路径提取失败，返回fallback或原始JSON
        console.warn(`JSON路径 "${responsePath}" 未找到对应值`);
        return fallback || JSON.stringify(jsonData, null, 2);
      }

      // 没有指定路径，尝试智能提取常见字段
      const commonFields = ['message', 'text', 'content', 'data', 'result'];
      for (const field of commonFields) {
        if (jsonData[field] !== undefined && jsonData[field] !== null) {
          if (typeof jsonData[field] === 'object') {
            return JSON.stringify(jsonData[field], null, 2);
          }
          return String(jsonData[field]);
        }
      }

      // 如果没有找到常见字段，返回整个JSON
      return JSON.stringify(jsonData, null, 2);

    } catch (error) {
      console.error('响应解析失败:', error);
      return fallback || rawData;
    }
  }

  private extractJsonPath(obj: any, path: string): any {
    try {
      const keys = path.split('.');
      let current = obj;
      
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return undefined;
        }
      }
      
      return current;
    } catch (error) {
      console.error('JSON路径提取失败:', error);
      return undefined;
    }
  }

  private async executeRemoteCode(response: CustomRule['response'], language: 'python' | 'node'): Promise<any> {
    const { remoteUrl, remoteCode, remoteTimeout = 30 } = response;
    
    if (!remoteUrl || !remoteCode) {
      throw new Error('远程执行URL或代码未配置');
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), remoteTimeout * 1000);
      
      const response = await fetch(remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          code: remoteCode,
          timeout: remoteTimeout,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`远程执行失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(`远程执行错误: ${result.error}`);
      }
      
      // 返回执行结果
      return { text: result.output || result.result || '执行完成' };
    } catch (error) {
      console.error('远程代码执行失败:', error);
      throw error;
    }
  }

  private async executeTerminalCommand(response: CustomRule['response']): Promise<any> {
    const { 
      terminalCommand, 
      terminalWorkingDir = process.cwd(), 
      terminalTimeout = 30,
      terminalReturnOutput = true,
      ssh
    } = response;
    
    if (!terminalCommand) {
      throw new Error('终端命令未配置');
    }
    
    try {
      if (ssh) {
        // SSH远程执行
        return await this.executeSSHCommand(terminalCommand, ssh, terminalWorkingDir, terminalTimeout, terminalReturnOutput);
      } else {
        // 本地执行
        return await this.executeLocalCommand(terminalCommand, terminalWorkingDir, terminalTimeout, terminalReturnOutput);
      }
    } catch (error: any) {
      console.error('终端命令执行失败:', error);
      
      const errorMsg = error.message || '未知错误';
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      
      let errorText = `❌ 命令执行失败: ${errorMsg}`;
      
      if (stderr) {
        errorText += `\n\n错误输出:\n\`\`\`\n${stderr.trim()}\n\`\`\``;
      }
      
      if (stdout) {
        errorText += `\n\n标准输出:\n\`\`\`\n${stdout.trim()}\n\`\`\``;
      }
      
      return { text: errorText };
    }
  }

  private async executeLocalCommand(
    command: string,
    workingDir: string,
    timeout: number,
    returnOutput: boolean
  ): Promise<any> {
    console.log(`🖥️ 本地执行终端命令: ${command}`);
    console.log(`📁 工作目录: ${workingDir}`);
    
    const result = await execAsync(command, {
      cwd: workingDir,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    if (returnOutput) {
      // 返回命令输出
      const output = result.stdout || result.stderr || '命令执行完成，无输出';
      return { text: `✅ 命令执行成功:\n\`\`\`\n${output.trim()}\n\`\`\`` };
    } else {
      // 不返回输出，只确认执行
      return { text: '✅ 命令执行成功' };
    }
  }

  private async executeSSHCommand(
    command: string,
    sshConfig: any,
    workingDir: string,
    timeout: number,
    returnOutput: boolean
  ): Promise<any> {
    const { host, port = 22, username, authMethod, privateKeyPath, passphrase, password } = sshConfig;
    
    console.log(`🔐 SSH远程执行命令: ${command}`);
    console.log(`🌐 目标主机: ${username}@${host}:${port}`);
    console.log(`📁 工作目录: ${workingDir}`);
    
    // 构建SSH命令
    let sshCommand = '';
    
    if (authMethod === 'key') {
      // 密钥认证
      if (!privateKeyPath) {
        throw new Error('SSH密钥认证需要指定私钥文件路径');
      }
      
      // 处理路径中的 ~ 符号
      const keyPath = privateKeyPath.startsWith('~') 
        ? resolve(homedir(), privateKeyPath.slice(1)) 
        : resolve(privateKeyPath);
      
      sshCommand = `ssh -i "${keyPath}" -p ${port} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${username}@${host}`;
      
      // 如果有工作目录，先切换目录再执行命令
      const remoteCommand = workingDir && workingDir !== process.cwd() 
        ? `cd "${workingDir}" && ${command}` 
        : command;
      
      sshCommand += ` "${remoteCommand}"`;
      
    } else {
      // 密码认证 - 使用sshpass
      if (!password) {
        throw new Error('SSH密码认证需要提供密码');
      }
      
      // 检查是否安装了sshpass
      try {
        await execAsync('which sshpass');
      } catch (error) {
        throw new Error('SSH密码认证需要安装sshpass工具: brew install sshpass (macOS) 或 sudo apt-get install sshpass (Ubuntu)');
      }
      
      const remoteCommand = workingDir && workingDir !== process.cwd() 
        ? `cd "${workingDir}" && ${command}` 
        : command;
      
      sshCommand = `sshpass -p "${password}" ssh -p ${port} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${username}@${host} "${remoteCommand}"`;
    }
    
    console.log(`🚀 执行SSH命令: ${sshCommand.replace(password || '', '***')}`);
    
    const result = await execAsync(sshCommand, {
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024, // 1MB buffer
      env: {
        ...process.env,
        // 对于密钥认证，如果有密码短语，设置SSH_ASKPASS
        ...(authMethod === 'key' && passphrase ? { 
          SSH_ASKPASS: '',
          DISPLAY: '',
          SSH_ASKPASS_REQUIRE: 'never'
        } : {})
      }
    });
    
    if (returnOutput) {
      // 返回命令输出
      const output = result.stdout || result.stderr || '命令执行完成，无输出';
      return { 
        text: `✅ SSH远程命令执行成功 (${username}@${host}):\n\`\`\`\n${output.trim()}\n\`\`\`` 
      };
    } else {
      // 不返回输出，只确认执行
      return { 
        text: `✅ SSH远程命令执行成功 (${username}@${host})` 
      };
    }
  }
}

export const dynamicConfig = DynamicConfig.getInstance();

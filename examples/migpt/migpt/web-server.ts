import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CustomRule {
  id: string;
  // 触发条件配置
  trigger: {
    type: 'exact' | 'startsWith' | 'contains' | 'endsWith';
    keyword: string;
  };
  // 响应类型配置
  response: {
    type: 'text' | 'audio' | 'builtInCommand' | 'localCode' | 'sandboxCode' | 'apiCall' | 'pythonRemote' | 'nodeRemote' | 'terminalCommand';
    // 打断小爱回复配置
    abortXiaoAI?: boolean; // 是否打断小爱回复
    playBlocking?: boolean; // 播放时是否阻塞
    // 文字回复
    text?: string;
    // 内置指令
    builtInCommand?: string;
    // 音频播放
    audioUrl?: string;
    audioText?: string;
    // 本地代码执行
    localCode?: string;
    // 沙盒代码执行
    sandboxCode?: string;
    // API调用
    apiUrl?: string;
    apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    apiHeaders?: Record<string, string>;
    apiBody?: string;
    // API响应解析配置
    apiResponseType?: 'auto' | 'json' | 'text'; // 响应数据类型
    apiResponsePath?: string; // JSON路径，如 "data.text" 或 "message"
    apiResponseFallback?: string; // 解析失败时的默认文本
    // 远程代码执行
    remoteUrl?: string;
    remoteCode?: string;
    remoteTimeout?: number; // 超时时间（秒）
    // 终端命令执行
    terminalCommand?: string;
    terminalWorkingDir?: string; // 工作目录（可选）
    terminalTimeout?: number; // 超时时间（秒）
    terminalReturnOutput?: boolean; // 是否返回命令输出
    // SSH配置（用于远程终端命令执行）
    ssh?: {
      host: string;
      port: number;
      username: string;
      authMethod: 'key' | 'password';
      privateKeyPath?: string; // 密钥认证时使用
      passphrase?: string; // 密钥密码短语
      password?: string; // 密码认证时使用
    };
  };
  enabled: boolean;
  description?: string;
  createdAt: number;
}

export interface AppSettings {
  callAIKeywords: string[];
  systemPrompt: string;
  historyMaxLength: number;
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

class WebServer {
  private app = express();
  private port = 3000;
  private rulesFile = join(__dirname, '../custom-rules.json');
  private settingsFile = join(__dirname, '../custom-settings.json');
  
  constructor() {
    this.setupMiddleware();
    this.setupRoutes();
    this.ensureDataFiles();
  }
  
  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '../web')));
  }
  
  private setupRoutes() {
    // 获取所有规则
    this.app.get('/api/rules', (req, res) => {
      try {
        const rules = this.loadRules();
        res.json(rules);
      } catch (error) {
        res.status(500).send('获取规则失败: ' + (error as Error).message);
      }
    });
    
    // 添加新规则
    this.app.post('/api/rules', (req, res) => {
      try {
        const rule: CustomRule = {
          id: randomUUID(),
          ...req.body,
          createdAt: Date.now()
        };
        
        // 验证必填字段
        if (!rule.trigger?.keyword || !rule.response?.type) {
          return res.status(400).send('触发关键词和响应类型为必填字段');
        }
        
        const rules = this.loadRules();
        
        // 检查关键词是否已存在
        if (rules.some(r => r.trigger.keyword === rule.trigger.keyword && r.trigger.type === rule.trigger.type)) {
          return res.status(400).send('该触发条件已存在');
        }
        
        rules.push(rule);
        this.saveRules(rules);
        
        res.json({ success: true, rule });
      } catch (error) {
        res.status(500).send('添加规则失败: ' + (error as Error).message);
      }
    });
    
    // 获取单个规则
    this.app.get('/api/rules/:id', (req, res) => {
      try {
        const rules = this.loadRules();
        const rule = rules.find(r => r.id === req.params.id);
        
        if (!rule) {
          return res.status(404).send('规则不存在');
        }
        
        res.json(rule);
      } catch (error) {
        res.status(500).send('获取规则失败: ' + (error as Error).message);
      }
    });
    
    // 更新规则
    this.app.put('/api/rules/:id', (req, res) => {
      try {
        const rules = this.loadRules();
        const index = rules.findIndex(r => r.id === req.params.id);
        
        if (index === -1) {
          return res.status(404).send('规则不存在');
        }
        
        // 验证必填字段
        if (!req.body.trigger?.keyword || !req.body.response?.type) {
          return res.status(400).send('触发关键词和响应类型为必填字段');
        }
        
        // 检查关键词冲突（排除当前规则）
        if (rules.some((r, i) => i !== index && 
            r.trigger.keyword === req.body.trigger.keyword && 
            r.trigger.type === req.body.trigger.type)) {
          return res.status(400).send('该触发条件已存在');
        }
        
        // 更新规则，保留原有的ID和创建时间
        const existingRule = rules[index];
        if (!existingRule) {
          return res.status(404).send('规则不存在');
        }
        
        rules[index] = {
          ...req.body,
          id: existingRule.id,
          createdAt: existingRule.createdAt,
          updatedAt: Date.now()
        };
        
        this.saveRules(rules);
        res.json({ success: true, rule: rules[index] });
      } catch (error) {
        res.status(500).send('更新规则失败: ' + (error as Error).message);
      }
    });
    
    // 删除规则
    this.app.delete('/api/rules/:id', (req, res) => {
      try {
        const rules = this.loadRules();
        const newRules = rules.filter(r => r.id !== req.params.id);
        
        if (newRules.length === rules.length) {
          return res.status(404).send('规则不存在');
        }
        
        this.saveRules(newRules);
        res.json({ success: true });
      } catch (error) {
        res.status(500).send('删除规则失败: ' + (error as Error).message);
      }
    });
    
    // 获取设置
    this.app.get('/api/settings', (req, res) => {
      try {
        const settings = this.loadSettings();
        res.json(settings);
      } catch (error) {
        res.status(500).send('获取设置失败: ' + (error as Error).message);
      }
    });
    
    // 保存设置
    this.app.post('/api/settings', async (req, res) => {
      try {
        const settings: AppSettings = req.body;
        this.saveSettings(settings);

        // 刷新动态配置，保证 getters 读到的是最新值
        const { dynamicConfig } = await import('./dynamic-config.js');
        dynamicConfig.reloadConfig();

        // 调用重启
        const [{ OpenXiaoAI }, { kOpenXiaoAIConfig }] = await Promise.all([
          import('./xiaoai.js'),
          import('../config.js'),
        ]);
        await OpenXiaoAI.restart(kOpenXiaoAIConfig);

          res.json({ success: true, restarted: true });
        } catch (error) {
          console.error('保存设置或重启失败:', error);
          res.status(500).send('保存设置失败: ' + (error as Error).message);
        }
    });
    
    // 重新加载配置
    this.app.post('/api/reload', (req, res) => {
      try {
        // 这里可以触发配置重新加载
        res.json({ success: true, message: '配置已重新加载' });
      } catch (error) {
        res.status(500).send('重新加载失败: ' + (error as Error).message);
      }
    });
  }
  
  private ensureDataFiles() {
    // 确保规则文件存在
    if (!existsSync(this.rulesFile)) {
      this.saveRules([]);
    }
    
    // 确保设置文件存在
    if (!existsSync(this.settingsFile)) {
      this.saveSettings({
        callAIKeywords: ['请', '你'],
        systemPrompt: '你是一个智能助手，请根据用户的问题给出回答。',
        historyMaxLength: 10
      });
    }
  }
  
  private loadRules(): CustomRule[] {
    try {
      const data = readFileSync(this.rulesFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  
  private saveRules(rules: CustomRule[]) {
    writeFileSync(this.rulesFile, JSON.stringify(rules, null, 2));
  }
  
  private loadSettings(): AppSettings {
    try {
      const data = readFileSync(this.settingsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {
        callAIKeywords: ['请', '你'],
        systemPrompt: '你是一个智能助手，请根据用户的问题给出回答。',
        historyMaxLength: 10
      };
    }
  }
  
  private saveSettings(settings: AppSettings) {
    writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
  }
  
  // 获取当前的自定义规则（供主程序调用）
  public getCurrentRules(): CustomRule[] {
    return this.loadRules().filter(rule => rule.enabled);
  }
  
  // 获取当前设置（供主程序调用）
  public getCurrentSettings(): AppSettings {
    return this.loadSettings();
  }
  
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`🌐 Web管理界面已启动: http://localhost:${this.port}`);
        console.log(`📝 管理页面地址: http://localhost:${this.port}/index.html`);
        resolve();
      });
    });
  }
}

export const webServer = new WebServer();

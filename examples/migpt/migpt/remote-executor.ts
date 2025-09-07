import express, { Express } from 'express';
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const app: Express = express();
app.use(express.json());

// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// 远程代码执行端点
app.post('/execute', async (req, res) => {
  const { language, code, timeout = 30 } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({ error: '缺少必需参数：language 和 code' });
  }
  
  const tempDir = mkdtempSync(join(tmpdir(), 'remote-exec-'));
  let tempFile: string | undefined;
  let command: string;
  let args: string[];
  
  try {
    switch (language.toLowerCase()) {
      case 'python':
        tempFile = join(tempDir, 'script.py');
        writeFileSync(tempFile, code);
        command = 'python3';
        args = [tempFile];
        break;
        
      case 'node':
      case 'nodejs':
      case 'javascript':
        tempFile = join(tempDir, 'script.js');
        writeFileSync(tempFile, code);
        command = 'node';
        args = [tempFile];
        break;
        
      default:
        return res.status(400).json({ error: `不支持的语言: ${language}` });
    }
    
    // 执行代码
    const result = await executeCode(command, args, timeout * 1000);
    
    // 清理临时文件
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // 忽略清理错误
    }
    
    res.json({
      success: true,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode
    });
    
  } catch (error) {
    // 清理临时文件
    try {
      if (tempFile) unlinkSync(tempFile);
    } catch (e) {
      // 忽略清理错误
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

function executeCode(command: string, args: string[], timeout: number): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0
      });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.REMOTE_EXECUTOR_PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 远程代码执行服务已启动: http://localhost:${port}`);
  console.log(`📋 执行端点: http://localhost:${port}/execute`);
  console.log(`💊 健康检查: http://localhost:${port}/health`);
});

export default app;

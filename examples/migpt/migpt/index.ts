import { kOpenXiaoAIConfig } from "config.js";
import { OpenXiaoAI } from "./xiaoai.js";
import { webServer } from "./web-server.js";

async function main() {
  console.log("🚀 正在启动MiGPT服务...");
  
  try {
    // 启动Web管理界面
    console.log("📝 启动Web管理界面...");
    await webServer.start();
    
    // 启动小爱音箱服务
    console.log("🎤 启动小爱音箱服务...");
    await OpenXiaoAI.start(kOpenXiaoAIConfig);
    
    console.log("✅ 所有服务启动完成！");
    
    // 监听进程信号，优雅关闭
    process.on('SIGTERM', () => {
      console.log('📴 收到SIGTERM信号，正在关闭服务...');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('📴 收到SIGINT信号，正在关闭服务...');
      process.exit(0);
    });
    
    // 保持进程运行
    console.log("🔄 服务运行中，按 Ctrl+C 退出");
    
  } catch (error) {
    console.error("❌ 服务启动失败:", error);
    process.exit(1);
  }
}

main();

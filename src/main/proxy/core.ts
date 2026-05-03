import { ChildProcess, spawn } from 'child_process'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let coreProcess: ChildProcess | null = null
let logs: string[] = []
let running = false

function pushLog(line: string): void {
  logs.push(line)
  if (logs.length > 100) {
    logs = logs.slice(-100)
  }
}

function getCorePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mihomo.exe')
  }
  return path.join(app.getAppPath(), 'resources', 'mihomo.exe')
}

export function startCore(configPath: string): boolean {
  const corePath = getCorePath()

  if (!fs.existsSync(corePath)) {
    pushLog(`[ERROR] 内核文件不存在: ${corePath}`)
    return false
  }

  if (!fs.existsSync(configPath)) {
    pushLog(`[ERROR] 配置文件不存在: ${configPath}`)
    return false
  }

  if (coreProcess && running) {
    return true
  }

  try {
    coreProcess = spawn(corePath, ['-f', configPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    coreProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data
        .toString()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      lines.forEach(pushLog)
    })

    coreProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data
        .toString()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      lines.forEach((line) => pushLog(`[STDERR] ${line}`))
    })

    coreProcess.on('exit', (code) => {
      pushLog(`[INFO] 内核退出，code: ${code}`)
      running = false
      coreProcess = null
    })

    coreProcess.on('error', (error) => {
      pushLog(`[ERROR] 内核错误: ${error.message}`)
      running = false
      coreProcess = null
    })

    running = true
    pushLog('[INFO] 内核已启动')
    return true
  } catch (error) {
    pushLog(`[ERROR] 启动内核失败: ${String(error)}`)
    running = false
    coreProcess = null
    return false
  }
}

export function stopCore(): void {
  if (!coreProcess) {
    running = false
    return
  }

  try {
    coreProcess.kill()
  } catch {
    // ignore
  }

  setTimeout(() => {
    if (coreProcess && !coreProcess.killed) {
      try {
        coreProcess.kill('SIGKILL')
      } catch {
        // ignore
      }
    }
    coreProcess = null
    running = false
  }, 1000)
}

export function restartCore(configPath: string): boolean {
  stopCore()
  return startCore(configPath)
}

export function isCoreRunning(): boolean {
  return running
}

export function getCoreOutput(): string[] {
  return [...logs]
}

import { execSync } from 'node:child_process';
import process from 'node:process';

const DEFAULT_PORTS = [3000, 5173];
const portsToClean = process.argv.slice(2).map(Number).filter((p) => !isNaN(p) && p > 0);
const targetPorts = portsToClean.length > 0 ? portsToClean : DEFAULT_PORTS;

const isWindows = process.platform === 'win32';

function getPidsOnPortWindows(port) {
  try {
    const output = execSync(`netstat -ano -p tcp`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const pids = new Set();
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Match TCP listening on port (e.g., 0.0.0.0:3000 or 127.0.0.1:3000)
      if (trimmed.startsWith('TCP') && trimmed.includes(`:${port} `)) {
        const parts = trimmed.split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid > 0 && pid !== process.pid) {
          pids.add(pid);
        }
      }
    }
    return Array.from(pids);
  } catch {
    return [];
  }
}

function getPidsOnPortPosix(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output
      .split('\n')
      .map((s) => parseInt(s.trim(), 10))
      .filter((pid) => pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

let killedAny = false;

for (const port of targetPorts) {
  const pids = isWindows ? getPidsOnPortWindows(port) : getPidsOnPortPosix(port);
  if (pids.length > 0) {
    for (const pid of pids) {
      const killed = killPid(pid);
      if (killed) {
        console.log(`[clean-ports] Released port ${port} by terminating PID ${pid}`);
        killedAny = true;
      }
    }
  }
}

if (!killedAny) {
  // Silent or brief notice
}

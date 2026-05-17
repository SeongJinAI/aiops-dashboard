export type Env = 'mac' | 'linux' | 'wsl' | 'windows';

export const ENV_LABELS: Record<Env, string> = {
  mac: 'macOS',
  linux: 'Linux',
  wsl: 'WSL (Ubuntu)',
  windows: 'Windows (PowerShell)',
};

export const ENV_ORDER: Env[] = ['mac', 'linux', 'wsl', 'windows'];

export function detectEnv(): Env {
  if (typeof navigator === 'undefined') return 'mac';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

export interface EnvCommands {
  envPatch: string;
  installHook: string;
}

export function envCommands(
  env: Env,
  apiBase: string,
  apiKey: string,
  tenantId: string,
): EnvCommands {
  if (env === 'windows') {
    const envPath = '$env:USERPROFILE\\.claude\\.env';
    const lines = [
      `AIOPS_REMOTE_URL=${apiBase}`,
      `AIOPS_API_KEY=${apiKey}`,
      `AIOPS_TENANT_ID=${tenantId}`,
    ].join('`n');
    return {
      envPatch:
        `New-Item -ItemType Directory -Force "$env:USERPROFILE\\.claude" | Out-Null; ` +
        `Add-Content -Path "${envPath}" -Value "${lines}"`,
      installHook:
        `$env:AIOPS_REMOTE_URL="${apiBase}"; ` +
        `iwr -useb ${apiBase}/api/scripts/install-hook.sh -OutFile install-hook.sh; bash install-hook.sh`,
    };
  }

  const linesPosix =
    `AIOPS_REMOTE_URL=${apiBase}\\n` +
    `AIOPS_API_KEY=${apiKey}\\n` +
    `AIOPS_TENANT_ID=${tenantId}\\n`;

  return {
    envPatch: `mkdir -p ~/.claude && printf '${linesPosix}' >> ~/.claude/.env`,
    installHook:
      `AIOPS_REMOTE_URL=${apiBase} ` +
      `bash -c "$(curl -fsSL ${apiBase}/api/scripts/install-hook.sh)"`,
  };
}

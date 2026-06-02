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
  /** 한 줄 통합 명령 — .env 패치 + 레포 등록 + Hook 설치 + 테스트 ping 모두 자동. */
  oneLineInstall: string;
  /** 기존 2단계 방식 (수동 옵션) — ~/.claude/.env 에 변수 3개 추가. */
  envPatch: string;
  /** 기존 2단계 방식 (수동 옵션) — Hook 스크립트 설치. */
  installHook: string;
}

export function envCommands(
  env: Env,
  apiBase: string,
  apiKey: string,
  tenantId: string,
): EnvCommands {
  // 키는 URL이 아닌 X-API-Key 헤더로 전달 — access-log/Referer/브라우저 히스토리에 노출되지 않음.
  const installUrl = `${apiBase}/api/scripts/install.sh`;
  const curlInstall = `curl -fsSL -H 'X-API-Key: ${apiKey}' '${installUrl}'`;

  if (env === 'windows') {
    const envPath = '$env:USERPROFILE\\.claude\\.env';
    const lines = [
      `AIOPS_REMOTE_URL=${apiBase}`,
      `AIOPS_API_KEY=${apiKey}`,
      `AIOPS_TENANT_ID=${tenantId}`,
    ].join('`n');
    return {
      // PowerShell에서 WSL bash로 실행 (Windows native bash 가정 — git for windows 등)
      oneLineInstall:
        `bash -c "$(${curlInstall})"`,
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
    oneLineInstall: `bash -c "$(${curlInstall})"`,
    envPatch: `mkdir -p ~/.claude && printf '${linesPosix}' >> ~/.claude/.env`,
    installHook:
      `AIOPS_REMOTE_URL=${apiBase} ` +
      `bash -c "$(curl -fsSL ${apiBase}/api/scripts/install-hook.sh)"`,
  };
}

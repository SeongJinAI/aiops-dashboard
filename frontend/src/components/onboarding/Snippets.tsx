import { useState } from 'react';
import { C } from '../../constants/colors';
import { ENV_LABELS, ENV_ORDER, type Env } from '../../constants/onboarding';

interface CodeBlockProps {
  code: string;
  label?: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 권한 없음 — 무시 */
    }
  };

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      )}
      <div style={{ position: 'relative' }}>
        <pre
          style={{
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 14,
            paddingRight: 80,
            fontSize: 12,
            overflow: 'auto',
            lineHeight: 1.6,
            fontFamily: 'monospace',
            color: C.text,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
          }}
        >
          {code}
        </pre>
        <button
          onClick={copy}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: copied ? C.green : C.surface,
            color: copied ? '#fff' : C.text,
            border: `1px solid ${copied ? C.green : C.border}`,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </div>
  );
}

interface EnvSelectorProps {
  value: Env | null;
  onChange: (env: Env) => void;
}

export function EnvSelector({ value, onChange }: EnvSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {ENV_ORDER.map((env) => {
        const active = env === value;
        return (
          <button
            key={env}
            onClick={() => onChange(env)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              background: active ? C.accent : C.surface,
              color: active ? '#fff' : C.text,
              border: `1px solid ${active ? C.accent : C.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {ENV_LABELS[env]}
          </button>
        );
      })}
    </div>
  );
}

// Lucide 기반 아이콘 래퍼. 산출물 UI 키트의 `<Icon name="..."/>` 인터페이스를 유지한다.
// stroke 1.75 / currentColor — Nova 디자인 시스템 규약.
import {
  Home, GitBranch, Folder, Activity, Workflow, MessageSquare, AlertCircle,
  Sparkles, Settings, Plug, Search, Sun, Moon, PanelLeft, ChevronDown,
  ChevronRight, Check, CheckCircle, X, XCircle, Info, Plus, RefreshCw,
  MoreVertical, ArrowUpRight, ArrowDownRight, Download, Lightbulb, Code,
  User, Play, Clock, Eye, EyeOff, Key, Copy, History, LogOut, Pause,
  FileText, Loader, type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';

const REGISTRY: Record<string, LucideIcon> = {
  'home': Home, 'git-branch': GitBranch, 'folder': Folder, 'activity': Activity,
  'workflow': Workflow, 'message-square': MessageSquare, 'alert-circle': AlertCircle,
  'sparkles': Sparkles, 'settings': Settings, 'plug': Plug, 'search': Search,
  'sun': Sun, 'moon': Moon, 'panel-left': PanelLeft, 'chevron-down': ChevronDown,
  'chevron-right': ChevronRight, 'check': Check, 'check-circle': CheckCircle,
  'x': X, 'x-circle': XCircle, 'info': Info, 'plus': Plus, 'refresh': RefreshCw,
  'more': MoreVertical, 'arrow-up-right': ArrowUpRight, 'arrow-down-right': ArrowDownRight,
  'download': Download, 'lightbulb': Lightbulb, 'code': Code, 'user': User,
  'play': Play, 'clock': Clock, 'eye': Eye, 'eye-off': EyeOff, 'key': Key,
  'copy': Copy, 'history': History, 'log-out': LogOut, 'pause': Pause,
  'file-text': FileText, 'loader': Loader,
};

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  const Cmp = REGISTRY[name];
  if (!Cmp) return null;
  return (
    <Cmp size={size} strokeWidth={1.75} className={className} style={style} aria-hidden />
  );
}

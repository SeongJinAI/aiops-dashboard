import { C } from './colors';
import type { RepoNode, RepoConnection } from '../types';

export const REPOS: RepoNode[] = [
  { id: "governance", name: "거버넌스", icon: "G", color: C.purple, desc: "규칙 / Hook / 설정 / 권한", fixed: true },
  { id: "test", name: "테스트", icon: "T", color: C.cyan, desc: "테스트 실행 / 결과 관리", fixed: true },
  { id: "knowledge", name: "지식", icon: "K", color: C.orange, desc: "기능명세서 / 아키텍처 / 인사이트", fixed: true },
  { id: "project", name: "프로젝트", icon: "P", color: C.green, desc: "API 서버 / 프론트 코드", fixed: false },
  { id: "rag", name: "RAG 챗봇", icon: "R", color: C.pink, desc: "지식 기반 Q&A 서비스", fixed: true },
];

export const CONNECTIONS: RepoConnection[] = [
  { from: "project", to: "knowledge", label: "문서 자동 생성", type: "write", color: C.green },
  { from: "test", to: "project", label: "코드 읽기", type: "read", color: C.cyan },
  { from: "test", to: "knowledge", label: "명세서 읽기", type: "read", color: C.cyan },
  { from: "project", to: "test", label: "테스트 결과 읽기", type: "read", color: C.green },
  { from: "rag", to: "knowledge", label: "문서 인덱싱", type: "read", color: C.pink },
  { from: "governance", to: "project", label: "규칙 적용", type: "config", color: C.purple },
  { from: "governance", to: "test", label: "규칙 적용", type: "config", color: C.purple },
  { from: "governance", to: "knowledge", label: "규칙 적용", type: "config", color: C.purple },
];

export const TABS = [
  { key: "repo-map", label: "레포 관계도" },
  { key: "swap", label: "프로젝트 교체" },
  { key: "main", label: "시스템 상태" },
  { key: "hooks", label: "Hook 모니터링" },
  { key: "workflow", label: "워크플로우" },
  { key: "prompts", label: "프롬프트" },
  { key: "misunderstandings", label: "오해 추적" },
  { key: "claude-config", label: "Claude 설정" },
  { key: "agent", label: "에이전트 (Hermes)" },
  { key: "connections", label: "연결 설정" },
] as const;

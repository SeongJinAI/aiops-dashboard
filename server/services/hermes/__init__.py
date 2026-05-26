"""
Hermes Agent — 프로젝트별 위키 자동 생성기.

핵심 모듈:
  - catalog: 활성 프로젝트의 로컬 .md 자산 재귀 스캔 + perspective 분류
  - wiki_builder (Phase 2): LLM 호출 + 챕터 작성 (미구현)
"""

from .catalog import catalog_assets, AssetEntry, Perspective

__all__ = ["catalog_assets", "AssetEntry", "Perspective"]

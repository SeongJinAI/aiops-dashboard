import { useState } from 'react';
import { C } from '../constants/colors';
import type { Project, ChatMessage } from '../types';

interface ChatBotProps {
  activeProject: Project;
}

export function ChatBot({ activeProject }: ChatBotProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "system", text: "RAG 챗봇이 초기화되었습니다. 지식 레포의 문서를 기반으로 답변합니다." },
  ]);

  const sendMessage = () => {
    if (chatInput.trim()) {
      setChatMessages(prev => [...prev,
        { role: "user", text: chatInput },
        { role: "assistant", text: "RAG 기능은 Phase 3에서 구현 예정입니다." },
      ]);
      setChatInput("");
    }
  };

  return (
    <>
      <button
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 48, height: 48, borderRadius: "50%",
          background: chatOpen ? C.dim : C.accent,
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: chatOpen ? "none" : `0 2px 12px ${C.accent}30`,
          transition: "all 0.2s",
          zIndex: 200,
          color: "#fff", fontSize: 18, fontWeight: 700,
        }}
      >
        {chatOpen ? "\u2715" : "Q"}
      </button>

      {chatOpen && (
        <div style={{
          position: "fixed", bottom: 84, right: 24,
          width: 380, height: 520,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: `0 4px 24px rgba(0,0,0,0.1)`,
          zIndex: 199,
        }}>
          <div style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.accent}15`, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>Q</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>RAG 챗봇</div>
              <div style={{ fontSize: 10, color: C.dim }}>지식 레포 기반 Q&A · {activeProject.name}</div>
            </div>
            <div style={{
              padding: "3px 8px", borderRadius: 4,
              background: `${C.orange}12`, border: `1px solid ${C.orange}30`,
              fontSize: 10, color: C.orange, fontWeight: 500,
            }}>
              PREVIEW
            </div>
          </div>

          <div style={{
            padding: "8px 16px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 6,
            background: `${C.orange}06`,
          }}>
            <span style={{ fontSize: 10, color: C.dim }}>연결된 지식:</span>
            <span style={{ fontSize: 10, color: C.orange }}>Phase 3에서 지식 레포 연동 예정</span>
          </div>

          <div style={{
            flex: 1, overflow: "auto", padding: 16,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                {msg.role === "system" ? (
                  <div style={{
                    fontSize: 11, color: C.dim, textAlign: "center",
                    padding: "6px 12px", background: C.surfaceAlt,
                    borderRadius: 4, alignSelf: "center",
                  }}>{msg.text}</div>
                ) : (
                  <>
                    <div style={{
                      fontSize: 10, color: C.dim, marginBottom: 4,
                      paddingLeft: msg.role === "user" ? 0 : 4,
                      paddingRight: msg.role === "user" ? 4 : 0,
                    }}>
                      {msg.role === "user" ? "나" : "RAG 챗봇"}
                    </div>
                    <div style={{
                      maxWidth: "85%", padding: "10px 14px",
                      borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      background: msg.role === "user" ? `${C.accent}10` : C.surfaceAlt,
                      border: `1px solid ${msg.role === "user" ? C.accent + "30" : C.border}`,
                      fontSize: 12, lineHeight: 1.6, color: C.text,
                    }}>{msg.text}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
              placeholder="지식 레포에 질문하기..."
              style={{
                flex: 1, padding: "10px 14px", fontSize: 12,
                fontFamily: "inherit", background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: "10px 14px", fontSize: 13,
                background: C.accent, fontWeight: 600,
                color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
              }}
            >{"\u2191"}</button>
          </div>
        </div>
      )}
    </>
  );
}

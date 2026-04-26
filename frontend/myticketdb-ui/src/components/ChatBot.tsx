import { useState } from "react";
import axios from "axios";

const AI_URL = "http://localhost:8000";
const BLUE = "#1B4FD8";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EventResult {
  eventId: number;
  eventName: string;
  venue: string;
  ticketTypeId: number;
  zoneName: string;
  price: number;
  remaining: number;
  soldOut: boolean;
}

interface ToolResult {
  type: "events" | "purchase";
  data: EventResult[] | { message: string; orderId?: number };
}

export default function ChatBot({ userId, onNavigateToEvent }: { userId: number; onNavigateToEvent: (eventId: number) => void; }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Message[]>([
    { role: "assistant", content: "嗨！我是 AI 購票小助手，可以幫你找票和購票。試試「幫我找五月天的票」" }
  ]);
  const [loading, setLoading] = useState(false);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);
    setToolResult(null);

    const newHistory = [...history, { role: "user" as const, content: userMsg }];
    setHistory(newHistory);

    try {
      const resp = await axios.post(`${AI_URL}/agent/chat`, {
        userId,
        message: userMsg,
        history: history.slice(-6),
      });
      const { reply, tool_result } = resp.data;
      setHistory([...newHistory, { role: "assistant", content: reply }]);
      if (tool_result) setToolResult(tool_result);
    } catch (e: any) {
      if (e.response) {
        setHistory([...newHistory, { 
          role: "assistant", 
          content: "目前系統內沒有找到符合的場次，請嘗試其他關鍵字" 
        }]);
      } else {
        setHistory([...newHistory, { 
          role: "assistant", 
          content: "抱歉，AI 助手暫時無法連線，請確認服務是否正常運作。" 
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const goToEvent = (eventId: number) => {
    onNavigateToEvent(eventId);
    setOpen(false);
  };

  return (
    <>
      {/* 浮動按鈕 */}
      <button onClick={() => setOpen(!open)} style={{
        position: "fixed", bottom: 28, right: 28,
        width: 56, height: 56, borderRadius: "50%",
        background: BLUE, color: "#fff",
        border: "none", fontSize: 24, cursor: "pointer",
        boxShadow: "0 4px 16px rgba(27,79,216,0.35)",
        zIndex: 1000, transition: "transform .15s",
      }}>
        {open ? "✕" : "🤖"}
      </button>

      {/* 對話框 — 放大版 */}
      {open && (
        <div style={{
          position: "fixed", bottom: 96, right: 28,
          width: 420, height: 560,
          background: "#fff", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          zIndex: 1000, overflow: "hidden",
          border: "1px solid #e0e7ff",
        }}>
          {/* Header */}
          <div style={{
            background: BLUE, color: "#fff",
            padding: "14px 18px", fontWeight: 600, fontSize: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <img src="/zzzlogo.png" alt="" style={{ height: 22, filter: "brightness(0) invert(1)" }} />
            AI 購票助手
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: .7 }}>ZZZ Ticket</span>
          </div>

          {/* 對話區 */}
          <div style={{
            flex: 1, overflowY: "auto", padding: 14,
            display: "flex", flexDirection: "column", gap: 10,
            background: "#f8faff",
          }}>
            {history.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? BLUE : "#fff",
                color: m.role === "user" ? "#fff" : "#1a1a2e",
                padding: "10px 14px", borderRadius: 12,
                maxWidth: "80%", fontSize: 13, lineHeight: 1.6,
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                border: m.role === "assistant" ? "1px solid #e0e7ff" : "none",
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", color: "#94a3b8", fontSize: 12 }}>
                AI 思考中...
              </div>
            )}

            {/* 場次卡片 */}
            {toolResult?.type === "events" && (toolResult.data as EventResult[]).map((e, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 10, padding: "12px 14px",
                border: "1px solid #e0e7ff", fontSize: 13,
                opacity: e.soldOut ? 0.6 : 1,
              }}>
                <div style={{ fontWeight: 600, color: "#1a1a2e", marginBottom: 4 }}>
                  {e.eventName}
                </div>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
                  {e.zoneName} — NT$ {e.price.toLocaleString()}
                  {e.soldOut
                    ? <span style={{ color: "#ef4444", marginLeft: 8 }}>已售罄</span>
                    : <span style={{ color: "#10b981", marginLeft: 8 }}>剩 {e.remaining} 張</span>
                  }
                </div>
                <button
                  disabled={e.soldOut}
                  onClick={() => !e.soldOut && goToEvent(e.eventId)}
                  style={{
                    width: "100%", padding: "8px",
                    borderRadius: 8,
                    background: e.soldOut ? "#e0e7ff" : BLUE,
                    color: e.soldOut ? "#94a3b8" : "#fff",
                    border: "none",
                    cursor: e.soldOut ? "not-allowed" : "pointer",
                    fontSize: 13, fontWeight: 500,
                  }}
                >
                  {e.soldOut ? "已售罄" : "前往購票頁 →"}
                </button>
              </div>
            ))}
          </div>

          {/* 快速按鈕 */}
          <div style={{
            display: "flex", gap: 6, padding: "8px 14px",
            borderTop: "1px solid #e0e7ff", flexWrap: "wrap",
            background: "#fff",
          }}>
            {["幫我找五月天的票", "周杰倫有票嗎", "熱門場次"].map(q => (
              <button key={q} onClick={() => { setInput(q); }} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 8,
                border: "1px solid #e0e7ff", background: "#f0f4ff",
                color: "#1B4FD8", cursor: "pointer",
              }}>
                {q}
              </button>
            ))}
          </div>

          {/* 輸入區 */}
          <div style={{
            display: "flex", gap: 8, padding: "10px 14px",
            borderTop: "1px solid #e0e7ff", background: "#fff",
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="輸入你的需求..."
              style={{
                flex: 1, fontSize: 13, padding: "9px 12px",
                borderRadius: 10, border: "1px solid #e0e7ff",
                outline: "none", background: "#f8faff",
              }}
            />
            <button onClick={send} disabled={loading} style={{
              padding: "9px 16px", borderRadius: 10,
              background: BLUE, color: "#fff",
              border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
            }}>
              送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
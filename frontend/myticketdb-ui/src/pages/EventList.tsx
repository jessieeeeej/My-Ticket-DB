import { useEffect, useState } from "react";
import { api } from "../api";

function CountdownBadge({ saleStartTime }: { saleStartTime: string }) {
  const calc = () => {
    const diff = Math.max(0, new Date(saleStartTime).getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return h > 0 ? `${h}時${m}分後開賣` : m > 0 ? `${m}分${s}秒後開賣` : `${s}秒後開賣！`;
  };
  const [text, setText] = useState(calc());
  useEffect(() => {
    const t = setInterval(() => setText(calc()), 1000);
    return () => clearInterval(t);
  }, [saleStartTime]);
  return <span style={{ color: "#1B4FD8", fontWeight: 500 }}>🔔 {text}</span>;
}

const BLUE = "#1B4FD8";

interface TicketType {
  id: number;
  zoneName: string;
  price: number;
  totalQty: number;
  remainingQty: number;
}

interface Event {
  id: number;
  name: string;
  venue: string;
  eventDate: string;
  saleStartTime: string | null;
  ticketTypes: TicketType[];
}

const EMOJIS: Record<string, string> = {
  "五月天": "🎸",
  "周杰倫": "🎤",
  "TWICE": "💗",
  "BLACKPINK": "🌹",
  "BTS": "💜",
};

export default function EventList({ onSelect }: { onSelect: (id: number) => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEvents().then(r => { setEvents(r.data); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: "#64748b", padding: 20 }}>載入中...</div>;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
        熱門場次
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        點擊活動卡片進入詳情頁搶票
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {events.map(e => {
          const emoji = Object.entries(EMOJIS).find(([k]) => e.name.includes(k))?.[1] || "🎶";
          const totalRemaining = e.ticketTypes.reduce((s, tt) => s + tt.remainingQty, 0);
          const totalQty = e.ticketTypes.reduce((s, tt) => s + tt.totalQty, 0);
          const pct = Math.round(((totalQty - totalRemaining) / totalQty) * 100);
          const minPrice = Math.min(...e.ticketTypes.map(tt => tt.price));
          const isEnded = new Date(e.eventDate).getTime() < Date.now();
          const isUpcoming = e.saleStartTime && new Date(e.saleStartTime).getTime() > Date.now();

          return (
            <div
              key={e.id}
              onClick={() => onSelect(e.id)}
              style={{
                background: "#fff", borderRadius: 14,
                border: "1px solid #e0e7ff",
                padding: 0, cursor: "pointer",
                overflow: "hidden",
                transition: "box-shadow .15s, transform .15s",
                boxShadow: "0 1px 4px rgba(27,79,216,0.06)",
              }}
              onMouseEnter={el => {
                (el.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(27,79,216,0.15)";
                (el.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={el => {
                (el.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(27,79,216,0.06)";
                (el.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              }}
            >
              {/* Banner */}
              <div style={{
                background: `linear-gradient(135deg, ${BLUE} 0%, #3b82f6 100%)`,
                padding: "20px 20px 16px",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 28, flexShrink: 0,
                }}>
                  {emoji}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                    {e.name}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                    📍 {e.venue} &nbsp;|&nbsp; 🗓 {new Date(e.eventDate).toLocaleDateString("zh-TW")}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>票價起</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: BLUE }}>
                      NT$ {minPrice.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>剩餘票數</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: totalRemaining > 0 ? "#1a1a2e" : "#ef4444" }}>
                      {totalRemaining > 0 ? totalRemaining : "售罄"}
                    </div>
                  </div>
                </div>

                {/* 售出進度條 */}
                <div style={{ height: 5, background: "#e0e7ff", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 3,
                    background: pct > 90 ? "#ef4444" : pct > 60 ? "#f59e0b" : BLUE,
                    transition: "width .3s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                <span>
                    {isEnded
                    ? "⚫ 活動已結束"
                    : isUpcoming
                    ? <CountdownBadge saleStartTime={e.saleStartTime!} />
                    : totalRemaining === 0
                    ? "已售罄"
                    : `已售出 ${pct}%`}
                </span>
                <span style={{ color: isEnded ? "#94a3b8" : BLUE, fontWeight: 500 }}>
                    {isEnded ? "查看紀錄" : "查看詳情 →"}
                </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
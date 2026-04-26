import { useEffect, useState } from "react";
import { api } from "../api";
import SaleCountdown from "../components/SaleCountdown";


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
  description: string;
  saleStartTime: string | null;
  ticketTypes: TicketType[];
}

// 座位示意圖 SVG
function SeatMap({ ticketTypes, onSelect, selectedId }: {
  ticketTypes: TicketType[];
  onSelect: (tt: TicketType) => void;
  selectedId: number | null;
}) {
  const zones = [
    { id: 0, label: "舞台", x: 130, y: 30, w: 140, h: 40, fill: "#1B4FD8", color: "#fff", clickable: false },
    { id: 1, label: "搖滾站票區", x: 110, y: 90, w: 180, h: 70, fill: "#dbeafe", color: "#1e40af", clickable: true },
    { id: 2, label: "一般座位區A", x: 40, y: 90, w: 60, h: 130, fill: "#ede9fe", color: "#5b21b6", clickable: true },
    { id: 3, label: "一般座位區A", x: 300, y: 90, w: 60, h: 130, fill: "#ede9fe", color: "#5b21b6", clickable: true },
    { id: 4, label: "VIP貴賓席", x: 110, y: 175, w: 80, h: 50, fill: "#fef3c7", color: "#92400e", clickable: true },
    { id: 5, label: "VIP貴賓席", x: 210, y: 175, w: 80, h: 50, fill: "#fef3c7", color: "#92400e", clickable: true },
  ];

  // 對應票種
  const getTicketType = (zoneLabel: string) =>
    ticketTypes.find(tt => tt.zoneName.includes(zoneLabel.replace("區A", "").replace("VIP", "VIP"))) || null;

  return (
    <div style={{ background: "#f8faff", borderRadius: 12, padding: 16, border: "1px solid #e0e7ff" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, textAlign: "center" }}>
        點擊區域選擇票種
      </div>
      <svg viewBox="0 0 400 280" style={{ width: "100%", maxHeight: 260 }}>
        {/* 背景 */}
        <rect x="0" y="0" width="400" height="280" fill="#f8faff" rx="8" />

        {/* 區域 */}
        {zones.map((z, i) => {
          const tt = z.clickable ? ticketTypes.find(t =>
            z.label.includes("搖滾") ? t.zoneName.includes("搖滾") :
            z.label.includes("VIP") ? t.zoneName.includes("VIP") :
            t.zoneName.includes("一般")
          ) : null;
          const isSelected = tt && selectedId === tt.id;
          const soldOut = tt && tt.remainingQty === 0;

          return (
            <g key={i} onClick={() => tt && !soldOut && onSelect(tt)}
              style={{ cursor: z.clickable && !soldOut ? "pointer" : "default" }}>
              <rect
                x={z.x} y={z.y} width={z.w} height={z.h}
                fill={soldOut ? "#f1f5f9" : z.fill}
                stroke={isSelected ? BLUE : "#cbd5e1"}
                strokeWidth={isSelected ? 2.5 : 1}
                rx="6"
                opacity={soldOut ? 0.5 : 1}
              />
              <text
                x={z.x + z.w / 2} y={z.y + z.h / 2 - 5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="10" fill={soldOut ? "#94a3b8" : z.color}
                fontWeight={isSelected ? "bold" : "normal"}
              >
                {z.label}
              </text>
              {tt && (
                <text
                  x={z.x + z.w / 2} y={z.y + z.h / 2 + 10}
                  textAnchor="middle" fontSize="9" fill={soldOut ? "#94a3b8" : z.color}
                >
                  {soldOut ? "售罄" : `NT$${tt.price.toLocaleString()} 剩${tt.remainingQty}`}
                </text>
              )}
            </g>
          );
        })}

        {/* 觀眾席標示 */}
        <text x="200" y="265" textAnchor="middle" fontSize="10" fill="#94a3b8">觀眾席</text>
      </svg>

      {/* 圖例 */}
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { color: "#dbeafe", label: "搖滾區" },
          { color: "#ede9fe", label: "一般座位" },
          { color: "#fef3c7", label: "VIP" },
          { color: "#f1f5f9", label: "售罄" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color, border: "1px solid #cbd5e1" }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventDetail({
  eventId,
  onBack,
  onBuy,
}: {
  eventId: number;
  onBack: () => void;
  onBuy: (ticketTypeId: number, eventName: string, zoneName: string) => void;
}) {
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedTT, setSelectedTT] = useState<TicketType | null>(null);

  useEffect(() => {
    api.getEvents().then(r => {
      const ev = r.data.find((e: Event) => e.id === eventId);
      setEvent(ev || null);
    });
  }, [eventId]);

  if (!event) return <div style={{ padding: 20, color: "#888" }}>載入中...</div>;

  const isEnded = new Date(event.eventDate).getTime() < Date.now();
  const isUpcoming = event.saleStartTime &&
    new Date(event.saleStartTime).getTime() > Date.now();

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        color: BLUE, fontSize: 13, marginBottom: 16,
        display: "flex", alignItems: "center", gap: 4, padding: 0,
      }}>
        ← 返回活動列表
      </button>

      {/* Event Header */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid #e0e7ff", padding: 20, marginBottom: 16,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>
          {event.name}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
          📍 {event.venue}
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          🗓 {new Date(event.eventDate).toLocaleDateString("zh-TW", {
            year: "numeric", month: "long", day: "numeric",
            weekday: "long", hour: "2-digit", minute: "2-digit"
          })}
        </div>
      </div>

      {/* 開售倒數 */}
      {event.saleStartTime && new Date(event.saleStartTime).getTime() > Date.now() && (
        <SaleCountdown
          saleStartTime={event.saleStartTime}
          onSaleStart={() => {
            api.getEvents().then(r => {
              const ev = r.data.find((e: Event) => e.id === eventId);
              setEvent(ev || null);
            });
          }}
        />
      )}

      {/* 主體：左座位圖，右票種 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* 左：座位示意圖 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 8 }}>
            座位示意圖
          </div>
          <SeatMap
            ticketTypes={event.ticketTypes}
            onSelect={setSelectedTT}
            selectedId={selectedTT?.id || null}
          />
        </div>

        {/* 右：票種選擇 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 8 }}>
            選擇票種
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {event.ticketTypes.map(tt => {
              const pct = Math.round(((tt.totalQty - tt.remainingQty) / tt.totalQty) * 100);
              const isSelected = selectedTT?.id === tt.id;
              const soldOut = tt.remainingQty === 0;

              return (
                <div
                  key={tt.id}
                  onClick={() => !soldOut && setSelectedTT(tt)}
                  style={{
                    background: "#fff", borderRadius: 10, padding: "12px 14px",
                    border: isSelected ? `2px solid ${BLUE}` : "1px solid #e0e7ff",
                    cursor: soldOut ? "not-allowed" : "pointer",
                    opacity: soldOut ? 0.5 : 1,
                    transition: "border .15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
                      {tt.zoneName}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: BLUE }}>
                      NT$ {tt.price.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#e0e7ff", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 2,
                      background: pct > 90 ? "#ef4444" : pct > 60 ? "#f59e0b" : BLUE,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {soldOut ? "已售罄" : `剩餘 ${tt.remainingQty} / ${tt.totalQty} 張`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 搶票按鈕 */}
          <button
        disabled={!selectedTT || isEnded || !!isUpcoming || selectedTT.remainingQty === 0}
        onClick={() => selectedTT && !isEnded && !isUpcoming &&
            onBuy(selectedTT.id, event.name, selectedTT.zoneName)}
        style={{
            width: "100%", marginTop: 16, padding: "12px",
            borderRadius: 10, border: "none",
            background: (!selectedTT || isEnded || isUpcoming) ? "#e0e7ff" : BLUE,
            color: (!selectedTT || isEnded || isUpcoming) ? "#94a3b8" : "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: (!selectedTT || isEnded || isUpcoming) ? "not-allowed" : "pointer",
        }}
        >
        {isEnded
            ? "⚫ 活動已結束"
            : isUpcoming
            ? "🔔 尚未開售"
            : !selectedTT
            ? "請先選擇票種"
            : selectedTT.remainingQty === 0
            ? "此票種已售罄"
            : "立即搶票 →"}
        </button>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { api } from "../api";

const BLUE = "#1B4FD8";

interface Order {
  id: number;
  status:  string | number;
  quantity: number;
  createdAt: string;
  ticketType: {
    zoneName: string;
    price: number;
    event: {
      name: string;
      venue: string;
      eventDate: string;
    };
  };
}

function StatusBadge({ status }: { status: string | number }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    Pending:   { bg: "#fef3c7", color: "#92400e", label: "待付款" },
    Paid:      { bg: "#d1fae5", color: "#065f46", label: "已付款" },
    Cancelled: { bg: "#fee2e2", color: "#991b1b", label: "已取消" },
    Expired:   { bg: "#f1f5f9", color: "#475569", label: "已過期" },
  };
  const s = map[status] || { bg: "#f1f5f9", color: "#475569", label: status };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "3px 10px", borderRadius: 8,
      fontSize: 11, fontWeight: 500,
    }}>{s.label}</span>
  );
}

export default function MyOrders({
  userId,
  username,
  onBack,
}: {
  userId: number;
  username: string;
  onBack: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUserOrders(userId).then(r => {
      setOrders(r.data);
      setLoading(false);
    });
  }, [userId]);

  const totalPaid = orders.filter(o => o.status === 1 || o.status === "Paid").length;
  const totalPending = orders.filter(o => o.status === 0 || o.status === "Pending").length;

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        color: BLUE, fontSize: 13, marginBottom: 16,
        display: "flex", alignItems: "center", gap: 4, padding: 0,
      }}>
        ← 返回
      </button>

      {/* Header */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid #e0e7ff", padding: "16px 20px",
        marginBottom: 16, display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: BLUE, color: "#fff",
          display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 20, fontWeight: 700,
        }}>
          {username[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>
            {username} 的訂單
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            共 {orders.length} 筆訂單
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#065f46" }}>{totalPaid}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>已付款</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>{totalPending}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>待付款</div>
          </div>
        </div>
      </div>

      {/* 訂單列表 */}
      {loading ? (
        <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>載入中...</div>
      ) : orders.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 12,
          border: "1px solid #e0e7ff", padding: 40,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎫</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>還沒有任何訂單</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            快去搶票吧！
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map(o => (
            <div key={o.id} style={{
              background: "#fff", borderRadius: 12,
              border: "1px solid #e0e7ff", padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              {/* 票券圖示 */}
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: (o.status === 1 || o.status === "Paid") ? "#d1fae5" : "#f0f4ff",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 20, flexShrink: 0,
                }}>
                    {(o.status === 1 || o.status === "Paid") ? "✓" : "🎫"}
              </div>

              {/* 訂單資訊 */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 3 }}>
                  {o.ticketType.event.name}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                  {o.ticketType.zoneName} × {o.quantity} 張
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  📍 {o.ticketType.event.venue} ·{" "}
                  🗓 {new Date(o.ticketType.event.eventDate).toLocaleDateString("zh-TW")}
                </div>
              </div>

              {/* 右側 */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ marginBottom: 6 }}>
                  <StatusBadge status={o.status} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: BLUE }}>
                  NT$ {(o.ticketType.price * o.quantity).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  訂單 #{o.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
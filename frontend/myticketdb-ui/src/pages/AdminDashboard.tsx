import { useEffect, useState } from "react";
import { api } from "../api";

const BLUE = "#1B4FD8";

// ── 型別 ──────────────────────────────────────────
interface DashboardData {
  totalOrders: number;
  todayOrders: number;
  successOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  blockedCount: number;
  auditCount: number;
  successRate: number;
  hourlyOrders: { hour: number; count: number }[];
  eventStats: {
    id: number; name: string;
    totalQty: number; remainingQty: number; soldQty: number;
  }[];
}

interface Order {
  id: number;
  status: string;
  quantity: number;
  createdAt: string;
  user: { id: number; username: string; email: string };
  ticketType: {
    id: number; zoneName: string; price: number;
    event: { id: number; name: string };
  };
}

interface InventoryItem {
  id: number;
  zoneName: string;
  price: number;
  totalQty: number;
  dbStock: number;
  redisStock: number;
  eventId: number;
  eventName: string;
  soldQty: number;
  soldPct: number;
}

interface AuditItem {
  id: number; userId: number;
  riskScore: number; reason: string;
  action: string; resolved: boolean; createdAt: string;
}

interface BlacklistItem {
  id: number; userId: number;
  reason: string; blockedAt: string;
}

// ── 小元件 ────────────────────────────────────────
function KpiCard({ label, value, sub, color }: {
  label: string; value: string | number;
  sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e0e7ff", padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#1a1a2e" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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
      padding: "2px 8px", borderRadius: 8,
      fontSize: 11, fontWeight: 500,
    }}>{s.label}</span>
  );
}

// ── 主元件 ────────────────────────────────────────
type Tab = "dashboard" | "orders" | "inventory" | "audit" | "blacklist";

export default function AdminDashboard({ userId }: { userId: number }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [orderStatus, setOrderStatus] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editStock, setEditStock] = useState<Record<string, string>>({});
  const [auditQueue, setAuditQueue] = useState<AuditItem[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);

  // 載入各 tab 資料
  useEffect(() => {
    if (!userId || userId === 0) return; 

    if (tab === "dashboard") {
      api.getDashboard(userId).then(r => setDash(r.data));
      const t = setInterval(() => api.getDashboard(userId).then(r => setDash(r.data)), 10000);
      return () => clearInterval(t);
    }
    if (tab === "orders") loadOrders();
    if (tab === "inventory") api.getInventory(userId).then(r => setInventory(r.data));
    if (tab === "audit") api.getAuditQueue(userId).then(r => setAuditQueue(r.data));
    if (tab === "blacklist") api.getBlacklist(userId).then(r => setBlacklist(r.data));
  }, [tab]);

  useEffect(() => { if (tab === "orders") loadOrders(); }, [orderPage, orderStatus]);

  const loadOrders = () => {
    api.getOrders(userId, orderStatus, orderPage).then(r => {
      setOrders(r.data.orders);
      setOrderTotal(r.data.total);
    });
  };

  const resolveAudit = async (id: number) => {
    await api.resolveAudit(userId, id);
    setAuditQueue(q => q.filter(a => a.id !== id));
  };

  const blockUser = async (targetUserId: number) => {
    await api.blockUser(userId, targetUserId, "管理員手動封鎖");
    api.getAuditQueue(userId).then(r => setAuditQueue(r.data));
  };

  const adjustStock = async (id: number) => {
    const val = parseInt(editStock[id]);
    if (isNaN(val)) return;
    await api.adjustStock(userId, id, val);
    api.getInventory(userId).then(r => setInventory(r.data));
    setEditStock(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "📊 總覽" },
    { key: "orders",    label: "🎫 訂單" },
    { key: "inventory", label: "📦 庫存" },
    { key: "audit",     label: `🔍 審核${auditQueue.length > 0 ? ` (${auditQueue.length})` : ""}` },
    { key: "blacklist", label: "🚫 黑名單" },
  ];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", marginBottom: 16 }}>
        管理後台
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: "#fff", borderRadius: 10, padding: 4,
        border: "1px solid #e0e7ff",
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "7px 4px", borderRadius: 8, border: "none",
            background: tab === t.key ? BLUE : "transparent",
            color: tab === t.key ? "#fff" : "#64748b",
            cursor: "pointer", fontSize: 12, fontWeight: 500,
            transition: "background .15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === "dashboard" && dash && (
        <div>
          {/* KPI 卡片 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            <KpiCard label="今日搶票" value={dash.todayOrders} sub="筆請求" />
            <KpiCard label="成功率" value={`${dash.successRate}%`} color={BLUE} />
            <KpiCard label="待付款" value={dash.pendingOrders} color="#92400e" />
            <KpiCard label="AI 封鎖" value={dash.blockedCount} color="#991b1b" />
          </div>

          {/* 各活動售票進度 */}
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e0e7ff", padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 12 }}>
              各活動售票進度
            </div>
            {dash.eventStats.map(e => {
              const pct = e.totalQty > 0
                ? Math.round(e.soldQty / e.totalQty * 100) : 0;
              return (
                <div key={e.id} style={{ marginBottom: 14 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 12, marginBottom: 5,
                  }}>
                    <span style={{ color: "#1a1a2e", fontWeight: 500 }}>{e.name}</span>
                    <span style={{ color: "#64748b" }}>
                      售出 {e.soldQty} / {e.totalQty} 張（{pct}%）
                    </span>
                  </div>
                  <div style={{
                    height: 8, background: "#e0e7ff",
                    borderRadius: 4, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: pct > 90 ? "#ef4444" : pct > 60 ? "#f59e0b" : BLUE,
                      borderRadius: 4, transition: "width .5s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 訂單狀態分佈 */}
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e0e7ff", padding: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 12 }}>
              訂單狀態分佈
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { label: "待付款", value: dash.pendingOrders,   color: "#f59e0b" },
                { label: "已付款", value: dash.successOrders,   color: "#10b981" },
                { label: "已取消", value: dash.cancelledOrders, color: "#ef4444" },
                { label: "總計",   value: dash.totalOrders,     color: BLUE },
              ].map(s => (
                <div key={s.label} style={{
                  textAlign: "center", padding: "12px 8px",
                  background: "#f8faff", borderRadius: 8,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 訂單管理 ── */}
      {tab === "orders" && (
        <div>
          {/* 篩選 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["", "Pending", "Paid", "Cancelled"].map(s => (
              <button key={s} onClick={() => { setOrderStatus(s); setOrderPage(1); }}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  border: "1px solid #e0e7ff",
                  background: orderStatus === s ? BLUE : "#fff",
                  color: orderStatus === s ? "#fff" : "#64748b",
                }}>
                {s === "" ? "全部" : s === "Pending" ? "待付款" : s === "Paid" ? "已付款" : "已取消"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", lineHeight: "30px" }}>
              共 {orderTotal} 筆
            </span>
          </div>

          {/* 訂單列表 */}
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e0e7ff", overflow: "hidden",
          }}>
            {/* 表頭 */}
            <div style={{
              display: "grid", gridTemplateColumns: "60px 1fr 1fr 80px 80px 80px",
              gap: 8, padding: "10px 14px",
              background: "#f8faff", borderBottom: "1px solid #e0e7ff",
              fontSize: 11, color: "#64748b", fontWeight: 500,
            }}>
              <div>訂單#</div><div>用戶</div><div>活動 / 票種</div>
              <div>數量</div><div>狀態</div><div>時間</div>
            </div>

            {orders.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                沒有訂單
              </div>
            ) : orders.map(o => (
              <div key={o.id} style={{
                display: "grid", gridTemplateColumns: "60px 1fr 1fr 80px 80px 80px",
                gap: 8, padding: "10px 14px",
                borderBottom: "1px solid #f0f4ff", fontSize: 12, alignItems: "center",
              }}>
                <div style={{ color: "#94a3b8" }}>#{o.id}</div>
                <div>
                  <div style={{ fontWeight: 500, color: "#1a1a2e" }}>{o.user.username}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{o.user.email}</div>
                </div>
                <div>
                  <div style={{ color: "#1a1a2e" }}>{o.ticketType.event.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {o.ticketType.zoneName} · NT$ {o.ticketType.price.toLocaleString()}
                  </div>
                </div>
                <div style={{ color: "#1a1a2e" }}>{o.quantity} 張</div>
                <div><StatusBadge status={o.status} /></div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>
                  {new Date(o.createdAt).toLocaleDateString("zh-TW")}
                </div>
              </div>
            ))}
          </div>

          {/* 分頁 */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
            {Array.from({ length: Math.ceil(orderTotal / 20) }, (_, i) => (
              <button key={i} onClick={() => setOrderPage(i + 1)} style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid #e0e7ff",
                background: orderPage === i + 1 ? BLUE : "#fff",
                color: orderPage === i + 1 ? "#fff" : "#64748b",
                cursor: "pointer", fontSize: 12,
              }}>{i + 1}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── 庫存管理 ── */}
      {tab === "inventory" && (
        <div style={{
          background: "#fff", borderRadius: 12,
          border: "1px solid #e0e7ff", overflow: "hidden",
        }}>
          {/* 表頭 */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 140px 80px 80px 80px 100px 120px",
            gap: 8, padding: "10px 14px",
            background: "#f8faff", borderBottom: "1px solid #e0e7ff",
            fontSize: 11, color: "#64748b", fontWeight: 500,
          }}>
            <div>活動 / 票種</div><div>售出進度</div>
            <div>總量</div><div>DB庫存</div><div>Redis庫存</div>
            <div>已售 %</div><div>調整庫存</div>
          </div>

          {inventory.map(item => (
            <div key={item.id} style={{
              display: "grid", gridTemplateColumns: "1fr 140px 80px 80px 80px 100px 120px",
              gap: 8, padding: "10px 14px",
              borderBottom: "1px solid #f0f4ff", fontSize: 12, alignItems: "center",
            }}>
              <div>
                <div style={{ fontWeight: 500, color: "#1a1a2e" }}>{item.eventName}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {item.zoneName} · NT$ {item.price.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{
                  height: 5, background: "#e0e7ff",
                  borderRadius: 3, overflow: "hidden", marginBottom: 3,
                }}>
                  <div style={{
                    width: `${item.soldPct}%`, height: "100%",
                    background: item.soldPct > 90 ? "#ef4444"
                      : item.soldPct > 60 ? "#f59e0b" : BLUE,
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  售出 {item.soldQty} 張
                </div>
              </div>
              <div style={{ color: "#1a1a2e" }}>{item.totalQty}</div>
              <div style={{ color: "#1a1a2e" }}>{item.dbStock}</div>
              <div style={{
                color: item.redisStock === item.dbStock ? "#10b981" : "#ef4444",
                fontWeight: 500,
              }}>
                {item.redisStock === -1 ? "—" : item.redisStock}
                {item.redisStock !== item.dbStock && item.redisStock !== -1 && (
                  <span style={{ fontSize: 10, marginLeft: 3 }}>⚠️</span>
                )}
              </div>
              <div style={{
                color: item.soldPct > 90 ? "#ef4444"
                  : item.soldPct > 60 ? "#f59e0b" : "#10b981",
                fontWeight: 500,
              }}>
                {item.soldPct}%
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  value={editStock[item.id] ?? ""}
                  onChange={e => setEditStock(s => ({ ...s, [item.id]: e.target.value }))}
                  placeholder={String(item.dbStock)}
                  style={{
                    width: 56, padding: "4px 6px", borderRadius: 6,
                    border: "1px solid #e0e7ff", fontSize: 12,
                  }}
                />
                <button onClick={() => adjustStock(item.id)} style={{
                  padding: "4px 8px", borderRadius: 6, border: "none",
                  background: BLUE, color: "#fff", cursor: "pointer", fontSize: 11,
                }}>更新</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI 審核佇列 ── */}
      {tab === "audit" && (
        <div style={{
          background: "#fff", borderRadius: 12,
          border: "1px solid #e0e7ff", overflow: "hidden",
        }}>
          {auditQueue.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              ✅ 目前沒有待審核項目
            </div>
          ) : auditQueue.map(item => {
            const riskColor = item.riskScore >= 90 ? "#991b1b"
              : item.riskScore >= 70 ? "#92400e" : "#065f46";
            const riskBg = item.riskScore >= 90 ? "#fee2e2"
              : item.riskScore >= 70 ? "#fef3c7" : "#d1fae5";
            return (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderBottom: "1px solid #f0f4ff",
              }}>
                <span style={{
                  background: riskBg, color: riskColor,
                  padding: "3px 10px", borderRadius: 8,
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  {item.riskScore} 分
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a2e" }}>
                    用戶 #{item.userId}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {item.reason}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginRight: 8 }}>
                  {new Date(item.createdAt).toLocaleString("zh-TW")}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => resolveAudit(item.id)} style={{
                    padding: "5px 12px", borderRadius: 7,
                    border: "1px solid #6ee7b7", background: "#d1fae5",
                    color: "#065f46", cursor: "pointer", fontSize: 12,
                  }}>放行</button>
                  <button onClick={() => blockUser(item.userId)} style={{
                    padding: "5px 12px", borderRadius: 7,
                    border: "1px solid #fca5a5", background: "#fee2e2",
                    color: "#991b1b", cursor: "pointer", fontSize: 12,
                  }}>封鎖</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 黑名單 ── */}
      {tab === "blacklist" && (
        <div style={{
          background: "#fff", borderRadius: 12,
          border: "1px solid #e0e7ff", overflow: "hidden",
        }}>
          {blacklist.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              黑名單為空
            </div>
          ) : blacklist.map(item => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderBottom: "1px solid #f0f4ff", fontSize: 13,
            }}>
              <span style={{
                background: "#fee2e2", color: "#991b1b",
                padding: "3px 10px", borderRadius: 8,
                fontSize: 11, fontWeight: 600,
              }}>封鎖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: "#1a1a2e" }}>用戶 #{item.userId}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item.reason}</div>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {new Date(item.blockedAt).toLocaleDateString("zh-TW")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
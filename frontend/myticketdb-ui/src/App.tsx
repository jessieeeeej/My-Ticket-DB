import { useState, useEffect } from "react";
import { api } from "./api";
import EventList from "./pages/EventList";
import EventDetail from "./pages/EventDetail";
import AdminDashboard from "./pages/AdminDashboard";
import WaitingRoom from "./components/WaitingRoom";
import ChatBot from "./components/ChatBot";
import AuthModal from "./components/AuthModal";
import MyOrders from "./pages/MyOrders";

const BLUE = "#1B4FD8";

type Page = "list" | "detail" | "admin" | "orders";
type Modal = "waiting" | "success" | null;

export default function App() {
  const [page, setPage] = useState<Page>("list");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTicket, setSelectedTicket] = useState<{
    id: number; eventName: string; zoneName: string;
  } | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [payTimer, setPayTimer] = useState(900);
  const [user, setUser] = useState<{
    id: number; username: string; email: string; role: string;
  } | null>(() => {
    // 從 localStorage 恢復登入狀態（關掉瀏覽器就登出）
    const saved = localStorage.getItem("zzz_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuth, setShowAuth] = useState(false);
  const [pendingBuy, setPendingBuy] = useState<{
    id: number; eventName: string; zoneName: string;
  } | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("zzz_user");
    if (!saved) return;
    const savedUser = JSON.parse(saved);
    api.getMe(savedUser.id).then(r => {
      setUser(r.data);
      localStorage.setItem("zzz_user", JSON.stringify(r.data));
    }).catch(() => {
      setUser(null);
      localStorage.removeItem("zzz_user");
    });
  }, []);

  const handleSelectEvent = (id: number) => {
    setSelectedEventId(id);
    setPage("detail");
  };

  const handleBuy = (id: number, eventName: string, zoneName: string) => {
    if (!user) {
      // 沒登入 → 記住想買的票，跳出登入框
      setPendingBuy({ id, eventName, zoneName });
      setShowAuth(true);
      return;
    }
    setSelectedTicket({ id, eventName, zoneName });
    setModal("waiting");
  };

  const handleAuthSuccess = (u: typeof user) => {
    setUser(u);
    localStorage.setItem("zzz_user", JSON.stringify(u));
    setShowAuth(false);
    // 登入成功後繼續剛才的搶票
    if (pendingBuy) {
      setSelectedTicket(pendingBuy);
      setModal("waiting");
      setPendingBuy(null);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("zzz_user");
  };

  const handleSuccess = (oid: number) => {
    setOrderId(oid);
    setModal("success");
    setPayTimer(900);  // 重設計時器
    setPaid(false);
  };

  const handleFail = (msg: string) => {
    setModal(null);
    setPaid(false);
    alert(msg);
  };

  useEffect(() => {
    if (modal !== "success" || paid) return;
    
    const interval = setInterval(() => {
      setPayTimer(t => {
        if (t <= 1) {
          clearInterval(interval);
          setModal(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [modal, paid]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ff" }}>
      {/* Nav */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e0e7ff",
        padding: "0 24px",
        display: "flex", alignItems: "center",
        height: 56, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 8px rgba(27,79,216,0.08)",
      }}>
        <div
          onClick={() => setPage("list")}
          style={{
            display: "flex", alignItems: "center",
            gap: 10, cursor: "pointer",
          }}
        >
          <img src="/zzzlogo.png" alt="ZZZ Ticket" style={{ height: 32 }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: BLUE, letterSpacing: "-0.5px" }}>
            ZZZ Ticket
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
        {([ 
          ["list", "活動列表"],
          ...(user?.role === "ADMIN" ? [["admin", "管理後台"]] : [])
        ] as [Page, string][]).map(([p, label]) => (
          <button
            key={p}
            onClick={() => setPage(p as Page)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: page === p ? BLUE : "transparent",
              color: page === p ? "#fff" : "#64748b",
              cursor: "pointer", fontSize: 13, fontWeight: 500,
            }}
          >
            {label}
          </button>
        ))}
        </div>

        {/* 登入 / 使用者 移到這裡 */}
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <div 
            onClick={() => setPage("orders")}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: BLUE, color: "#fff",
              display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}>
              {user.username[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: "#1a1a2e", fontWeight: 500 }}>
              {user.username}
            </span>
            <button onClick={logout} style={{
              fontSize: 11, padding: "4px 8px", borderRadius: 6,
              border: "1px solid #e0e7ff", background: "transparent",
              color: "#94a3b8", cursor: "pointer",
            }}>登出</button>
          </div>
        ) : (
          <button onClick={() => setShowAuth(true)} style={{
            marginLeft: 8, padding: "6px 14px", borderRadius: 8,
            background: BLUE, color: "#fff", border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 500,
          }}>登入</button>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        {page === "list" && (
          <EventList onSelect={handleSelectEvent} />
        )}
        {page === "detail" && selectedEventId && (
          <EventDetail
            eventId={selectedEventId}
            onBack={() => setPage("list")}
            onBuy={handleBuy}
          />
        )}
        {page === "admin" && user?.role === "ADMIN" && (
          <AdminDashboard userId={user.id} />
        )}
        {page === "orders" && user && (
          <MyOrders
            userId={user.id}
            username={user.username}
            onBack={() => setPage("list")}
          />
        )}
      </div>

      {/* Waiting Room Modal */}
      {modal === "waiting" && selectedTicket && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.6)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20,
            width: 360, overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{
              background: BLUE, color: "#fff",
              padding: "14px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 600 }}>等候室</span>
              <button onClick={() => setModal(null)} style={{
                border: "none", background: "none",
                color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18,
              }}>✕</button>
            </div>
            <WaitingRoom
              ticketTypeId={selectedTicket.id}
              eventName={selectedTicket.eventName}
              zoneName={selectedTicket.zoneName}
              userId={user?.id || 1}
              onSuccess={handleSuccess}
              onFail={handleFail}
            />
          </div>
        </div>
      )}

      {/* Success Modal */}
      {modal === "success" && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.6)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20,
            width: 320, padding: 28, textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            {!paid ? (
              // 付款倒數畫面
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#dbeafe",
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px", fontSize: 26,
                }}>🎫</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                  恭喜搶到票了！
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                  訂單 #{orderId}，請在時限內完成付款
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 700, color: BLUE, marginBottom: 20,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {fmt(payTimer)}
                </div>
                <button
                  onClick={async () => {
                    await api.payOrder(orderId!);
                    setPaid(true);
                  }}
                  style={{
                    width: "100%", padding: 12, borderRadius: 10,
                    background: BLUE, color: "#fff",
                    border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  立即付款
                </button>
              </>
            ) : (
              // 付款成功畫面
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#d1fae5",
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px", fontSize: 26,
                }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                  付款成功！
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                  訂單 #{orderId} 已確認
                </div>
                <div style={{
                  background: "#f0f4ff", borderRadius: 10,
                  padding: "12px 16px", marginBottom: 20,
                  fontSize: 12, color: "#64748b", textAlign: "left",
                }}>
                  <div style={{ marginBottom: 4 }}>
                    🎫 {selectedTicket?.eventName}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    📍 {selectedTicket?.zoneName}
                  </div>
                  <div style={{ color: BLUE, fontWeight: 500 }}>
                    訂單編號：#{orderId}
                  </div>
                </div>
                <button
                  onClick={() => { setModal(null); setPaid(false); }}
                  style={{
                    width: "100%", padding: 12, borderRadius: 10,
                    background: BLUE, color: "#fff",
                    border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  完成
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showAuth && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => { setShowAuth(false); setPendingBuy(null); }}
        />
      )}

      <ChatBot
        userId={user?.id || 0}
        onNavigateToEvent={(eventId) => {
          setSelectedEventId(eventId);
          setPage("detail");
        }}
      />
    </div>
  );
}
import { useState } from "react";
import { api } from "../api";

const BLUE = "#1B4FD8";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface Props {
  onSuccess: (user: User) => void;
  onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("請填寫所有欄位");
      return;
    }
    if (mode === "register" && !email.trim()) {
      setError("請填寫 Email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = mode === "login"
        ? await api.login(username, password)
        : await api.register(username, email, password);

      onSuccess(resp.data);
    } catch (e: any) {
      setError(e.response?.data?.message || "發生錯誤，請重試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 300,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20,
        width: 360, padding: 28,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>
              {mode === "login" ? "登入" : "建立帳號"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {mode === "login" ? "登入後即可搶票" : "加入 ZZZ Ticket"}
            </div>
          </div>
          <button onClick={onClose} style={{
            border: "none", background: "none",
            cursor: "pointer", color: "#94a3b8", fontSize: 20,
          }}>✕</button>
        </div>

        {/* Tab */}
        <div style={{
          display: "flex", background: "#f0f4ff",
          borderRadius: 10, padding: 3, marginBottom: 20,
        }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "7px", borderRadius: 8, border: "none",
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? BLUE : "#64748b",
              cursor: "pointer", fontSize: 13, fontWeight: 500,
              boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all .15s",
            }}>
              {m === "login" ? "登入" : "註冊"}
            </button>
          ))}
        </div>

        {/* 表單 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>用戶名</div>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="你的用戶名"
              style={{
                width: "100%", padding: "10px 12px",
                borderRadius: 10, border: "1px solid #e0e7ff",
                fontSize: 13, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {mode === "register" && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>Email</div>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                type="email"
                style={{
                  width: "100%", padding: "10px 12px",
                  borderRadius: 10, border: "1px solid #e0e7ff",
                  fontSize: 13, outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>密碼</div>
            <div style={{ position: "relative" }}>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                type={showPw ? "text" : "password"}
                placeholder={mode === "register" ? "至少 6 個字元" : "輸入密碼"}
                style={{
                  width: "100%", padding: "10px 40px 10px 12px",
                  borderRadius: 10, border: "1px solid #e0e7ff",
                  fontSize: 13, outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button onClick={() => setShowPw(!showPw)} style={{
                position: "absolute", right: 10, top: "50%",
                transform: "translateY(-50%)",
                border: "none", background: "none",
                cursor: "pointer", color: "#94a3b8", fontSize: 16,
              }}>
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            {mode === "register" && (
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                🔒 密碼經過加密保護，我們不會知道你的密碼
              </div>
            )}
          </div>

          {error && (
            <div style={{
              background: "#fee2e2", color: "#991b1b",
              padding: "8px 12px", borderRadius: 8, fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{
            width: "100%", padding: "11px",
            borderRadius: 10, border: "none",
            background: loading ? "#e0e7ff" : BLUE,
            color: loading ? "#94a3b8" : "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 4,
          }}>
            {loading ? "處理中..." : mode === "login" ? "登入" : "建立帳號"}
          </button>
        </div>
      </div>
    </div>
  );
}
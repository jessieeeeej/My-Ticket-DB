import { useEffect, useState } from "react";
import { api } from "../api";

interface Props {
  ticketTypeId: number;
  eventName: string;
  zoneName: string;
  userId: number;
  onSuccess: (orderId: number) => void;
  onFail: (msg: string) => void;
}

export default function WaitingRoom({
  ticketTypeId,
  eventName,
  zoneName,
  userId,
  onSuccess,
  onFail,
}: Props) {
  const [position, setPosition] = useState(Math.floor(Math.random() * 10) + 5);
  const [status, setStatus] = useState<"waiting" | "purchasing" | "done">("waiting");
  const [idempotencyKey] = useState( () => `wait-${Date.now()}-${Math.random()}` );

  useEffect(() => {
    const interval = setInterval(() => {
        setPosition(p => {
        if (p <= 1) {
            clearInterval(interval);
            if (status === "waiting") {
            setStatus("purchasing");
            api.purchase({
                userId: userId,
                ticketTypeId,
                quantity: 1,
                idempotencyKey: idempotencyKey,
            })
            .then(r => {
                if (r.data.orderId) onSuccess(r.data.orderId);
                else onFail(r.data.message);
            })
            .catch(() => onFail("搶票失敗，請重試"));
            }
            return 0;
        }
        return Math.max(1, p - Math.floor(Math.random() * 8 + 3));
        });
    }, 800);
    return () => clearInterval(interval);
    }, []); // 空依賴，只跑一次

  const pct = Math.round((1 - position / 250) * 100);

  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16 }}>
        {eventName} — {zoneName}
      </div>
      {status === "waiting" ? (
        <>
          <div
            style={{ fontSize: 56, fontWeight: 600, color: "#1a1a18", marginBottom: 4 }}
          >
            {position}
          </div>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>
            目前排隊位置
          </div>
          <div
            style={{
              height: 6,
              background: "#e8e6df",
              borderRadius: 3,
              overflow: "hidden",
              maxWidth: 280,
              margin: "0 auto 16px",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: "#E24B4A",
                borderRadius: 3,
                transition: "width 0.5s",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#aaa" }}>
            系統每秒放行約 60 人，請勿關閉此頁面
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: "#888" }}>搶票中，請稍候...</div>
      )}
    </div>
  );
}
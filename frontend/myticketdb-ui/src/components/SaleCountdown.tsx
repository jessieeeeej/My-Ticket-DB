import { useEffect, useState } from "react";

const BLUE = "#1B4FD8";

interface Props {
  saleStartTime: string;
  onSaleStart: () => void;
}

export default function SaleCountdown({ saleStartTime, onSaleStart }: Props) {
  const calc = () => {
    const diff = Math.max(0, new Date(saleStartTime).getTime() - Date.now());
    return {
      hours:   Math.floor(diff / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      total:   diff,
    };
  };

  const [time, setTime] = useState(calc());

  useEffect(() => {
    const t = setInterval(() => {
      const next = calc();
      setTime(next);
      if (next.total === 0) {
        clearInterval(t);
        onSaleStart();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [saleStartTime]);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (time.total === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #1e3a8a 0%, #1B4FD8 100%)",
      borderRadius: 12, padding: "16px 20px",
      marginBottom: 16, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div>
        <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>
          🔔 售票倒數
        </div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          開賣時間：{new Date(saleStartTime).toLocaleString("zh-TW")}
        </div>
      </div>

      {/* 倒數數字 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {[
          { val: pad(time.hours),   label: "時" },
          { val: pad(time.minutes), label: "分" },
          { val: pad(time.seconds), label: "秒" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: i < 2 ? 8 : 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "6px 10px",
                fontSize: 22, fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                minWidth: 44, textAlign: "center",
              }}>
                {item.val}
              </div>
              <div style={{ fontSize: 10, opacity: .7, marginTop: 3 }}>
                {item.label}
              </div>
            </div>
            {i < 2 && (
              <div style={{ fontSize: 20, fontWeight: 700, opacity: .6, marginBottom: 14 }}>
                :
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
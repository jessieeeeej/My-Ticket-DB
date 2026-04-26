# AI-Integrated Ticket Booking System


> **A high-concurrency ticket booking system with AI-powered scalper detection and intelligent purchasing assistant.**

---

## 目錄 / Table of Contents

- [專案簡介 / Overview](#overview)
- [系統架構 / Architecture](#architecture)
- [核心技術設計 / Technical Design](#technical-design)
- [AI Agent 設計 / AI Agent](#ai-agent)
- [功能介紹 / Features](#features)
- [快速啟動 / Quick Start](#quick-start)
- [API 文件 / API Docs](#api-docs)
- [壓力測試 / Load Testing](#load-testing)

---

## Overview / 專案簡介

ZZZ Ticket simulates a real-world ticket booking platform focused on solving three key engineering challenges:

ZZZ Ticket 模擬真實演唱會搶票平台，解決三個核心工程挑戰：

| Challenge | Solution |
|-----------|----------|
| **Overselling under high concurrency** | Redis Lua Script atomic stock deduction |
| **Traffic spike on sale start** | Virtual Waiting Room (Redis Sorted Set) |
| **Scalper bots** | AI Agent real-time risk scoring |

---

## Architecture / 系統架構

### Service Overview 服務概覽

```
┌─────────────────────────────────────────────────────────┐
│                     User / 使用者                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              React Frontend (Port 3000)                  │
│         活動列表 │ 搶票頁面 │ 管理後台 │ AI 助手          │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
                      ▼
┌─────────────────────────────────────────────────────────┐
│           C# ASP.NET Core Backend (Port 5163)            │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Ticketing  │  │    Admin     │  │      Auth      │  │
│  │  Controller │  │  Controller  │  │   Controller   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────┘  │
│         │                │                               │
│  ┌──────▼──────┐  ┌──────▼───────┐                      │
│  │  Ticketing  │  │  RiskCheck   │                      │
│  │   Service   │  │   Service    │                      │
│  └──────┬──────┘  └──────┬───────┘                      │
└─────────┼────────────────┼────────────────────────────┘
          │                │ HTTP
          ▼                ▼
┌─────────────┐   ┌──────────────────────────────────────┐
│    Redis     │   │    Python FastAPI (Port 8000)         │
│             │   │                                        │
│ • 票量庫存   │   │  ┌──────────────┐ ┌────────────────┐  │
│ • 等候佇列   │   │  │ Risk Scoring │ │  Chat Agent    │  │
│ • 請求計數   │   │  │  黃牛偵測    │ │  購票助手      │  │
└──────┬──────┘   │  └──────────────┘ └────────────────┘  │
       │          └──────────────────────────────────────┘
       ▼                      │ LLM API
┌─────────────┐               ▼
│    MySQL     │      ┌──────────────┐
│             │      │  Groq API    │
│ • Events    │      │ (LLaMA 3.3)  │
│ • Orders    │      └──────────────┘
│ • Users     │
│ • Blacklist │
└─────────────┘
```

### Request Flow 搶票請求流程

```
用戶點擊搶票
      │
      ▼
┌─────────────────┐
│  進入虛擬等候室  │  Redis ZADD waiting_room:{eventId}
│ Virtual Waiting │  按 timestamp 排隊
│      Room       │
└────────┬────────┘
         │ 系統放行
         ▼
┌─────────────────┐
│  AI 黃牛風險評分 │  Rule Engine → LLM 分析
│  Risk Scoring   │  回傳 score 0-100
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
score<70   score≥70
    │         │
    ▼     ┌───┴───┐
  放行   70-89  ≥90
         │       │
       審核     封鎖
      佇列     黑名單
         │
         ▼
┌─────────────────┐
│  Redis Lua Script│  原子操作：查庫存 + 扣減
│   原子扣票       │  防止超賣的核心機制
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   成功      失敗
    │         │
    ▼         ▼
建立訂單    售罄通知
(MySQL)
    │
    ▼
WebSocket 推送結果
```

---

## Technical Design / 核心技術設計

### 1. 防超賣：Redis Lua Script

The core challenge of ticket booking is preventing overselling when thousands of users buy simultaneously.

高併發下防超賣的核心是「查庫存」和「扣減」必須是不可分割的原子操作。

**為什麼不用資料庫行鎖？**

| 方案 | 優點 | 缺點 |
|------|------|------|
| DB 行鎖 `SELECT FOR UPDATE` | 實作簡單 | 高併發下鎖競爭嚴重，連線池會打爆 |
| 樂觀鎖（version 欄位） | 無鎖讀取 | 熱門票重試風暴，實際吞吐更差 |
| **Redis Lua Script（採用）** | 記憶體操作 < 1ms，天然原子 | 需要 Redis 高可用 |

**Lua Script 核心邏輯：**

```lua
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil then return -1 end       -- 票種不存在
if stock < tonumber(ARGV[1]) then return 0 end  -- 庫存不足
redis.call('DECRBY', KEYS[1], ARGV[1])
return 1  -- 扣票成功
```

Redis 單執行緒 + Lua 原子性 = 完全消除競態條件。

---

### 2. 流量削峰：虛擬等候室

開賣瞬間不讓所有流量直打後端，改用 Redis Sorted Set 管理排隊。

```
開賣瞬間 10,000 人湧入
         │
         ▼
   Redis Sorted Set
   waiting_room:{eventId}
   score = timestamp（先到先得）
         │
   每秒放行 60 人
   ZPOPMIN 取前 60 名
         │
         ▼
   後端每秒只處理 60 個請求
   永遠不會被打垮
```

前端透過 WebSocket 即時更新排隊位置，用戶體驗不中斷。

---

### 3. 冪等性設計

用戶網路斷掉重送請求，不會買到兩張票。

每個搶票請求帶一個 UUID `idempotencyKey`，`Orders` 表對此欄位加 Unique Index。重複的 key 直接回傳第一次的訂單結果，不重複執行。

```
第一次請求 (key=abc-123) → 建立訂單 #42 → 回傳 orderId: 42
第二次請求 (key=abc-123) → 偵測到重複 → 回傳 orderId: 42（不重複建立）
```

---

### 4. 資料庫設計

```
Events ──< TicketTypes ──< Orders >── Users
                                        │
                              Blacklists（黑名單）
                              AuditQueues（審核佇列）
```

**索引設計：**
- `Orders.IdempotencyKey` — Unique Index，冪等性保護
- `Orders.UserId` — Index，查詢用戶訂單
- `Orders.TicketTypeId` — Index，查詢票種訂單

---

## AI Agent / AI Agent 設計

### Agent 1：黃牛偵測

```
搶票請求
    │
    ▼
Rule Engine（快速判斷，不打 LLM）
    ├── requestsPerMinute > 10 → BLOCK (score=95)
    ├── accountAgeDays < 1    → BLOCK (score=90)
    └── ticketCount > 4       → BLOCK (score=85)
    │
    │ 灰色地帶
    ▼
LLM 分析（Groq LLaMA 3.3）
    分析：IP、User Agent、請求頻率、帳號年齡
    回傳：{ score: 0-100, reason: "...", action: "PASS/REVIEW/BLOCK" }
    │
    ├── score < 70  → PASS，正常搶票
    ├── score 70-89 → REVIEW，記錄審核佇列，仍放行
    └── score ≥ 90  → BLOCK，寫入黑名單，回傳 403
```

Rule Engine 處理明顯案例（速度快），LLM 處理灰色地帶（準確度高）。兩層設計兼顧效能與準確性。

---

### Agent 2：智慧購票助手

支援自然語言查詢，用戶輸入「幫我找 BLACKPINK 的票」，系統自動搜尋並顯示場次卡片。

```
用戶輸入
    │
    ▼
熱門關鍵字偵測（熱門/推薦/所有）
    │ 沒有
    ▼
縮寫對應（BP→BLACKPINK / SKZ→Stray Kids）
    │ 沒有
    ▼
LLM 抽取藝人名稱
    │
    ▼
查詢後端 API（/api/events）
    │
    ├── 找到 → 顯示場次卡片，點擊跳轉購票頁
    └── 找不到 → LLM 生成友善回應
```

---

## Features / 功能介紹

### 用戶端
- 🎫 **活動瀏覽** — 依時間排序，顯示售票狀態、倒數開售時間
- 🏃 **虛擬等候室** — 即時顯示排隊位置，自動搶票
- 💳 **訂單管理** — 查看個人所有訂單及付款狀態
- 🤖 **AI 購票助手** — 自然語言查詢場次，一鍵跳轉購票

### 管理端（需 ADMIN 權限）
- 📊 **系統總覽** — 即時 KPI、售票進度、訂單狀態分佈
- 🎫 **訂單管理** — 分頁查詢、狀態篩選
- 📦 **庫存管理** — DB 庫存與 Redis 庫存並排顯示，可手動調整
- 🔍 **AI 審核佇列** — 查看可疑請求，一鍵放行或封鎖
- 🚫 **黑名單管理** — 查看被封鎖帳號

---

## Quick Start / 快速啟動

### Prerequisites 環境需求

- .NET 9 SDK
- Node.js 18+
- Python 3.11+
- Docker Desktop

### 1. Clone & Setup

```bash
git clone https://github.com/jessieeeeej/My-Ticket-DB.git
cd My-Ticket-DB
```

### 2. 設定環境變數

在 `ai-agent/` 建立 `.env`：

```env
GROQ_API_KEY=your_groq_api_key_here
BACKEND_URL=http://localhost:5163
```

> 去 [console.groq.com](https://console.groq.com) 免費申請 API Key

### 3. 啟動服務

**Terminal 1 — 資料庫 & Redis**
```bash
docker-compose up -d db redis
```

**Terminal 2 — 後端**
```bash
cd backend/myticketdb.API
dotnet run
```

**Terminal 3 — AI Agent**
```bash
cd ai-agent
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 4 — 前端**
```bash
cd frontend/myticketdb-ui
npm install
npm start
```

### 4. 開啟網頁

| 服務 | 網址 |
|------|------|
| 前端 | http://localhost:3000 |
| 後端 API | http://localhost:5163/swagger |
| AI Agent | http://localhost:8000/docs |

### 預設帳號

| 帳號 | 密碼 | 權限 |
|------|------|------|
| testuser | testuser123 | ADMIN（可看管理後台）|
| jessie | jessie123 | USER |

---

## API Docs / API 文件

後端啟動後，完整 API 文件在 Swagger UI：`http://localhost:5163/swagger`

### 核心 API

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/api/auth/register` | 用戶註冊 |
| POST | `/api/auth/login` | 用戶登入 |
| GET | `/api/events` | 取得所有活動 |
| POST | `/api/ticketing/purchase` | 搶票（含 AI 風險評分）|
| POST | `/api/ticketing/pay/{orderId}` | 付款確認 |
| GET | `/api/ticketing/stock/{ticketTypeId}` | 查詢 Redis 即時庫存 |
| GET | `/api/admin/dashboard` | 管理後台總覽（ADMIN）|
| GET | `/api/admin/audit-queue` | AI 審核佇列（ADMIN）|
| GET | `/api/admin/inventory` | 庫存管理（ADMIN）|

---

## Load Testing / 壓力測試

### 黃牛模擬腳本

```bash
cd ai-agent
python simulate_scalper.py
```

模擬 15 次高頻搶票請求，觀察 AI 黃牛偵測的封鎖效果：

```
🤖 開始模擬黃牛攻擊 (userId=999, 嘗試 15 次)

  [01] ✅ 成功 | 訂單#1 | 風險分數: 45
  [02] ✅ 成功 | 訂單#2 | 風險分數: 52
  ...
  [11] 🚫 封鎖 | 偵測到異常行為，已封鎖 | 每分鐘請求超過10次
  [12] 🚫 封鎖 | 此帳號已被封鎖
  ...

📊 結果統計：
  成功搶票：10 次
  被封鎖：5 次
```

---

## Tech Stack / 技術棧

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript | UI 介面 |
| Backend | C# ASP.NET Core 9 | REST API、業務邏輯 |
| Cache | Redis 7 | 等候室、原子庫存、請求計數 |
| Database | MySQL 8 | 持久化資料 |
| AI Agent | Python FastAPI | 黃牛偵測、購票助手 |
| LLM | Groq (LLaMA 3.3 70B) | 風險分析、自然語言處理 |
| Auth | BCrypt | 密碼雜湊保護 |
| Container | Docker Compose | 服務編排 |

---

## Design Decisions / 技術決策

### 為什麼選 Redis Lua Script 而不是 DB 鎖？

高併發下 DB 行鎖會造成嚴重的鎖競爭，連線池容易打爆。Redis 單執行緒配合 Lua Script 的原子性，讓扣票操作在記憶體完成（< 1ms），DB 只做最終落地，完全避開鎖競爭問題。

### 為什麼 AI 黃牛偵測用兩層設計？

Rule Engine 處理明顯異常（速度快，不需要打 LLM API），LLM 只處理灰色地帶（準確度高）。這樣在高流量下不會因為 LLM API 的延遲拖慢主流程。

### 為什麼密碼用 BCrypt？

BCrypt 是業界標準的密碼雜湊演算法，帶有 salt 機制防止彩虹表攻擊，資料庫只儲存雜湊值，就算資料庫洩漏也無法還原原始密碼。

---

*[GitHub](https://github.com/jessieeeeej)*
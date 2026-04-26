from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ───────────────────────────────────────────
# 1. 黃牛偵測
# ───────────────────────────────────────────

class RiskRequest(BaseModel):
    userId: int
    ip: str
    userAgent: str
    requestsPerMinute: int
    accountAgeDays: int
    ticketCount: int

class RiskResponse(BaseModel):
    score: int
    reason: str
    action: str  # PASS / REVIEW / BLOCK

@app.post("/agent/risk-score", response_model=RiskResponse)
def risk_score(req: RiskRequest):
    # Rule Engine 先過一層（快速判斷，不用打 LLM）
    if req.requestsPerMinute > 10:
        return RiskResponse(score=95, reason="每分鐘請求超過10次，疑似機器人", action="BLOCK")
    if req.accountAgeDays < 1:
        return RiskResponse(score=90, reason="帳號建立不到1天", action="BLOCK")
    if req.ticketCount > 4:
        return RiskResponse(score=85, reason="單帳號購票數量異常", action="BLOCK")

    # 灰色地帶才打 LLM
    prompt = f"""
你是一個演唱會搶票系統的黃牛偵測 AI。根據以下用戶行為特徵，評估是否為黃牛或機器人。

特徵：
- 用戶ID：{req.userId}
- IP：{req.ip}
- User Agent：{req.userAgent}
- 每分鐘請求數：{req.requestsPerMinute}
- 帳號年齡（天）：{req.accountAgeDays}
- 已購票數：{req.ticketCount}

請回傳 JSON 格式（只回 JSON，不要其他文字）：
{{"score": 0到100的風險分數, "reason": "原因說明", "action": "PASS或REVIEW或BLOCK"}}

評分標準：
- 0-69：PASS（正常用戶）
- 70-89：REVIEW（需人工審核）
- 90-100：BLOCK（直接封鎖）
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )

    import json
    text = response.choices[0].message.content.strip()
    # 清理可能的 markdown 格式
    text = text.replace("```json", "").replace("```", "").strip()
    data = json.loads(text)

    return RiskResponse(
        score=data["score"],
        reason=data["reason"],
        action=data["action"]
    )


# ───────────────────────────────────────────
# 2. 智慧購票助手
# ───────────────────────────────────────────

import httpx

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    userId: int
    message: str
    history: list[ChatMessage] = []

BACKEND = os.getenv("BACKEND_URL", "http://localhost:5163")

SYSTEM_PROMPT = """你是 ZZZ Ticket 的智慧購票助手。

重要規則：
1. 絕對不要自己編造場次、日期、場地或任何票務資訊
2. 絕對不要說「系統自動顯示」或類似的佔位文字
3. 場次卡片會由系統直接顯示，你只需要說一句引導語
4. 如果用戶問熱門場次，只說「好的，讓我查詢一下」
5. 回應要簡短，一到兩句話就好，不要冗長的說明

可用工具：
[TOOL: search_events: {"artist": "藝人名稱"}] - 搜尋場次
[TOOL: purchase_ticket: {"ticketTypeId": 123}] - 購票

回應用繁體中文，語氣親切簡潔。"""

@app.post("/agent/chat")
async def chat(req: ChatRequest):
    import re, json

    result = {"reply": "", "tool_result": None}

    # ── Step 1: 熱門場次直接攔截 ──
    if any(k in req.message for k in ["熱門", "推薦", "有什麼", "最近", "所有", "全部"]):
        all_events = await search_events({"artist": ""})
        if all_events:
            result["tool_result"] = {"type": "events", "data": all_events}
            result["reply"] = "以下是目前所有場次："
        else:
            result["reply"] = "目前沒有任何場次資訊。"
        return result

    # ── Step 2: 縮寫/別名直接攔截 ──
    artist_map = {
        "BP": "BLACKPINK",
        "Black Pink": "BLACKPINK",
        "Blackpink": "BLACKPINK",
        "twice": "TWICE",
        "bts": "BTS",
        "SKZ": "Stray Kids",
        "taylor": "Taylor Swift",
    }
    shortcut = next((v for k, v in artist_map.items() if k in req.message), None)
    if shortcut:
        events = await search_events({"artist": shortcut})
        if events:
            result["tool_result"] = {"type": "events", "data": events}
            result["reply"] = f"找到 {shortcut} 的場次："
        else:
            result["reply"] = f"目前沒有 {shortcut} 的相關場次，請追蹤官方消息。"
        return result

    # ── Step 3: LLM 抽取藝人名稱 ──
    extract_response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user",
            "content": f"從這句話中抽取藝人或演唱會名稱，只回傳名稱本身，沒有就回傳 NONE：「{req.message}」"
        }],
        temperature=0,
    )
    extracted = extract_response.choices[0].message.content.strip()
    print(f"[DEBUG] extracted='{extracted}'")

    if extracted != "NONE" and extracted:
        events = await search_events({"artist": extracted})
        if events:
            result["tool_result"] = {"type": "events", "data": events}
            result["reply"] = f"找到 {extracted} 的場次："
        else:
            result["reply"] = f"目前沒有 {extracted} 的相關場次，請追蹤官方消息。"
        return result

    # ── Step 4: 一般對話交給 LLM ──
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in req.history:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.7,
    )
    result["reply"] = response.choices[0].message.content.strip()
    return result

async def search_events(params: dict):
    async with httpx.AsyncClient() as client_http:
        resp = await client_http.get(f"{BACKEND}/api/events")
        events = resp.json()

    artist = params.get("artist", "")
    price_max = params.get("price_max", 999999)

    filtered = []
    for e in events:
        if artist and artist not in e["name"]:
            continue
        for tt in e.get("ticketTypes", []):
            if tt["price"] <= price_max:  # 移除 remainingQty > 0 的限制
                filtered.append({
                    "eventId": e["id"],
                    "eventName": e["name"],
                    "venue": e["venue"],
                    "eventDate": e["eventDate"],
                    "ticketTypeId": tt["id"],
                    "zoneName": tt["zoneName"],
                    "price": tt["price"],
                    "remaining": tt["remainingQty"],
                    "soldOut": tt["remainingQty"] == 0
                })
    return filtered


async def purchase_ticket(params: dict, userId: int):
    import uuid
    async with httpx.AsyncClient() as client_http:
        resp = await client_http.post(
            f"{BACKEND}/api/ticketing/purchase",
            json={
                "userId": userId,
                "ticketTypeId": params["ticketTypeId"],
                "quantity": 1,
                "idempotencyKey": str(uuid.uuid4())
            }
        )
        return resp.json()


@app.get("/health")
def health():
    return {"status": "ok"}
import requests
import uuid
import time

BASE = "http://localhost:5163/api"

def simulate_scalper(user_id: int, ticket_type_id: int, count: int = 15):
    """模擬黃牛：短時間內大量搶票"""
    print(f"\n🤖 開始模擬黃牛攻擊 (userId={user_id}, 嘗試 {count} 次)\n")
    
    success = 0
    blocked = 0
    review = 0
    
    for i in range(count):
        resp = requests.post(f"{BASE}/ticketing/purchase", json={
            "userId": user_id,
            "ticketTypeId": ticket_type_id,
            "quantity": 1,
            "idempotencyKey": str(uuid.uuid4())  # 每次不同 key
        })
        
        status = resp.status_code
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
        data = resp.json()
        
        if status == 200:
            success += 1
            risk = data.get("riskScore", 0)
            print(f"  [{i+1:02d}] ✅ 成功 | 訂單#{data.get('orderId')} | 風險分數: {risk}")
        elif status == 403:
            blocked += 1
            print(f"  [{i+1:02d}] 🚫 封鎖 | {data.get('message')} | {data.get('reason', '')}")
        else:
            print(f"  [{i+1:02d}] ❌ 失敗 | {data.get('message')}")
        
        time.sleep(0.1)  # 100ms 間隔，模擬機器人速度
    
    print(f"\n📊 結果統計：")
    print(f"  成功搶票：{success} 次")
    print(f"  被封鎖：{blocked} 次")
    print(f"  總計：{count} 次")

def simulate_normal_user(user_id: int, ticket_type_id: int):
    """模擬正常用戶：只搶一張"""
    print(f"\n👤 模擬正常用戶 (userId={user_id})\n")
    
    resp = requests.post(f"{BASE}/ticketing/purchase", json={
        "userId": user_id,
        "ticketTypeId": ticket_type_id,
        "quantity": 1,
        "idempotencyKey": str(uuid.uuid4())
    })
    
    data = resp.json()
    if resp.status_code == 200:
        print(f"  ✅ 搶票成功 | 訂單#{data.get('orderId')} | 風險分數: {data.get('riskScore')}")
    else:
        print(f"  ❌ 失敗 | {data.get('message')}")

if __name__ == "__main__":
    print("=" * 50)
    print("ZZZ Ticket 黃牛偵測模擬測試")
    print("=" * 50)
    
    # 模擬黃牛（userId=1, TWICE 搖滾區 ticketTypeId=6）
    simulate_scalper(user_id=2, ticket_type_id=6, count=15)
    
    print("\n" + "=" * 50)
    
    # 模擬正常用戶（userId=2）
    simulate_normal_user(user_id=2, ticket_type_id=6)
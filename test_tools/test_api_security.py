"""
測試 API 安全機制
"""
import requests
import time
import hmac
import hashlib
import random
import string

BASE_URL = "http://localhost:8000"

def generate_nonce():
    """生成隨機 nonce"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=16))

def generate_signature(path: str, timestamp: str, nonce: str, key: str) -> str:
    """生成請求簽名"""
    message = f"{path}:{timestamp}:{nonce}"
    signature = hmac.new(
        key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

def test_without_signature():
    """測試沒有簽名的請求"""
    print("\n=== 測試 1: 無簽名請求 ===")
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer fake_token"}
        )
        print(f"狀態碼: {response.status_code}")
        if response.status_code == 401:
            print("✓ 正確拒絕了無簽名的請求")
        else:
            print("✗ 錯誤：應該拒絕無簽名的請求")
    except Exception as e:
        print(f"請求錯誤: {e}")

def test_invalid_signature():
    """測試錯誤的簽名"""
    print("\n=== 測試 2: 錯誤簽名 ===")
    try:
        timestamp = str(int(time.time()))
        nonce = generate_nonce()
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={
                "Authorization": "Bearer fake_token",
                "X-Request-Signature": "invalid_signature",
                "X-Request-Timestamp": timestamp,
                "X-Request-Nonce": nonce
            }
        )
        print(f"狀態碼: {response.status_code}")
        if response.status_code == 401:
            print("✓ 正確拒絕了錯誤簽名")
        else:
            print("✗ 錯誤：應該拒絕錯誤簽名")
    except Exception as e:
        print(f"請求錯誤: {e}")

def test_expired_timestamp():
    """測試過期的時間戳"""
    print("\n=== 測試 3: 過期時間戳 ===")
    try:
        # 使用 10 分鐘前的時間戳
        timestamp = str(int(time.time()) - 600)
        nonce = generate_nonce()
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={
                "Authorization": "Bearer fake_token",
                "X-Request-Signature": "fake_signature",
                "X-Request-Timestamp": timestamp,
                "X-Request-Nonce": nonce
            }
        )
        print(f"狀態碼: {response.status_code}")
        if response.status_code == 401:
            print("✓ 正確拒絕了過期的時間戳")
        else:
            print("✗ 錯誤：應該拒絕過期的時間戳")
    except Exception as e:
        print(f"請求錯誤: {e}")

def test_redirect_attack():
    """測試重定向攻擊防護"""
    print("\n=== 測試 4: 重定向攻擊防護 ===")
    try:
        # 不允許自動跟隨重定向
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            allow_redirects=False,
            headers={"Authorization": "Bearer fake_token"}
        )
        
        if 300 <= response.status_code < 400:
            print(f"狀態碼: {response.status_code}")
            print("✗ 警告：檢測到重定向響應")
        else:
            print(f"狀態碼: {response.status_code}")
            print("✓ 沒有重定向")
    except Exception as e:
        print(f"請求錯誤: {e}")

def test_cors_origin():
    """測試 CORS 來源檢查"""
    print("\n=== 測試 5: CORS 來源檢查 ===")
    try:
        # 來自未授權的來源
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={
                "Origin": "http://malicious-site.com",
                "Authorization": "Bearer fake_token"
            }
        )
        print(f"狀態碼: {response.status_code}")
        if response.status_code == 403:
            print("✓ 正確拒絕了未授權來源")
        else:
            print("⚠ 注意：可能允許了未授權來源（需要檢查中間件配置）")
    except Exception as e:
        print(f"請求錯誤: {e}")

def test_valid_request_flow():
    """測試完整的有效請求流程"""
    print("\n=== 測試 6: 完整有效請求流程 ===")
    print("1. 獲取客戶端配置...")
    
    try:
        # 1. 獲取簽名密鑰
        config_response = requests.get(f"{BASE_URL}/api/auth/client-config")
        if config_response.status_code == 200:
            config = config_response.json()
            signature_key = config.get('signature_key', '')
            print(f"✓ 成功獲取配置")
            
            # 2. 嘗試登入（不需要簽名）
            print("\n2. 測試登入（不需要簽名）...")
            login_response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": "test", "password": "test123"}
            )
            print(f"登入響應: {login_response.status_code}")
            
            if login_response.status_code == 200:
                token = login_response.json().get('access_token')
                print("✓ 登入成功")
                
                # 3. 使用簽名訪問受保護端點
                print("\n3. 使用簽名訪問受保護端點...")
                timestamp = str(int(time.time()))
                nonce = generate_nonce()
                path = "/api/auth/me"
                signature = generate_signature(path, timestamp, nonce, signature_key)
                
                me_response = requests.get(
                    f"{BASE_URL}{path}",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-Request-Signature": signature,
                        "X-Request-Timestamp": timestamp,
                        "X-Request-Nonce": nonce
                    }
                )
                print(f"狀態碼: {me_response.status_code}")
                if me_response.status_code == 200:
                    print("✓ 有效簽名請求成功")
                    print(f"用戶信息: {me_response.json()}")
                else:
                    print(f"✗ 請求失敗: {me_response.text}")
            else:
                print("⚠ 登入失敗（可能用戶不存在）")
        else:
            print(f"✗ 獲取配置失敗: {config_response.status_code}")
    except Exception as e:
        print(f"測試錯誤: {e}")

def main():
    """運行所有測試"""
    print("=" * 60)
    print("API 安全機制測試")
    print("=" * 60)
    print(f"\n目標服務器: {BASE_URL}")
    print("\n注意：某些測試預期會失敗（這是正確的行為）")
    
    # 測試基本安全機制
    test_without_signature()
    test_invalid_signature()
    test_expired_timestamp()
    test_redirect_attack()
    test_cors_origin()
    
    # 測試完整流程
    test_valid_request_flow()
    
    print("\n" + "=" * 60)
    print("測試完成")
    print("=" * 60)
    print("\n總結：")
    print("- 如果看到 ✓ 表示安全機制正常工作")
    print("- 如果看到 ✗ 表示可能存在安全問題")
    print("- 如果看到 ⚠ 表示需要進一步檢查")

if __name__ == "__main__":
    main()

import asyncio
import websockets
import json
import urllib.request
import urllib.parse

async def get_devtools_value(page_id, expression):
    uri = f"ws://localhost:9222/devtools/page/{page_id}"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": expression}
        }))
        while True:
            res = await websocket.recv()
            data = json.loads(res)
            if data.get("id") == 1:
                result = data.get("result", {}).get("result", {})
                return result.get("value")

async def main():
    # 1. Get API Auth Key from Vibe-Trading page
    vt_page_id = "7BD6D43483A6CEC8AC622FB3A9ACACB4"
    auth_key = await get_devtools_value(vt_page_id, "localStorage.getItem('vibe_trading_api_auth_key')")
    print("Retrieved API Auth Key:", auth_key)

    # 2. Get Tonghuashun cookie from THS page
    ths_page_id = "7961C36BD7CCC6B0302A95D4D6298D49"
    cookie = await get_devtools_value(ths_page_id, "document.cookie")
    if not cookie:
        print("Failed to retrieve Tonghuashun cookie")
        return
    print("Retrieved Tonghuashun cookie successfully.")

    # 3. Formulate headers
    headers = {
        "Content-Type": "application/json"
    }
    if auth_key:
        headers["Authorization"] = f"Bearer {auth_key}"

    # 4. Test connection via API (wait for server to be up)
    import time
    for attempt in range(5):
        test_url = "http://127.0.0.1:9888/settings/ths/test"
        test_body = json.dumps({"cookie": cookie}).encode('utf-8')
        req_test = urllib.request.Request(test_url, data=test_body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req_test, timeout=15) as resp:
                res_json = json.loads(resp.read().decode('utf-8'))
                print("Test connection result:", res_json)
                if res_json.get("success"):
                    break
                else:
                    print(f"Test returned failure: {res_json.get('message')}")
                    return
        except Exception as e:
            print(f"Attempt {attempt+1}/5 failed: {e}")
            time.sleep(2)
            continue
    else:
        print("All attempts to test connection failed. Aborting.")
        return

    # 5. Save cookie via API
    save_url = "http://127.0.0.1:9888/settings/data-sources"
    save_body = json.dumps({
        "ths_cookie": cookie,
        "clear_ths_cookie": False
    }).encode('utf-8')
    req_save = urllib.request.Request(save_url, data=save_body, headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(req_save, timeout=15) as resp:
            res_json = json.loads(resp.read().decode('utf-8'))
            print("Save settings: Success!")
    except Exception as e:
        print("API request to save cookie failed:", e)
        return

    print("\n✅ Cookie saved successfully! The THS sync is now configured.")

asyncio.run(main())

from typing import Any, Dict, Optional
import httpx
import logging
import asyncio
import base64
import random
import time
import uuid
from pathlib import Path
from src.platforms.base import BasePlatformAdapter, IncomingMessage

logger = logging.getLogger(__name__)

class WechatAdapter(BasePlatformAdapter):
    """WeChat platform adapter supporting Official iLink personal WeChat Bot."""

    def __init__(
        self,
        channel_id: str,
        name: str,
        # iLink settings
        ilink_bot_token: str = "",
        ilink_base_url: str = "",
        ilink_bot_id: str = "",
        ilink_user_id: str = "",
        tenant_id: str = "default",
    ) -> None:
        self.tenant_id = tenant_id
        self._channel_id = channel_id
        self._name = name
        self._mode = "ilink"
        self._ilink_bot_token = ilink_bot_token.strip()
        self._ilink_base_url = ilink_base_url.strip()
        self._ilink_bot_id = ilink_bot_id.strip()
        self._ilink_user_id = ilink_user_id.strip()
        self._manager = None
        self._poll_task = None
        self._ilink_sync_buf = self._load_sync_buf()
        self._last_context_tokens = {}
        self._closed = False

    @property
    def platform_name(self) -> str:
        return f"wechat_{self.tenant_id}_{self._channel_id}"

    @property
    def display_name(self) -> str:
        return self._name

    async def initialize(self, manager: Any) -> None:
        self._manager = manager
        logger.warning(f"[WeChat] Adapter '{self._name}' initialized (Tenant: {self.tenant_id})")
        if self._ilink_bot_token and self._ilink_base_url:
            self._poll_task = asyncio.create_task(self._poll_loop())
            logger.warning(f"[WeChat iLink] Background poller spawned for channel '{self._name}'")
        else:
            logger.warning(f"[WeChat iLink] Adapter '{self._name}' is unconfigured (missing token/baseurl). Poller not started.")

    def _load_sync_buf(self) -> str:
        path = Path.home() / ".vibe-trading" / "sync" / f"wechat_sync_{self.tenant_id}_{self._channel_id}.txt"
        if path.exists():
            try:
                return path.read_text(encoding="utf-8").strip()
            except Exception as e:
                logger.warning(f"[WeChat iLink] Failed to load sync buffer: {e}")
        return ""

    def _save_sync_buf(self, buf: str) -> None:
        path = Path.home() / ".vibe-trading" / "sync" / f"wechat_sync_{self.tenant_id}_{self._channel_id}.txt"
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(buf, encoding="utf-8")
        except Exception as e:
            logger.warning(f"[WeChat iLink] Failed to save sync buffer: {e}")

    def _generate_uin_headers(self) -> dict:
        uin_str = str(random.randint(0, 4294967295))
        x_wechat_uin = base64.b64encode(uin_str.encode()).decode()
        return {
            "Content-Type": "application/json",
            "AuthorizationType": "ilink_bot_token",
            "X-WECHAT-UIN": x_wechat_uin,
            "iLink-App-Id": "",
            "iLink-App-ClientVersion": "0",
            "Authorization": f"Bearer {self._ilink_bot_token}",
        }

    async def _poll_loop(self) -> None:
        """Background poller to pull incoming messages from iLink Gateway."""
        base_url = self._ilink_base_url.rstrip("/")
        
        # 1. Notify Gateway of online state
        headers = self._generate_uin_headers()
        base_info = {
            "channel_version": "1.0.0",
            "bot_agent": "Vibe-Trading"
        }
        
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                res = await client.post(
                    f"{base_url}/ilink/bot/msg/notifystart",
                    json={"base_info": base_info},
                    headers=headers,
                )
                logger.debug(f"[WeChat iLink] notifystart responded: {res.status_code}")
            except Exception as e:
                import traceback
                logger.warning(f"[WeChat iLink] notifystart failed: {type(e).__name__}: {e}\n{traceback.format_exc()}")

        # 2. Main polling loop
        while not self._closed:
            try:
                headers = self._generate_uin_headers()
                payload = {
                    "get_updates_buf": self._ilink_sync_buf,
                    "base_info": base_info,
                }
                async with httpx.AsyncClient(timeout=50) as client:
                    res = await client.post(
                        f"{base_url}/ilink/bot/getupdates",
                        json=payload,
                        headers=headers,
                    )
                    res.raise_for_status()
                    data = res.json()
                # Update buffer
                new_buf = data.get("get_updates_buf", "")
                if new_buf and new_buf != self._ilink_sync_buf:
                    self._ilink_sync_buf = new_buf
                    self._save_sync_buf(new_buf)
                
                # Process messages
                msgs = data.get("msgs", [])
                if msgs:
                    logger.warning(f"[WeChat iLink Poller] Received {len(msgs)} message(s) from getupdates")
                for msg in msgs:
                    logger.warning(f"[WeChat iLink Poller] Raw message payload: {msg}")
                    from_user = msg.get("from_user_id")
                    ctx_token = msg.get("context_token")
                    
                    if ctx_token and from_user:
                        self._last_context_tokens[from_user] = ctx_token
                        
                    items = msg.get("item_list", [])
                    for item in items:
                        t_val = item.get("type")
                        is_text = (t_val == 1 or t_val == "text")
                        
                        if is_text:
                            content = ""
                            if "text_item" in item:
                                content = item.get("text_item", {}).get("text", "")
                            elif "text" in item:
                                text_val = item.get("text", {})
                                if isinstance(text_val, dict):
                                    content = text_val.get("content", "")
                                else:
                                    content = text_val
                            
                            content = content.strip()
                            if not content:
                                continue
                                
                            message_id = f"ilink_{uuid.uuid4().hex}"
                            incoming = IncomingMessage(
                                platform=self.platform_name,
                                chat_id=from_user,
                                message_id=message_id,
                                content=content,
                                sender_id=from_user,
                                timestamp=time.time(),
                                raw_payload=msg
                            )
                            if self._manager:
                                logger.warning(f"[WeChat iLink] Submitting incoming message from {from_user}: {content[:50]}")
                                self._manager.submit_incoming_message(incoming)
            except Exception as e:
                if not self._closed:
                    logger.error(f"[WeChat iLink Poller] Error polling updates: {e}")
                    await asyncio.sleep(5)
            # Sleep brief moment to avoid tight loop on instant timeout/returns
            await asyncio.sleep(0.5)

    async def send_message(
        self,
        chat_id: str,
        content: str,
        title: Optional[str] = None,
    ) -> str:
        """Send message to WeChat.
        
        Pushes message directly to WeChat iLink gateway.
        """
        # iLink Mode
        base_url = self._ilink_base_url.rstrip("/")
        headers = self._generate_uin_headers()
        formatted_content = f"{title}\n\n{content}" if title else content
        
        ctx_token = self._last_context_tokens.get(chat_id, "")
        
        payload = {
            "msg": {
                "from_user_id": "",
                "to_user_id": chat_id,
                "client_id": f"client_{uuid.uuid4().hex}",
                "message_type": 2,
                "message_state": 2,
                "item_list": [
                    {
                        "type": 1,
                        "text_item": {
                            "text": formatted_content
                        }
                    }
                ]
            },
            "base_info": {
                "channel_version": "1.0.0"
            }
        }
        if ctx_token:
            payload["msg"]["context_token"] = ctx_token
            
        logger.warning(f"[WeChat iLink] Sending message payload: {payload}")
        for attempt in range(1, 4):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    res = await client.post(
                        f"{base_url}/ilink/bot/sendmessage",
                        json=payload,
                        headers=headers,
                    )
                    res.raise_for_status()
                    logger.warning(f"[WeChat iLink] Message sent successfully to {chat_id} (attempt {attempt})")
                    return f"ilink_msg_{uuid.uuid4().hex}"
            except Exception as e:
                logger.warning(f"[WeChat iLink] Attempt {attempt} failed to send message: {type(e).__name__}: {e}")
                if attempt == 3:
                    import traceback
                    logger.error(f"[WeChat iLink] All attempts failed to send message: {traceback.format_exc()}")
                    raise
                await asyncio.sleep(1)

    async def update_message(
        self,
        chat_id: str,
        message_id: str,
        content: str,
        title: Optional[str] = None,
    ) -> None:
        """WeChat messages cannot be edited after they are sent."""
        pass

    async def close(self) -> None:
        self._closed = True
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            logger.info(f"[WeChat iLink] Poller task cancelled.")
            
        if self._ilink_bot_token and self._ilink_base_url:
            base_url = self._ilink_base_url.rstrip("/")
            headers = self._generate_uin_headers()
            async with httpx.AsyncClient() as client:
                try:
                    await client.post(
                        f"{base_url}/ilink/bot/msg/notifystop",
                        json={"base_info": {"channel_version": "1.0.0", "bot_agent": "Vibe-Trading"}},
                        headers=headers,
                        timeout=5,
                    )
                except Exception as e:
                    logger.debug(f"[WeChat iLink] Failed to send notifystop: {e}")
                    
        logger.info(f"[WeChat] Adapter '{self._name}' closed.")

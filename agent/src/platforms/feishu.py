import asyncio
import json
import logging
import os
import threading
from typing import Any, Dict, List, Optional, Set

from src.platforms.base import BasePlatformAdapter, IncomingMessage

logger = logging.getLogger(__name__)

# Lazy imports for lark-oapi
lark = None
FeishuWSClient = None
CreateMessageRequest = None
CreateMessageRequestBody = None
UpdateMessageRequest = None
UpdateMessageRequestBody = None
EventDispatcherHandler = None


def _ensure_lark_imports():
    global lark, FeishuWSClient, CreateMessageRequest, CreateMessageRequestBody, UpdateMessageRequest, UpdateMessageRequestBody, EventDispatcherHandler
    if lark is not None:
        return
    import lark_oapi
    from lark_oapi.ws import Client as FeishuWSClient
    from lark_oapi.api.im.v1.model.create_message_request import CreateMessageRequest
    from lark_oapi.api.im.v1.model.create_message_request_body import CreateMessageRequestBody
    from lark_oapi.api.im.v1.model.update_message_request import UpdateMessageRequest
    from lark_oapi.api.im.v1.model.update_message_request_body import UpdateMessageRequestBody
    from lark_oapi.event.dispatcher_handler import EventDispatcherHandler
    lark = lark_oapi

    # Monkey patch lark-oapi's ws client loop to be thread-local event loop proxy
    import lark_oapi.ws.client
    import asyncio

    class LoopProxy:
        def __getattr__(self, name):
            try:
                return getattr(asyncio.get_event_loop(), name)
            except RuntimeError:
                # If no loop in this thread, automatically create one
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                return getattr(loop, name)
            
        def __str__(self):
            try:
                return str(asyncio.get_event_loop())
            except RuntimeError:
                return "No running event loop"
            
        def __repr__(self):
            try:
                return repr(asyncio.get_event_loop())
            except RuntimeError:
                return "<No running event loop>"

    lark_oapi.ws.client.loop = LoopProxy()
    logger.info("[Feishu] Applied thread-local event loop proxy patch to lark-oapi ws client.")


class FeishuAdapter(BasePlatformAdapter):
    """Feishu/Lark messenger platform adapter using official lark-oapi WebSocket client."""

    def __init__(
        self,
        channel_id: str,
        name: str,
        app_id: str,
        app_secret: str,
        allowed_users: str = "",
        allow_all_users: bool = False,
    ) -> None:
        self._channel_id: str = channel_id
        self._name: str = name
        self._app_id: str = app_id.strip()
        self._app_secret: str = app_secret.strip()
        self._allowed_users: Set[str] = {uid.strip() for uid in allowed_users.split(",") if uid.strip()} if allowed_users else set()
        self._allow_all_users: bool = allow_all_users
        
        self._client: Optional[Any] = None
        self._ws_client: Optional[Any] = None
        self._ws_thread: Optional[threading.Thread] = None
        self._manager: Optional[Any] = None
        
        # Throttled card update states
        self._pending_card_updates: Dict[str, tuple[str, str, str]] = {}  # msg_id -> (chat_id, title, content)
        self._pending_card_statuses: Dict[str, str] = {}  # msg_id -> status ("running"/"success"/"failed")
        self._card_updater_task: Optional[asyncio.Task] = None
        self._is_running: bool = False

    @property
    def platform_name(self) -> str:
        return f"feishu_{self._channel_id}"

    @property
    def display_name(self) -> str:
        return self._name

    async def initialize(self, manager: Any) -> None:
        _ensure_lark_imports()
        self._manager = manager
        
        if not self._app_id or not self._app_secret:
            logger.warning(f"[Feishu] App ID or App Secret is not configured for channel {self._name}. Channel disabled.")
            return

        # Initialize Lark API Client
        domain = os.getenv("FEISHU_DOMAIN", "https://open.feishu.cn").strip()
        self._client = lark.Client.builder().app_id(self._app_id).app_secret(self._app_secret).domain(domain).build()

        # Build Event Handler
        event_handler = (
            EventDispatcherHandler.builder("", "")
            .register_p2_im_message_receive_v1(self._on_message_received)
            .build()
        )

        # Setup WebSocket Client
        self._ws_client = FeishuWSClient(
            app_id=self._app_id,
            app_secret=self._app_secret,
            log_level=lark.LogLevel.INFO,
            event_handler=event_handler,
            domain=domain,
        )

        self._is_running = True
        self._card_updater_task = asyncio.create_task(self._card_flush_loop())
        
        # Start WebSocket Client in a dedicated background thread with isolated event loop
        self._ws_thread = threading.Thread(
            target=self._run_ws_client_thread,
            name=f"feishu-ws-{self._channel_id}",
            daemon=True
        )
        self._ws_thread.start()
        logger.info(f"[Feishu] WebSocket adapter initialized and started in dedicated thread for channel: {self._name}")

    def _run_ws_client_thread(self) -> None:
        print(f"[Feishu WS Thread] Thread started for channel '{self._name}' ({self._channel_id}). Isolating event loop...", flush=True)
        try:
            # Create a brand new event loop for this background thread
            # to isolate it from the main uvloop used by FastAPI
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            print(f"[Feishu WS Thread] Calling ws_client.start() blockingly...", flush=True)
            self._ws_client.start()
            print(f"[Feishu WS Thread] ws_client.start() returned successfully.", flush=True)
        except Exception as e:
            print(f"[Feishu WS Thread] ERROR: Failed to run WebSocket client: {e}", flush=True)
            logger.exception("[Feishu] Error running WebSocket client in thread: %s", e)

    def _on_message_received(self, data: Any) -> None:
        """Invoked by lark-oapi on a background thread when a new message arrives."""
        print(f"[Feishu WS Event] Raw message event received from Feishu Gateway!", flush=True)
        try:
            event = getattr(data, "event", None)
            message = getattr(event, "message", None)
            sender = getattr(event, "sender", None)
            if not message or not sender:
                print(f"[Feishu WS Event] Warning: Missing message or sender in event data.", flush=True)
                return

            message_id = getattr(message, "message_id", "")
            chat_id = getattr(message, "chat_id", "")
            raw_content = getattr(message, "content", "")
            message_type = getattr(message, "message_type", "")
            sender_id = getattr(sender, "sender_id", None)
            sender_open_id = getattr(sender_id, "open_id", "") if sender_id else ""

            if not message_id or not chat_id or not sender_open_id:
                print(f"[Feishu WS Event] Warning: Missing message_id, chat_id, or sender_open_id in event.", flush=True)
                return

            # Parse message content first (needed for both public commands and authorized checks)
            text_content = ""
            if message_type.lower() == "text":
                try:
                    payload = json.loads(raw_content)
                    text_content = payload.get("text", "").strip()
                except Exception:
                    text_content = raw_content.strip()
            else:
                print(f"[Feishu WS Event] Warning: Ignored non-text message type: {message_type}", flush=True)
                # Skip non-text messages for now
                return

            print(f"[Feishu WS Event] Received text: '{text_content}' from user {sender_open_id} in chat {chat_id}", flush=True)

            # Feature: Help users fetch their OpenID directly from the Bot
            if text_content.lower() in ("/myid", "/id", "myid", "id", "我的id", "我的openid", "我的id是什么", "获取id"):
                print(f"[Feishu WS Event] ID command detected! Sending OpenID back to user...", flush=True)
                asyncio.run_coroutine_threadsafe(
                    self.send_message(chat_id, f"您的飞书 OpenID 是:\n`{sender_open_id}`"),
                    asyncio.get_event_loop()
                )
                return

            # Check authorization
            if not self._allow_all_users and self._allowed_users and sender_open_id not in self._allowed_users:
                print(f"[Feishu WS Event] User {sender_open_id} is unauthorized. Allowed: {self._allowed_users}. Replying with block message...", flush=True)
                logger.warning("[Feishu] Unauthorized user %s tried to send message: %s", sender_open_id, message_id)
                # Send polite unauthorized message back with their OpenID
                err_msg = (
                    f"⚠️ 您没有权限使用此智能体系统。请联系管理员将您的 OpenID 添加到白名单。\n\n"
                    f"您的 OpenID 是:\n`{sender_open_id}`"
                )
                asyncio.run_coroutine_threadsafe(
                    self.send_message(chat_id, err_msg),
                    asyncio.get_event_loop()
                )
                return

            # Remove self mentions if in group chats
            if "@_all" in text_content:
                pass # Can parse if needed

            incoming = IncomingMessage(
                platform=self.platform_name,
                chat_id=chat_id,
                message_id=message_id,
                content=text_content,
                sender_id=sender_open_id,
                timestamp=float(getattr(event, "create_time", 0)) / 1000.0,
                raw_payload=data.event,
            )

            # Route to Manager (which runs in the main asyncio loop)
            if self._manager:
                self._manager.submit_incoming_message(incoming)

        except Exception as e:
            logger.exception("[Feishu] Error processing incoming message: %s", e)

    async def send_message(
        self,
        chat_id: str,
        content: str,
        title: Optional[str] = None,
    ) -> str:
        _ensure_lark_imports()
        
        # If title is provided, send as a message card (interactive)
        if title:
            card_json = self._build_card_json(title, content, "running")
            body = (
                CreateMessageRequestBody.builder()
                .receive_id(chat_id)
                .msg_type("interactive")
                .content(card_json)
                .build()
            )
        else:
            # Send as plain text
            body = (
                CreateMessageRequestBody.builder()
                .receive_id(chat_id)
                .msg_type("text")
                .content(json.dumps({"text": content}, ensure_ascii=False))
                .build()
            )

        request = (
            CreateMessageRequest.builder()
            .receive_id_type("chat_id")
            .request_body(body)
            .build()
        )

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._client.im.v1.message.create(request)
        )

        if response.code != 0:
            logger.error("[Feishu] Failed to send message: %s (%s)", response.msg, response.code)
            raise RuntimeError(f"Feishu send failed: {response.msg}")

        # Parse message ID from response data
        data_dict = json.loads(response.raw.content.decode("utf-8"))
        msg_id = data_dict.get("data", {}).get("message_id", "")
        return msg_id

    async def update_message(
        self,
        chat_id: str,
        message_id: str,
        content: str,
        title: Optional[str] = None,
    ) -> None:
        # Rather than sending API request instantly, we mark it as pending
        # The background loop will flush it to comply with Feishu rate limits.
        status = self._pending_card_statuses.get(message_id, "running")
        self._pending_card_updates[message_id] = (chat_id, title or "Agent Status", content)
        self._pending_card_statuses[message_id] = status

    async def update_message_immediate(
        self,
        chat_id: str,
        message_id: str,
        content: str,
        title: str,
        status: str,
    ) -> None:
        _ensure_lark_imports()
        card_json = self._build_card_json(title, content, status)
        body = (
            UpdateMessageRequestBody.builder()
            .content(card_json)
            .build()
        )
        request = (
            UpdateMessageRequest.builder()
            .message_id(message_id)
            .request_body(body)
            .build()
        )

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._client.im.v1.message.update(request)
        )

        if response.code != 0:
            logger.warning("[Feishu] Failed to update message %s: %s (code %s)", message_id, response.msg, response.code)

    def set_message_status(self, message_id: str, status: str) -> None:
        """Mark a pending update message status as success or failed."""
        self._pending_card_statuses[message_id] = status

    async def _card_flush_loop(self) -> None:
        """Background loop that flushes card updates once every 1.5 seconds to prevent rate-limiting."""
        while self._is_running:
            try:
                await asyncio.sleep(1.5)
                if not self._pending_card_updates:
                    continue

                # Take a snapshot of pending updates to process
                to_update = list(self._pending_card_updates.keys())
                for msg_id in to_update:
                    chat_id, title, content = self._pending_card_updates.pop(msg_id)
                    status = self._pending_card_statuses.pop(msg_id, "running")
                    
                    try:
                        await self.update_message_immediate(chat_id, msg_id, content, title, status)
                    except Exception as e:
                        logger.error("[Feishu] Failed to update card %s in flush loop: %s", msg_id, e)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[Feishu] Error in card flush loop: %s", e)

    def _split_markdown_into_elements(self, text: str) -> List[Dict[str, Any]]:
        elements = []
        chunk_size = 1900
        if not text:
            text = "..."
        for i in range(0, len(text), chunk_size):
            chunk = text[i:i+chunk_size]
            elements.append({
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": chunk
                }
            })
        return elements

    def _build_card_json(self, title: str, content: str, status: str = "running") -> str:
        template_color = "blue"
        if status == "success":
            template_color = "green"
        elif status == "failed":
            template_color = "red"
            
        elements = self._split_markdown_into_elements(content)
        
        card = {
            "config": {
                "wide_screen_mode": True
            },
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": title
                },
                "template": template_color
            },
            "elements": elements
        }
        return json.dumps(card, ensure_ascii=False)

    def _stop_ws_client_thread(self) -> None:
        try:
            # Create a separate loop to shutdown client blockingly
            # without interfering with main FastAPI uvloop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self._ws_client.stop()
        except Exception as e:
            logger.exception("[Feishu] Error stopping WebSocket client in thread: %s", e)

    async def close(self) -> None:
        self._is_running = False
        if self._card_updater_task:
            self._card_updater_task.cancel()
            try:
                await self._card_updater_task
            except asyncio.CancelledError:
                pass
        
        if self._ws_client:
            logger.info("[Feishu] Shutting down Feishu WebSocket client...")
            try:
                stop_thread = threading.Thread(
                    target=self._stop_ws_client_thread,
                    name=f"feishu-ws-stop-{self._channel_id}",
                    daemon=True
                )
                stop_thread.start()
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, stop_thread.join)
            except Exception as e:
                logger.warning("[Feishu] Error stopping WebSocket client: %s", e)
                
        logger.info("[Feishu] WebSocket adapter shut down.")

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from src.platforms.base import BasePlatformAdapter, IncomingMessage
from src.platforms.manager import PlatformManager


class MockAdapter(BasePlatformAdapter):
    def __init__(self):
        self.initialize_called = False
        self.sent_messages = []
        self.updated_messages = []
        self.closed = False

    @property
    def platform_name(self) -> str:
        return "mock_platform"

    async def initialize(self, manager) -> None:
        self.initialize_called = True

    async def send_message(self, chat_id, content, title=None) -> str:
        msg_id = f"msg_{len(self.sent_messages)}"
        self.sent_messages.append((chat_id, content, title, msg_id))
        return msg_id

    async def update_message(self, chat_id, message_id, content, title=None) -> None:
        self.updated_messages.append((chat_id, message_id, content, title))

    async def close(self) -> None:
        self.closed = True


def test_platform_manager_registration_and_lifecycle():
    session_service = MagicMock()
    manager = PlatformManager(session_service)
    adapter = MockAdapter()
    
    manager.register_adapter(adapter)
    assert manager._adapters["mock_platform"] == adapter
    
    asyncio.run(manager.start())
    assert adapter.initialize_called is True
    
    asyncio.run(manager.stop())
    assert adapter.closed is True


def test_platform_manager_session_resolution():
    session_service = MagicMock()
    session_service.create_session = MagicMock()
    session_service.create_session.return_value = MagicMock(session_id="new_session_123")
    
    mock_session = MagicMock(session_id="existing_session_456")
    mock_session.config = {"platform": "mock_platform", "platform_chat_id": "chat_456"}
    session_service.store.list_sessions.return_value = [mock_session]
    
    manager = PlatformManager(session_service)
    adapter = MockAdapter()
    manager.register_adapter(adapter)
    
    # Test mapping to existing session
    incoming_existing = IncomingMessage(
        platform="mock_platform",
        chat_id="chat_456",
        message_id="msg_1",
        content="hello",
        sender_id="user_1",
        timestamp=123456.0
    )
    
    session_id = asyncio.run(manager._resolve_or_create_session(incoming_existing))
    assert session_id == "existing_session_456"
    session_service.create_session.assert_not_called()
    
    # Test creating new session
    incoming_new = IncomingMessage(
        platform="mock_platform",
        chat_id="chat_999",
        message_id="msg_2",
        content="hello new",
        sender_id="user_1",
        timestamp=123456.0
    )
    
    session_id_new = asyncio.run(manager._resolve_or_create_session(incoming_new))
    assert session_id_new == "new_session_123"
    session_service.create_session.assert_called_once()
    
    # Verify created session's config
    args, kwargs = session_service.create_session.call_args
    assert kwargs["config"]["platform"] == "mock_platform"
    assert kwargs["config"]["platform_chat_id"] == "chat_999"


class DynamicMockAdapter(BasePlatformAdapter):
    def __init__(self, name: str, display: str):
        self._name = name
        self._display = display
        self.initialize_called = False
        self.closed = False

    @property
    def platform_name(self) -> str:
        return self._name

    @property
    def display_name(self) -> str:
        return self._display

    async def initialize(self, manager) -> None:
        self.initialize_called = True

    async def send_message(self, chat_id, content, title=None) -> str:
        return "msg_123"

    async def update_message(self, chat_id, message_id, content, title=None) -> None:
        pass

    async def close(self) -> None:
        self.closed = True


def test_platform_manager_multiple_channels():
    session_service = MagicMock()
    manager = PlatformManager(session_service)
    
    adapter1 = DynamicMockAdapter("feishu_chan_1", "飞书通道A")
    adapter2 = DynamicMockAdapter("feishu_chan_2", "飞书通道B")
    
    manager.register_adapter(adapter1)
    manager.register_adapter(adapter2)
    
    assert manager._adapters["feishu_chan_1"] == adapter1
    assert manager._adapters["feishu_chan_2"] == adapter2
    
    asyncio.run(manager.start())
    assert adapter1.initialize_called is True
    assert adapter2.initialize_called is True
    
    # Test resolving session titles
    session_service.create_session = MagicMock()
    session_service.create_session.return_value = MagicMock(session_id="session_123")
    session_service.store.list_sessions.return_value = []
    
    incoming = IncomingMessage(
        platform="feishu_chan_1",
        chat_id="chat_abc",
        message_id="msg_1",
        content="test",
        sender_id="sender_1",
        timestamp=123.0
    )
    
    session_id = asyncio.run(manager._resolve_or_create_session(incoming))
    assert session_id == "session_123"
    
    args, kwargs = session_service.create_session.call_args
    assert kwargs["title"] == "💬 test"
    assert kwargs["config"]["platform"] == "feishu_chan_1"

    # Test fallback title when content is empty
    session_service.create_session.reset_mock()
    incoming_empty = IncomingMessage(
        platform="feishu_chan_1",
        chat_id="chat_abc",
        message_id="msg_2",
        content="",
        sender_id="sender_1",
        timestamp=124.0
    )
    session_id = asyncio.run(manager._resolve_or_create_session(incoming_empty))
    args, kwargs = session_service.create_session.call_args
    assert kwargs["title"] == "飞书通道A 会话 (chat_abc)"

    # Test slash commands prefix stripping
    session_service.create_session.reset_mock()
    incoming_goal = IncomingMessage(
        platform="feishu_chan_1",
        chat_id="chat_abc",
        message_id="msg_3",
        content="/goal 分析腾讯控股",
        sender_id="sender_1",
        timestamp=125.0
    )
    session_id = asyncio.run(manager._resolve_or_create_session(incoming_goal))
    args, kwargs = session_service.create_session.call_args
    assert kwargs["title"] == "💬 分析腾讯控股"


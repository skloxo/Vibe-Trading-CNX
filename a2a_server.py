#!/usr/bin/env python3
"""Vibe-Trading A2A Server (v0.3 Protobuf + JSON-RPC) — production edition.

Start:  python a2a_server.py
Health: curl http://0.0.0.0:19997/health
Card:   curl http://0.0.0.0:19997/.well-known/agent-card.json
Test:   curl -X POST http://0.0.0.0:19997/ \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","id":1,"method":"message/send", \
             "params":{"message":{"role":"user","messageId":"m1", \
             "parts":[{"text":"沪深300 前5大权重股是哪些"}]}}}'
"""

from __future__ import annotations

import logging
import subprocess
import json
import os
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

import uvicorn
from a2a.types import (
    AgentCard,
    AgentCapabilities,
    AgentInterface,
    AgentProvider,
    AgentSkill,
    Role,
)
from a2a.helpers import (
    get_message_text,
    new_task_from_user_message,
    new_text_message,
    new_text_part,
)
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.server.events import InMemoryQueueManager, EventQueue
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.types.a2a_pb2 import TaskState
# Helper: create agent text message
from a2a.server.routes import create_jsonrpc_routes
from a2a.server.routes import create_agent_card_routes

# ─── Constants ──────────────────────────────────────────────────────────────

VT_HOST = "0.0.0.0"
VT_PORT = 19997
VT_BIN = os.path.expanduser("/home/skloxo/aho/vibe-trading/.venv/bin/vibe-trading")
VT_SKILLS = [
    "backtest", "alpha-zoo", "factor-research", "data-source",
    "risk-analysis", "macro-analysis", "options-strategy", "trade-journal",
    "shadow-account", "etf-analysis", "momentum", "pair-trading",
    "technical-basic", "behavioral-finance",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vt-a2a")

# ─── AgentCard ──────────────────────────────────────────────────────────────

def build_agent_card() -> AgentCard:
    skills = [
        AgentSkill(
            id=s,
            name=s.replace("-", " ").title(),
            description=f"Vibe-Trading {s} capability",
            tags=["finance", "quantitative"],
            examples=[],
        )
        for s in VT_SKILLS
    ]
    return AgentCard(
        name="Vibe-Trading Agent",
        description="69 specialist skills, 50 tools, 7 data sources — backtesting, factor research, options pricing, risk audits, and research reports.",
        provider=AgentProvider(organization="Vibe-Trading", url="https://github.com/vibe-trading"),
        version="1.0.0",
        documentation_url="https://github.com/vibe-trading/docs",
        supported_interfaces=[
            AgentInterface(protocol_binding="jsonrpc", url="http://0.0.0.0:19997/")
        ],
        default_input_modes=["text/plain", "application/json"],
        default_output_modes=["text/plain", "application/json"],
        capabilities=AgentCapabilities(streaming=False, push_notifications=False),
        skills=skills,
        icon_url="https://raw.githubusercontent.com/vibe-trading/docs/main/icon.png",
    )

AGENT_CARD = build_agent_card()

# ─── Agent Executor ─────────────────────────────────────────────────────────

class VTAgentExecutor(AgentExecutor):
    """Calls `vibe-trading -p "prompt" --no-rich` and streams back output."""

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        logger.info('VTAgentExecutor.execute')

        # 1. Get or create task
        if context.current_task:
            task = context.current_task
        else:
            task = new_task_from_user_message(context.message)
            await event_queue.enqueue_event(task)

        # 2. Update status to WORKING
        task_updater = TaskUpdater(
            event_queue=event_queue,
            task_id=task.id,
            context_id=task.context_id,
        )
        await task_updater.update_status(
            state=TaskState.TASK_STATE_WORKING,
            message=new_text_message('Processing request via Vibe-Trading...'),
        )

        # 3. Extract user text and invoke vt CLI
        user_text = get_message_text(context.message) or '(empty)'
        logger.info(f'User input: {user_text[:120]}')

        try:
            result = subprocess.run(
                [VT_BIN, '-p', user_text, '--no-rich'],
                capture_output=True, text=True, timeout=180,
            )
            reply_text = (result.stdout or '').strip()
            if not reply_text and result.returncode != 0:
                reply_text = f'[vt CLI exited {result.returncode}] {(result.stderr or "").strip()}'
        except FileNotFoundError:
            reply_text = f'[vt CLI] 找不到可执行文件: {VT_BIN}'
        except Exception as e:
            reply_text = f'[vt CLI] 执行错误: {e}'

        # 4. Add result as artifact
        await task_updater.add_artifact(
            parts=[new_text_part(text=reply_text, media_type='text/plain')]
        )
        logger.info('Request completed, result length: %d', len(reply_text))

        # 5. Mark task completed
        await task_updater.update_status(
            state=TaskState.TASK_STATE_COMPLETED,
            message=new_text_message('Request completed!'),
        )

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        """Cancel is not supported yet."""
        raise NotImplementedError('Cancel is not supported.')


# ─── App Factory ────────────────────────────────────────────────────────────

def create_app() -> Starlette:
    agent_card = build_agent_card()
    store = InMemoryTaskStore()
    executor = VTAgentExecutor()
    queue_manager = InMemoryQueueManager()
    
    handler = DefaultRequestHandler(
        agent_executor=executor,
        task_store=store,
        agent_card=agent_card,
        queue_manager=queue_manager,
    )
    
    routes = create_jsonrpc_routes(handler, rpc_url="/")
    routes += create_agent_card_routes(agent_card)

    async def health(request: Request) -> JSONResponse:
        return JSONResponse({
            "status": "ok", "service": "vt-a2a", "port": VT_PORT,
            "version": "1.0.0", "skills": [s.id for s in agent_card.skills],
        })

    routes.append(Route("/health", health, methods=["GET"]))

    logger.info(f"Vibe-Trading A2A Server: {agent_card.name} v{agent_card.version}, "
                f"skills={[s.id for s in agent_card.skills]}")
    return Starlette(routes=routes)

if __name__ == "__main__":
    uvicorn.run(create_app(), host=VT_HOST, port=VT_PORT, log_level="info")

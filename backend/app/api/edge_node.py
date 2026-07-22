"""Edge Node WebSocket — Real-time communication between SaaS server and local clients.

The local client (electron-egg) connects via WebSocket to receive commands
(publish, search, login check, etc.) and reports results back.

Protocol:
  Client → Server: register, heartbeat, task_result
  Server → Client: command, status_request

Flow:
  1. Client connects → sends register message with node_id + tenant_id
  2. Server stores connection in registry
  3. When a task needs execution, server pushes command via WebSocket
  4. Client executes (CDP/Python) and reports result back
  5. Server updates task status
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

router = APIRouter(tags=["edge-node"])


# ─── Connection Registry ───────────────────────────────────────────────────


class EdgeNodeConnection:
    """Represents a connected edge node (local client)."""

    def __init__(self, node_id: str, tenant_id: str, ws: WebSocket, meta: dict | None = None):
        self.node_id = node_id
        self.tenant_id = tenant_id
        self.ws = ws
        self.meta = meta or {}
        self.connected_at = datetime.utcnow()
        self.last_heartbeat = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "tenant_id": self.tenant_id,
            "connected_at": self.connected_at.isoformat(),
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "meta": self.meta,
        }


# tenant_id → {node_id: EdgeNodeConnection}
_connections: dict[str, dict[str, EdgeNodeConnection]] = {}
# node_id → EdgeNodeConnection (flat lookup)
_node_index: dict[str, EdgeNodeConnection] = {}
# Pending command futures: command_id → asyncio.Future
_pending_commands: dict[str, asyncio.Future] = {}
# Command response storage: command_id → result dict
_command_results: dict[str, dict] = {}


def _register_connection(conn: EdgeNodeConnection):
    tenant_id = conn.tenant_id
    if tenant_id not in _connections:
        _connections[tenant_id] = {}
    _connections[tenant_id][conn.node_id] = conn
    _node_index[conn.node_id] = conn
    logger.info(f"[EdgeNode] Registered: node={conn.node_id} tenant={tenant_id}")


def _unregister_connection(node_id: str):
    conn = _node_index.pop(node_id, None)
    if conn:
        tenant_conns = _connections.get(conn.tenant_id, {})
        tenant_conns.pop(node_id, None)
        if not tenant_conns:
            _connections.pop(conn.tenant_id, None)
        logger.info(f"[EdgeNode] Disconnected: node={node_id}")


def get_tenant_nodes(tenant_id: str) -> list[dict]:
    """Get all connected nodes for a tenant."""
    conns = _connections.get(tenant_id, {})
    return [c.to_dict() for c in conns.values()]


def get_node(node_id: str) -> EdgeNodeConnection | None:
    return _node_index.get(node_id)


# ─── Command Sending ───────────────────────────────────────────────────────


async def send_command(
    node_id: str,
    command: str,
    args: dict | None = None,
    timeout: float = 120,
) -> dict:
    """Send a command to an edge node and wait for the result.

    Args:
        node_id: Target edge node ID
        command: Command name (e.g., 'xhs_publish', 'xhs_search', 'xhs_check_login')
        args: Command arguments
        timeout: Max seconds to wait for result

    Returns:
        dict with 'success', 'result', 'error' keys
    """
    conn = _node_index.get(node_id)
    if not conn:
        return {"success": False, "error": f"Edge node {node_id} not connected"}

    command_id = str(uuid.uuid4())
    payload = {
        "type": "command",
        "command_id": command_id,
        "command": command,
        "args": args or {},
        "timestamp": datetime.utcnow().isoformat(),
    }

    try:
        await conn.ws.send_json(payload)
        logger.info(f"[EdgeNode] Sent command: node={node_id} cmd={command} id={command_id}")
    except Exception as e:
        return {"success": False, "error": f"Failed to send command: {e}"}

    # Wait for result
    future: asyncio.Future = asyncio.get_event_loop().create_future()
    _pending_commands[command_id] = future

    try:
        result = await asyncio.wait_for(future, timeout=timeout)
        return result
    except asyncio.TimeoutError:
        _pending_commands.pop(command_id, None)
        return {"success": False, "error": f"Command timed out after {timeout}s"}
    finally:
        _command_results.pop(command_id, None)


# ─── WebSocket Endpoint ────────────────────────────────────────────────────


@router.websocket("/ws/edge-node")
async def edge_node_ws(websocket: WebSocket):
    """WebSocket endpoint for edge node (local client) connections.

    Client sends messages as JSON:
      {"type": "register", "node_id": "...", "tenant_id": "...", "meta": {...}}
      {"type": "heartbeat"}
      {"type": "command_result", "command_id": "...", "success": true, "result": {...}}
    """
    await websocket.accept()
    conn: EdgeNodeConnection | None = None

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "register":
                node_id = data.get("node_id", "")
                tenant_id = data.get("tenant_id", "")
                if not node_id or not tenant_id:
                    await websocket.send_json({"type": "error", "message": "node_id and tenant_id required"})
                    continue

                conn = EdgeNodeConnection(
                    node_id=node_id,
                    tenant_id=tenant_id,
                    ws=websocket,
                    meta=data.get("meta", {}),
                )
                _register_connection(conn)
                await websocket.send_json({
                    "type": "registered",
                    "node_id": node_id,
                    "message": "Edge node registered successfully",
                })

            elif msg_type == "heartbeat":
                if conn:
                    conn.last_heartbeat = datetime.utcnow()
                    await websocket.send_json({"type": "heartbeat_ack"})

            elif msg_type == "command_result":
                command_id = data.get("command_id", "")
                future = _pending_commands.pop(command_id, None)
                if future and not future.done():
                    result = {
                        "success": data.get("success", False),
                        "result": data.get("result"),
                        "error": data.get("error"),
                    }
                    future.set_result(result)
                    _command_results[command_id] = result
                    logger.info(f"[EdgeNode] Command result: id={command_id} success={result['success']}")

            else:
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("[EdgeNode] Client disconnected")
    except Exception as e:
        logger.error(f"[EdgeNode] WebSocket error: {e}")
    finally:
        if conn:
            _unregister_connection(conn.node_id)


# ─── REST API for querying connected nodes ─────────────────────────────────


@router.get("/edge-nodes")
async def list_edge_nodes(tenant_id: str | None = None):
    """List all connected edge nodes, optionally filtered by tenant."""
    if tenant_id:
        return {"nodes": get_tenant_nodes(tenant_id)}
    all_nodes = []
    for tenant_conns in _connections.values():
        for conn in tenant_conns.values():
            all_nodes.append(conn.to_dict())
    return {"nodes": all_nodes}


@router.get("/edge-nodes/{node_id}/status")
async def edge_node_status(node_id: str):
    """Check if a specific edge node is connected."""
    conn = get_node(node_id)
    if conn:
        return {"connected": True, **conn.to_dict()}
    return {"connected": False, "node_id": node_id}

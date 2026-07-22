/**
 * Test script — Connect to SaaS server via WebSocket as an edge node.
 * Run with: node test-edge-node.js
 */
const WebSocket = require('ws');

const SERVER_URL = process.env.SERVER_URL || 'ws://8.134.178.82:8008/api/ws/edge-node';
const NODE_ID = process.env.NODE_ID || `edge-test-${Date.now()}`;
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

console.log(`[EdgeNode] Connecting to ${SERVER_URL}`);
console.log(`[EdgeNode] Node ID: ${NODE_ID}`);
console.log(`[EdgeNode] Tenant ID: ${TENANT_ID}`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('[EdgeNode] ✅ Connected to server');

    // Register
    ws.send(JSON.stringify({
        type: 'register',
        node_id: NODE_ID,
        tenant_id: TENANT_ID,
        meta: { platform: process.platform, hostname: require('os').hostname() },
    }));
    console.log('[EdgeNode] 📤 Sent register message');

    // Start heartbeat
    setInterval(() => {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
    }, 30000);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[EdgeNode] 📩 Received: ${msg.type}`);

    if (msg.type === 'registered') {
        console.log(`[EdgeNode] ✅ Registered: ${msg.message}`);
        console.log('[EdgeNode] Waiting for commands from server...');
    }

    if (msg.type === 'command') {
        console.log(`[EdgeNode] ⚡ Command: ${msg.command} (id: ${msg.command_id})`);
        console.log(`[EdgeNode] Args: ${JSON.stringify(msg.args)}`);

        // Simulate executing the command
        setTimeout(() => {
            const result = {
                type: 'command_result',
                command_id: msg.command_id,
                success: true,
                result: {
                    message: `[EdgeNode] Simulated execution of ${msg.command}`,
                    note: 'This is a test. Real execution uses Chrome CDP.',
                },
            };
            ws.send(JSON.stringify(result));
            console.log(`[EdgeNode] 📤 Sent result for ${msg.command}`);
        }, 1000);
    }

    if (msg.type === 'heartbeat_ack') {
        console.log('[EdgeNode] 💓 Heartbeat ack');
    }

    if (msg.type === 'error') {
        console.error(`[EdgeNode] ❌ Error: ${msg.message}`);
    }
});

ws.on('close', () => {
    console.log('[EdgeNode] 🔌 Disconnected');
    process.exit(0);
});

ws.on('error', (err) => {
    console.error(`[EdgeNode] ❌ WebSocket error: ${err.message}`);
    process.exit(1);
});

// Keep process alive
console.log('[EdgeNode] Press Ctrl+C to disconnect');

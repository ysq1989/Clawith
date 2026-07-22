/**
 * Test sending a command from server to edge node.
 * Run on the server or through the API.
 */
const http = require('http');

// Send XHS search request — this will try edge node first
const searchData = JSON.stringify({ keyword: '美食' });
const options = {
    hostname: '8.134.178.82',
    port: 8008,
    path: '/api/xhs/search?keyword=' + encodeURIComponent('美食'),
    method: 'GET',
    headers: {
        'X-Agent-Tenant-Id': '00000000-0000-0000-0000-000000000001',
    },
    timeout: 30000,
};

console.log('[Test] Sending XHS search request (will route to edge node)...');

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`[Test] Response (${res.statusCode}):`);
        try {
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch {
            console.log(data);
        }
    });
});

req.on('error', (err) => {
    console.error(`[Test] Error: ${err.message}`);
});

req.on('timeout', () => {
    console.error('[Test] Request timed out');
    req.destroy();
});

req.end();

/**
 * 完整测试脚本 — 边缘节点 + Chrome CDP + 命令执行
 *
 * 测试步骤：
 * 1. 本地启动 Chrome (CDP 9222)
 * 2. 连接到 SaaS 服务器
 * 3. 接收并执行服务器推送的命令
 *
 * 运行: node test-full-flow.js
 */
const WebSocket = require('ws');
const http = require('http');
const { execSync, spawn } = require('child_process');
const path = require('path');
const os = require('os');

// ─── 配置 ─────────────────────────────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || 'ws://8.134.178.82:8008/api/ws/edge-node';
const SERVER_HTTP = process.env.SERVER_HTTP || 'http://8.134.178.82:8008';
const NODE_ID = process.env.NODE_ID || `edge-${os.hostname()}-${Date.now()}`;
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const CDP_PORT = 9222;
const XHS_SKILLS_DIR = process.env.XHS_SKILLS_DIR || 'D:/开发工作区/XiaohongshuSkills';

// ─── Chrome 管理 ──────────────────────────────────────────────────────────
let chromeProcess = null;

function findChromePath() {
    if (process.platform === 'win32') {
        const candidates = [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        ];
        for (const p of candidates) {
            try { require('fs').accessSync(p); return p; } catch {}
        }
    }
    return 'google-chrome-stable';
}

function launchChrome() {
    const chromePath = findChromePath();
    const profileDir = path.join(os.homedir(), '.future-staff', 'chrome-profile');

    console.log(`[Chrome] Launching: ${chromePath}`);
    console.log(`[Chrome] Profile: ${profileDir}`);
    console.log(`[Chrome] CDP Port: ${CDP_PORT}`);

    chromeProcess = spawn(chromePath, [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
    ], { detached: false, stdio: 'ignore' });

    chromeProcess.on('error', (err) => {
        console.error(`[Chrome] Error: ${err.message}`);
    });

    chromeProcess.on('exit', (code) => {
        console.log(`[Chrome] Exited with code ${code}`);
        chromeProcess = null;
    });

    // Wait for CDP
    return waitForCdp(10000);
}

function waitForCdp(timeoutMs) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
            const req = http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, { timeout: 3000 }, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try {
                        const info = JSON.parse(data);
                        console.log(`[Chrome] ✅ CDP connected: ${info.Browser}`);
                        resolve(info);
                    } catch { resolve(null); }
                });
            });
            req.on('error', () => {
                if (Date.now() > deadline) reject(new Error('CDP timeout'));
                else setTimeout(check, 500);
            });
        };
        check();
    });
}

function stopChrome() {
    if (chromeProcess) {
        chromeProcess.kill();
        chromeProcess = null;
        console.log('[Chrome] Stopped');
    }
}

// ─── CDP 脚本执行 ─────────────────────────────────────────────────────────
function runCdpScript(args, timeoutMs = 120000) {
    const scriptPath = path.join(XHS_SKILLS_DIR, 'scripts', 'cdp_publish.py');
    const cmdArgs = [
        scriptPath,
        '--host', '127.0.0.1',
        '--port', String(CDP_PORT),
        '--headless',
        ...args,
    ];

    console.log(`[CDP] Running: python ${cmdArgs.join(' ')}`);

    return new Promise((resolve) => {
        const proc = spawn('python', cmdArgs, {
            cwd: XHS_SKILLS_DIR,
            timeout: timeoutMs,
        });

        let stdout = '', stderr = '';
        proc.stdout.on('data', (d) => stdout += d.toString());
        proc.stderr.on('data', (d) => stderr += d.toString());

        proc.on('close', (code) => {
            const json = extractJson(stdout);
            if (json) {
                resolve({ success: true, data: json });
            } else if (stdout.includes('NOT LOGGED IN')) {
                resolve({ success: false, error: 'not_logged_in', message: '小红书未登录' });
            } else if (code !== 0) {
                resolve({ success: false, error: stderr || stdout });
            } else {
                resolve({ success: true, data: { status: 'ok' } });
            }
        });

        proc.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

function extractJson(text) {
    const markers = ['SEARCH_RESULT:', 'CONTENT_DATA_RESULT:', 'GET_LOGIN_QRCODE_RESULT:', 'FEED_DETAIL:'];
    for (const marker of markers) {
        const idx = text.indexOf(marker);
        if (idx !== -1) {
            const rest = text.substring(idx + marker.length).trim();
            return parseJson(rest);
        }
    }
    return parseJson(text);
}

function parseJson(text) {
    for (const [s, e] of [['{', '}'], ['[', ']']]) {
        const start = text.indexOf(s);
        if (start === -1) continue;
        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === s) depth++;
            else if (text[i] === e) {
                depth--;
                if (depth === 0) {
                    try { return JSON.parse(text.substring(start, i + 1)); } catch {}
                }
            }
        }
    }
    return null;
}

// ─── WebSocket 连接 ───────────────────────────────────────────────────────
function connectToServer() {
    console.log(`\n[EdgeNode] Connecting to ${SERVER_URL}`);
    console.log(`[EdgeNode] Node: ${NODE_ID}, Tenant: ${TENANT_ID}\n`);

    const ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
        console.log('[EdgeNode] ✅ Connected to server');
        ws.send(JSON.stringify({
            type: 'register',
            node_id: NODE_ID,
            tenant_id: TENANT_ID,
            meta: { platform: process.platform, hostname: os.hostname(), chrome_port: CDP_PORT },
        }));

        setInterval(() => ws.send(JSON.stringify({ type: 'heartbeat' })), 30000);
    });

    ws.on('message', async (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'registered') {
            console.log(`[EdgeNode] ✅ ${msg.message}`);
            console.log('[EdgeNode] 🎯 Ready to receive commands!\n');
        }

        if (msg.type === 'command') {
            console.log(`[EdgeNode] ⚡ Command: ${msg.command}`);
            console.log(`[EdgeNode] Args: ${JSON.stringify(msg.args)}`);

            const result = await executeCommand(msg.command, msg.args);
            ws.send(JSON.stringify({
                type: 'command_result',
                command_id: msg.command_id,
                success: result.success,
                result: result.data,
                error: result.error,
            }));
            console.log(`[EdgeNode] 📤 Result sent (${result.success ? 'success' : 'failed'})\n`);
        }
    });

    ws.on('close', () => {
        console.log('[EdgeNode] 🔌 Disconnected');
        stopChrome();
    });

    ws.on('error', (err) => {
        console.error(`[EdgeNode] ❌ Error: ${err.message}`);
    });
}

// ─── 命令执行 ─────────────────────────────────────────────────────────────
async function executeCommand(command, args) {
    switch (command) {
        case 'xhs_search':
            return runCdpScript(['search-feeds', '--keyword', args.keyword]);
        case 'xhs_login_qrcode':
            return runCdpScript(['get-login-qrcode'], 60000);
        case 'xhs_check_login':
            const r = await runCdpScript(['check-login'], 15000);
            return { success: r.success, data: { logged_in: r.success } };
        case 'xhs_get_note':
            const noteArgs = ['get-feed-detail', '--feed-id', args.note_id];
            if (args.xsec_token) noteArgs.push('--xsec-token', args.xsec_token);
            return runCdpScript(noteArgs);
        case 'xhs_like':
            return runCdpScript(['note-upvote', '--feed-id', args.note_id]);
        case 'xhs_bookmark':
            return runCdpScript(['note-bookmark', '--feed-id', args.note_id]);
        case 'xhs_comment':
            return runCdpScript(['post-comment-to-feed', '--feed-id', args.note_id, '--content', args.content]);
        default:
            return { success: false, error: `Unknown command: ${command}` };
    }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  Future Staff Edge Node — 完整流程测试');
    console.log('═══════════════════════════════════════════════════\n');

    try {
        // Step 1: Launch Chrome
        console.log('Step 1: 启动 Chrome CDP...');
        await launchChrome();
        console.log('');

        // Step 2: Connect to server
        console.log('Step 2: 连接 SaaS 服务器...');
        connectToServer();
    } catch (err) {
        console.error(`\n❌ 启动失败: ${err.message}`);
        console.log('\n请确保:');
        console.log('1. Chrome 已安装');
        console.log('2. XiaohongshuSkills 在 D:/开发工作区/XiaohongshuSkills/');
        console.log('3. 服务器 8.134.178.82:8008 可访问');
    }
}

main();

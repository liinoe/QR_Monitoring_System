// QLess Scanner Agent — runs on the library PC where the USB QR scanner is plugged in.
//
// The scanner page (opened in this PC's browser) asks http://localhost:5055/status
// to know if the scanner is connected. "localhost" always means THIS computer, so it
// works even if the website and backend are hosted somewhere else.
//
// No npm install needed — it only uses Node's built-in modules.
//
//   node scanner-agent.js          start the agent
//   node scanner-agent.js --find   find the scanner (unplug test) and save it to config.json

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFile } = require('child_process');

const CONFIG_FILE = path.join(__dirname, 'config.json');
const CACHE_MS = 5000;      // reuse the last device list for 5 seconds (checking takes 1–8 s on Windows)
const PS_TIMEOUT_MS = 20000; // give PowerShell up to 20 seconds (some PCs are slow at listing devices)
let cache = { at: 0, devices: null };
let inFlight = null;         // the device check that is running right now (so checks don't pile up)

// Reads config.json → { port, vid, pid, name }. Missing file = defaults.
function loadConfig() {
    try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return { port: 5055, ...cfg, vid: (cfg.vid || '').toUpperCase(), pid: (cfg.pid || '').toUpperCase() };
    } catch {
        return { port: 5055, vid: '', pid: '' };
    }
}

// Pulls "VID_1EAB&PID_8203" out of a Windows device ID → { vid: '1EAB', pid: '8203' }.
function parseIds(instanceId) {
    const m = /VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(instanceId || '');
    return m ? { vid: m[1].toUpperCase(), pid: m[2].toUpperCase() } : null;
}

// Windows: asks PowerShell for every USB/HID device that is plugged in right now.
function listWindowsDevices() {
    const script =
        "Get-PnpDevice -PresentOnly | " +
        "Where-Object { $_.InstanceId -match 'VID_[0-9A-F]{4}&PID_[0-9A-F]{4}' } | " +
        "Select-Object FriendlyName, InstanceId, Class | ConvertTo-Json -Compress";
    return new Promise((resolve, reject) => {
        const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: PS_TIMEOUT_MS, windowsHide: true },
            (err, stdout, stderr) => {
                // Use the list if PowerShell gave one, even if it also reported a warning.
                if (err && !(stdout && stdout.trim())) {
                    const why = err.killed
                        ? `PowerShell took longer than ${PS_TIMEOUT_MS / 1000} seconds`
                        : (String(stderr || '').trim().split('\n')[0] || err.message);
                    return reject(new Error(why));
                }
                let rows = [];
                try {
                    const parsed = JSON.parse(stdout || '[]');
                    rows = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    rows = [];
                }
                resolve(rows
                    .map((r) => ({ name: r.FriendlyName, type: r.Class, ...parseIds(r.InstanceId) }))
                    .filter((d) => d.vid));
            });
        // Tell PowerShell there's no keyboard input coming. Without this, on some PCs
        // PowerShell waits for input forever when started from Node, and the check never ends.
        child.stdin.end();
    });
}

// Linux: reads the USB device list from /sys.
function listLinuxDevices() {
    const base = '/sys/bus/usb/devices';
    const read = (dir, file) => {
        try { return fs.readFileSync(path.join(base, dir, file), 'utf8').trim(); } catch { return ''; }
    };
    return Promise.resolve(fs.readdirSync(base)
        .map((dir) => ({ name: read(dir, 'product') || dir, type: 'USB', vid: read(dir, 'idVendor').toUpperCase(), pid: read(dir, 'idProduct').toUpperCase() }))
        .filter((d) => d.vid));
}

// Returns the plugged-in USB devices (cached for 5 seconds unless fresh=true).
// If a check is already running, waits for that one instead of starting another.
async function listDevices(fresh = false) {
    if (!fresh && cache.devices && Date.now() - cache.at < CACHE_MS) return cache.devices;
    if (inFlight) return inFlight;
    inFlight = readDevices().finally(() => { inFlight = null; });
    return inFlight;
}

// Asks the operating system for the device list and remembers it.
async function readDevices() {
    let devices;
    if (process.platform === 'win32') devices = await listWindowsDevices();
    else if (process.platform === 'linux') devices = await listLinuxDevices();
    else throw new Error(`Not supported on ${process.platform}`);
    cache = { at: Date.now(), devices };
    return devices;
}

// Keeps one row per VID/PID (Windows lists the same device a few times).
function uniqueDevices(devices) {
    return [...new Map(devices.map((d) => [`${d.vid}:${d.pid}`, d])).values()];
}

// Sends a JSON reply. CORS headers let the scanner page (any website) read it,
// and "Private-Network" lets a hosted https page talk to localhost in Chrome/Edge.
function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-store',
    });
    res.end(data === undefined ? '' : JSON.stringify(data));
}

// Handles the two routes:
//   GET /status  → { configured, connected, name }
//   GET /devices → every plugged-in USB device
async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204);
    const url = req.url.split('?')[0];

    if (url === '/status') {
        const { vid, pid } = loadConfig();
        if (!vid || !pid) return sendJson(res, 200, { configured: false, connected: null });
        try {
            const match = (await listDevices()).find((d) => d.vid === vid && d.pid === pid);
            return sendJson(res, 200, { configured: true, connected: !!match, name: match ? match.name : null });
        } catch (err) {
            console.error('Status check failed:', err.message);
            return sendJson(res, 200, { configured: true, connected: null });
        }
    }

    if (url === '/devices') {
        try {
            const list = uniqueDevices(await listDevices(true));
            return sendJson(res, 200, list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (err) {
            return sendJson(res, 500, { message: err.message });
        }
    }

    sendJson(res, 404, { message: 'Not found' });
}

// Starts the agent on 127.0.0.1 only, so other computers can't reach it.
function startServer() {
    const { port, vid, pid } = loadConfig();
    http.createServer(handleRequest).listen(port, '127.0.0.1', () => {
        console.log(`QLess Scanner Agent running at http://localhost:${port}`);
        console.log(vid && pid ? `Watching scanner VID ${vid} / PID ${pid}` : 'No scanner saved yet — run: node scanner-agent.js --find');
    });
}

// Asks a yes/Enter question in the terminal and waits for the answer.
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

// "--find" mode: lists devices with the scanner plugged in, again after unplugging,
// and saves the device that disappeared into config.json.
async function findScanner() {
    await ask('1) Make sure the QR scanner is PLUGGED IN, then press Enter...');
    const before = uniqueDevices(await listDevices(true));
    await ask('2) Now UNPLUG the scanner, wait 3 seconds, then press Enter...');
    const after = uniqueDevices(await listDevices(true));

    const gone = before.filter((b) => !after.some((a) => a.vid === b.vid && a.pid === b.pid));
    if (gone.length === 0) {
        console.log('\nNo device disappeared. Try again and wait a few seconds after unplugging.');
        return;
    }
    if (gone.length > 1) {
        console.log('\nMore than one device disappeared:');
        gone.forEach((d, i) => console.log(`  ${i + 1}. ${d.name} (VID ${d.vid} / PID ${d.pid})`));
    }
    const pick = gone.length === 1 ? gone[0] : gone[(parseInt(await ask('Type the number of the scanner: '), 10) || 1) - 1];
    if (!pick) return console.log('Nothing saved.');

    const cfg = { ...loadConfig(), vid: pick.vid, pid: pick.pid, name: pick.name };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    console.log(`\nSaved! Scanner = ${pick.name} (VID ${pick.vid} / PID ${pick.pid})`);
    console.log('Plug the scanner back in, then start the agent: node scanner-agent.js');
}

if (process.argv.includes('--find')) {
    findScanner().catch((err) => console.error('Error:', err.message));
} else {
    startServer();
}
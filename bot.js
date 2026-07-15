// bot.js - COMPLETE STANDALONE BOT FOR RENDER
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const https = require('https');
const fs = require('fs');

// ============================================================
// 🔥 YOUR BOT CONFIG - ALREADY FILLED!
// ============================================================
const BOT_TOKEN = '8604504350:AAEEYDta9iHgqaGdgWT8N1h13YpMZb_gbYg';
const ADMIN_ID = '8595999663';

// Kruncpoint credentials
const KRUNCPOINT_URL = 'https://krunchpoint.x10.mx';
const KRN_USERNAME = 'kingzicoime';
const KRN_PASSWORD = 'matebook';

// ============================================================
// DATA FILE
// ============================================================
const DATA_FILE = 'data.json';

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {}
    return { stock: {} };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// START BOT
// ============================================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🤖 Kruncpoint Bot started!');
console.log(`👤 Admin ID: ${ADMIN_ID}`);

// ============================================================
// 🔥 /start
// ============================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    let text = '👋 **KRNUCPOINT BOT**\n─────────────────\n\n';
    text += '🔑 **COMMANDS:**\n';
    text += '   /hack [package] [count] - Generate keys\n';
    text += '   /balance - Check balance\n';
    text += '   /stock - Check your stock\n';
    text += '   /addkey [package] [key] - Add key to stock\n';
    text += '   /keys - List all keys\n\n';
    text += '📦 **PACKAGES:**\n';
    text += '   2Hours, 5Hours, 1Day, 3Days\n';
    text += '   7Days, 14Days, 30Days, 60Days\n\n';
    text += '💡 Example: `/hack 1Day 10`';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// 🔥 /hack - Generate keys from Kruncpoint
// ============================================================
bot.onText(/\/hack (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        return bot.sendMessage(chatId, '⛔ Admin only!');
    }
    
    const args = match[1].split(' ');
    const packageId = args[0]?.toUpperCase() || '1DAY';
    const count = parseInt(args[1]) || 5;
    
    if (count > 50) {
        return bot.sendMessage(chatId, '❌ Max 50 keys per request!');
    }
    
    await bot.sendMessage(chatId, `⏳ Generating ${count} keys for ${packageId}...`);
    
    try {
        const result = await generateFromKruncpoint(count, packageId);
        
        if (result.success > 0) {
            let msgText = `✅ **GENERATED ${result.success} KEYS!**\n─────────────────\n\n`;
            msgText += `📦 Package: ${packageId}\n`;
            msgText += `🔑 **Keys:**\n`;
            result.keys.slice(0, 15).forEach((k, i) => {
                msgText += `   ${i+1}. \`${k}\`\n`;
            });
            if (result.keys.length > 15) {
                msgText += `   ... and ${result.keys.length - 15} more\n`;
            }
            msgText += `\n💾 Keys saved to: kruncpoint_keys.txt`;
            bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
            
            // Auto-add to stock
            const added = await addKeysToStock(result.keys, packageId);
            bot.sendMessage(chatId, `✅ ${added} keys added to your stock!`);
        } else {
            bot.sendMessage(chatId, 
                `❌ **FAILED!**\n─────────────────\n\n` +
                `📦 Package: ${packageId}\n` +
                `❌ Failed: ${result.failed}\n` +
                `💡 Balance: ₹5 (Need ₹10 for 2Hours)`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// 🔥 /balance - Check Kruncpoint balance
// ============================================================
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        return bot.sendMessage(chatId, '⛔ Admin only!');
    }
    
    await bot.sendMessage(chatId, '⏳ Checking balance...');
    
    try {
        const balance = await checkKruncpointBalance();
        bot.sendMessage(chatId, 
            `💰 **KRNUCPOINT BALANCE**\n─────────────────\n\n` +
            `👤 Account: ${KRN_USERNAME}\n` +
            `💰 Balance: ₹${balance || 'Unknown'}\n` +
            `💡 Cheapest key: ₹10 (2 Hours)\n` +
            `📊 Can generate: ${balance >= 10 ? Math.floor(balance / 10) : 0} keys`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// 🔥 /stock - Check your stock
// ============================================================
bot.onText(/\/stock/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        return bot.sendMessage(chatId, '⛔ Admin only!');
    }
    
    try {
        const data = loadData();
        let text = `📊 **YOUR STOCK**\n─────────────────\n\n`;
        let total = 0;
        
        for (const pkg in data.stock) {
            const count = data.stock[pkg].length;
            total += count;
            text += `📦 ${pkg}: ${count} keys\n`;
        }
        
        text += `\n📦 Total: ${total} keys`;
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// 🔥 /keys - List all keys
// ============================================================
bot.onText(/\/keys/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        return bot.sendMessage(chatId, '⛔ Admin only!');
    }
    
    try {
        const data = loadData();
        let text = `🔑 **ALL KEYS**\n─────────────────\n\n`;
        let hasKeys = false;
        
        for (const pkg in data.stock) {
            if (data.stock[pkg] && data.stock[pkg].length > 0) {
                hasKeys = true;
                text += `📦 ${pkg} (${data.stock[pkg].length}):\n`;
                data.stock[pkg].slice(0, 5).forEach(k => {
                    text += `   \`${k}\`\n`;
                });
                if (data.stock[pkg].length > 5) {
                    text += `   ... and ${data.stock[pkg].length - 5} more\n`;
                }
                text += `\n`;
            }
        }
        
        if (!hasKeys) {
            text += '📭 No keys in stock yet.';
        }
        
        if (text.length > 4000) {
            fs.writeFileSync('keys_list.txt', text);
            bot.sendDocument(chatId, 'keys_list.txt');
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// 🔥 /addkey - Add key to stock
// ============================================================
bot.onText(/\/addkey (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        return bot.sendMessage(chatId, '⛔ Admin only!');
    }
    
    const args = match[1].split(' ');
    const packageId = args[0]?.toUpperCase() || '1DAY';
    const key = args[1]?.toUpperCase();
    
    if (!key || !key.startsWith('BS-')) {
        return bot.sendMessage(chatId, '❌ Use: `/addkey 1DAY BS-ABC123`', { parse_mode: 'Markdown' });
    }
    
    try {
        const data = loadData();
        if (!data.stock[packageId]) data.stock[packageId] = [];
        
        if (data.stock[packageId].includes(key)) {
            return bot.sendMessage(chatId, `⚠️ Key \`${key}\` already exists!`, { parse_mode: 'Markdown' });
        }
        
        data.stock[packageId].push(key);
        saveData(data);
        
        bot.sendMessage(chatId, 
            `✅ **KEY ADDED!**\n─────────────────\n\n` +
            `🔑 \`${key}\`\n` +
            `📦 ${packageId}\n` +
            `📊 Total: ${data.stock[packageId].length} keys in ${packageId}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// 🔥 GENERATE FROM KRNUCPOINT
// ============================================================
async function generateFromKruncpoint(count = 5, packageId = '1DAY') {
    let keys = [];
    let success = 0;
    let failed = 0;
    
    try {
        console.log('🔐 Logging in to Kruncpoint...');
        const loginRes = await axios.post(
            `${KRUNCPOINT_URL}/login`,
            new URLSearchParams({
                username: KRN_USERNAME,
                password: KRN_PASSWORD
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                maxRedirects: 5
            }
        );
        
        const cookies = loginRes.headers['set-cookie'] || [];
        const cookie = cookies.map(c => c.split(';')[0]).join('; ');
        console.log('✅ Logged in!');
        
        for (let i = 0; i < count; i++) {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let key = 'BS-';
            for (let j = 0; j < 8; j++) {
                key += chars[Math.floor(Math.random() * chars.length)];
            }
            
            let generated = false;
            
            // Try bypass methods
            const methods = [
                { game: 'Blood Strike', max_devices: '1', duration: packageId, custom_key: key },
                { game: 'Blood Strike', max_devices: '1', duration: packageId, custom_key: key, bulk: '1', estimation: '0' },
                { game: 'Blood Strike', max_devices: '0', duration: packageId, custom_key: key, bulk: '1' },
                { game: 'Blood Strike', max_devices: '1', duration: packageId, custom_key: key, bulk: '1', free: 'true' },
            ];
            
            for (const params of methods) {
                if (generated) break;
                try {
                    const response = await axios.post(
                        `${KRUNCPOINT_URL}/keys/generate`,
                        new URLSearchParams(params),
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Cookie': cookie,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            },
                            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                            timeout: 10000
                        }
                    );
                    
                    const data = response.data;
                    if (typeof data === 'string') {
                        if (!data.toLowerCase().includes('error') && 
                            !data.toLowerCase().includes('balance') &&
                            !data.toLowerCase().includes('insufficient')) {
                            generated = true;
                        }
                    }
                } catch (e) {}
            }
            
            if (generated) {
                success++;
                keys.push(key);
                console.log(`✅ ${key}`);
            } else {
                failed++;
                console.log(`❌ ${key} - failed`);
            }
            
            if (i < count - 1) {
                await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
            }
        }
        
        if (keys.length > 0) {
            fs.writeFileSync('kruncpoint_keys.txt', keys.join('\n'));
        }
        
        return { success, failed, keys };
        
    } catch (e) {
        console.error('❌ Error:', e.message);
        return { success: 0, failed: count, keys: [], error: e.message };
    }
}

// ============================================================
// 🔥 CHECK BALANCE
// ============================================================
async function checkKruncpointBalance() {
    try {
        const loginRes = await axios.post(
            `${KRUNCPOINT_URL}/login`,
            new URLSearchParams({
                username: KRN_USERNAME,
                password: KRN_PASSWORD
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }
        );
        
        const cookies = loginRes.headers['set-cookie'] || [];
        const cookie = cookies.map(c => c.split(';')[0]).join('; ');
        
        const response = await axios.get(
            `${KRUNCPOINT_URL}/dashboard`,
            {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }
        );
        
        const html = response.data;
        const match = html.match(/Balance[:\s]*₹?([0-9.]+)/i);
        return match ? parseFloat(match[1]) : null;
    } catch (e) {
        return null;
    }
}

// ============================================================
// 🔥 ADD KEYS TO STOCK
// ============================================================
async function addKeysToStock(keys, packageId) {
    try {
        const data = loadData();
        if (!data.stock[packageId]) data.stock[packageId] = [];
        
        let added = 0;
        keys.forEach(key => {
            if (!data.stock[packageId].includes(key)) {
                data.stock[packageId].push(key);
                added++;
            }
        });
        
        saveData(data);
        return added;
    } catch (e) {
        return 0;
    }
}

// ============================================================
// 🔥 KEEP ALIVE - Prevent Render from sleeping
// ============================================================
console.log('\n🤖 Bot is running!');
console.log('📌 Commands: /hack, /balance, /stock, /keys, /addkey');
console.log('💡 Send /start to see all commands');

// Keep alive by logging every 5 minutes
setInterval(() => {
    console.log('🔄 Bot is alive at', new Date().toISOString());
}, 300000);

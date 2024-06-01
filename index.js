const makeWASocket = require("@whiskeysockets/baileys").default;
const { DisconnectReason, useMultiFileAuthState, Browsers, saveCreds } = require("@whiskeysockets/baileys");
const chalk = require('chalk');
const fetch = require('node-fetch');
const qrcode = require("qrcode-terminal");
const pino = require('pino');
const fs = require("fs");
const axios = require('axios');
const countryEmoji = require('country-emoji');
const cron = require('node-cron');
const moment = require('moment-timezone');

const API_KEY = 'bddc3363-551c-4a1b-b5f5-7d809e727e19';
const API_URL = `https://api.cricapi.com/v1/cricScore?apikey=${API_KEY}`;

const prefix = ".";
let activeTasks = {};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const version = [3, 2022, 9];
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        auth: state,
        version: version
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
            // connection opened
        }

        if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != "undefined") {
            // connection closed, reconnecting setup...
            connectToWhatsApp();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', ({ messages }) => {
        const remoteJid = messages[0].key.remoteJid;

        messages.forEach(msg => {
            if (msg.message && msg.message.conversation) {
                const messageBody = msg.message.conversation;

                if (messageBody.startsWith(prefix + "livescore")) {
                    const args = messageBody.split(" ");
                    const command = args[1];
                    
                    if (command === "stop") {
                        if (activeTasks[remoteJid]) {
                            activeTasks[remoteJid].stop();
                            delete activeTasks[remoteJid];
                            sock.sendMessage(remoteJid, { text: `🛑 *LIVE SCORE UPDATES STOPPED* 🛑` });
                        } else {
                            sock.sendMessage(remoteJid, { text: `🛑 *NO ACTIVE LIVE SCORE UPDATES* 🛑` });
                        }
                        return;
                    }

                    const matchId = command;
                    const startTime = args[2];
                    if (!matchId || !startTime) {
                        sock.sendMessage(remoteJid, { text: `🛑 *MATCH ID OR START TIME NOT PROVIDED* 🛑\n\n> .livescore {match_id} {start_time}` });
                        return;
                    }

                    const startTimeSL = moment.tz(startTime, 'HH:mm', 'Asia/Colombo');

                    const task = cron.schedule('*/5 * * * *', () => {
                        const nowSL = moment.tz('Asia/Colombo');
                        if (nowSL.isBefore(startTimeSL)) return;

                        axios.get(`${API_URL}&id=${matchId}`)
                            .then(response => {
                                const matches = response.data.data;

                                if (!matches || matches.length === 0) {
                                    console.error('No matches data found');
                                    sock.sendMessage(remoteJid, { text: `🛑 *NO MATCH DATA FOUND* 🛑\n\n> .livescore {match_id} {start_time}` });
                                    return;
                                }

                                const match = matches.find(m => m.id === matchId);

                                if (!match) {
                                    console.error('No match data found');
                                    sock.sendMessage(remoteJid, { text: `🛑 *NO MATCH DATA FOUND* 🛑\n\n> .livescore {match_id} {start_time}` });
                                    return;
                                }

                                const team1 = match.t1;
                                const team2 = match.t2;
                                const status = match.status;
                                const series = match.series;
                                const team1Score = match.t1s || 'N/A';
                                const team2Score = match.t2s || 'N/A';

                                const team1Name = team1.match(/(.*?) \[/)[1];
                                const team2Name = team2.match(/(.*?) \[/)[1];

                                const team1Emoji = countryEmoji.flag(team1Name) || '';
                                const team2Emoji = countryEmoji.flag(team2Name) || '';

                                const liveUpdate = `
            🏏 *𝘓𝘐𝘝𝘌 𝘜𝘗𝘋𝘈𝘛𝘌𝘚* 🏏

*${team1Name}* ${team1Emoji} 𝘝𝘚 *${team2Name}* ${team2Emoji}
(${series})

> *${team1Name}* 🏏: ${team1Score}
> *${team2Name}* 🏏: ${team2Score}

✉️ ${status}

© ⚽ *SPORTS WORLD*🏏

https://chat.whatsapp.com/C2T0r1c2vLj8RdC3CII2Ky
                                `;

                                sock.sendMessage(remoteJid, { text: `${liveUpdate}` });
                            })
                            .catch(error => {
                                sock.sendMessage(remoteJid, { text: `🛑 *ERROR OCCURRED* 🛑\n\n> .livescore {match_id} {start_time}` });
                                console.error('Error fetching match details:', error);
                            });
                    });

                    activeTasks[remoteJid] = task;
                    task.start();
                    sock.sendMessage(remoteJid, { text: `✅ *LIVE SCORE UPDATES* 🏏\n\n> Starting at: ${startTimeSL.format('HH:mm')} Sri Lanka Time` });
                } else if (messageBody.startsWith(prefix + "matches")) {
                    axios.get(API_URL)
                        .then(response => {
                            const matches = response.data.data;

                            if (!matches || matches.length === 0) {
                                console.error('No matches data found');
                                sock.sendMessage(remoteJid, { text: `🛑 *NO MATCH DATA FOUND* 🛑\n\n> .livescore {match_id} {start_time}` });
                                return;
                            }

                            const matchList = matches.map(match => {
                                const team1Name = match.t1.match(/(.*?) \[/)[1];
                                const team2Name = match.t2.match(/(.*?) \[/)[1];
                                return `${team1Name} vs ${team2Name} *${match.id}*`;
                            }).join('\n');

                            sock.sendMessage(remoteJid, { text: matchList });
                        })
                        .catch(error => {
                            sock.sendMessage(remoteJid, { text: `🛑 *ERROR OCCURRED* 🛑\n\n> .livescore {match_id} {start_time}` });
                            console.error('Error fetching match list:', error);
                        });
                }
            }
        });
    });
}

connectToWhatsApp();
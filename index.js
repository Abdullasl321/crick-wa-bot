const makeWASocket = require("@whiskeysockets/baileys").default;
const { DisconnectReason, useMultiFileAuthState, Browsers, saveCreds } = require("@whiskeysockets/baileys");
const chalk = require('chalk');
const fetch = require('node-fetch');
const qrcode = require("qrcode-terminal");
const pino = require('pino');
const fs = require("fs");
const axios = require('axios');
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

    sock.ev.on('creds.update', saveCreds);

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

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const remoteJid = messages[0].key.remoteJid;

        if (messages.length > 0 && messages[0].message) {
            const messageContent = messages[0].message.conversation;
            if (messages.length > 0) {
                const senderRemoteJid = messages[0].key.remoteJid;

                const groupMessageContent = messages
                    .map((message) => {
                        // Check if the message is an instance of ExtendedTextMessage
                        if (message.message.extendedTextMessage) {
                            // If it is, extract the text property
                            return message.message.extendedTextMessage.text;
                        } else {
                            // Otherwise, return an empty string or handle the case accordingly
                            return "";
                        }
                    })
                    .filter((content) => content.trim() !== "");

                const grpmsg = groupMessageContent.join("\n");
        messages.forEach(async (msg) => {


                if(grpmsg.startsWith(prefix + "alive")){
                    sock.sendMessage(remoteJid, {text:"*CricBot is alive now!*"})
                }

                if (grpmsg.startsWith(prefix + "livescore")) {
                    const args = grpmsg.split(" ");
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
                    const updateDuration = args[3] || '5'; // Default update duration is 5 minutes
                    if (!matchId || !startTime) {
                        sock.sendMessage(remoteJid, { text: `🛑 *MATCH ID OR START TIME NOT PROVIDED* 🛑\n\n> .livescore {match_id} {start_time} {update_duration_time}` });
                        return;
                    }

                    const startTimeSL = moment.tz(startTime, 'HH:mm', 'Asia/Colombo');

                    const task = cron.schedule(`*/${updateDuration} * * * *`, async () => {
                        const nowSL = moment.tz('Asia/Colombo');
                        if (nowSL.isBefore(startTimeSL)) return;

                        try {
                            const response = await axios.get(`${API_URL}&id=${matchId}`);
                            const matches = response.data.data;

                            if (!matches || matches.length === 0) {
                                console.error('No matches data found');
                                sock.sendMessage(remoteJid, { text: `🛑 *NO MATCH DATA FOUND* 🛑\n\n> .livescore {match_id} {start_time} {update_duration_time}` });
                                return;
                            }

                            const match = matches.find(m => m.id === matchId);

                            if (!match) {
                                console.error('No match data found');
                                sock.sendMessage(remoteJid, { text: `🛑 *NO MATCH DATA FOUND* 🛑\n\n> .livescore {match_id} {start_time} {update_duration_time}` });
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

                            

                            const liveUpdate = `            🏏 *𝘓𝘐𝘝𝘌 𝘜𝘗𝘋𝘈𝘛𝘌𝘚* 🏏

*${team1Name}* vs *${team2Name}*
(${series})

> *${team1Name}* 🏏: ${team1Score}
> *${team2Name}* 🏏: ${team2Score}

✉️ ${status}

© ⚽ *SPORTS WORLD*🏏

https://chat.whatsapp.com/C2T0r1c2vLj8RdC3CII2Ky`;

                            sock.sendMessage(remoteJid, { text: `${liveUpdate}` });
                        } catch (error) {
                            sock.sendMessage(remoteJid, { text: `🛑 *ERROR OCCURRED* 🛑\n\n> .livescore {match_id} {start_time} {update_duration_time}` });
                            console.error('Error fetching match details:', error);
                        }
                    });

                    activeTasks[remoteJid] = task;
                    task.start();
                    sock.sendMessage(remoteJid, { text: `✅ *LIVE SCORE UPDATES* 🏏\n\n> Starting at: ${startTimeSL.format('HH:mm')} Sri Lanka Time\n> Update Duration: ${updateDuration} minutes` });
                    }
                });
            }
        }
    });
}
connectToWhatsApp();

"use strict";

require('dotenv').config();
const log = require('winston');
const WebSocket = require('ws');

const authenticated = {};
const channelBindings = {};

log.addColors({"error":"red", "warning":"yellow", "info":"green", "verbose":"white", "debug":"blue", "silly":"gray"});

log.remove(log.transports.Console);

log.add(log.transports.Console, {
    level: process.env.VERBOSE_LEVEL,
    prettyPrint: true,
    colorize: true,
    timestamp: true
});

log.add(log.transports.File, {
    level: process.env.VERBOSE_LEVEL,
    prettyPrint: true,
    filename: process.env.STORAGE_DIR + process.env.LOG_FILE,
    timestamp: true
});

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 }, () => {
    log.info('Server started on port ' + wss.options.port);
});

wss.on('connection', (ws) => {

    authenticated[ws] = false;

    log.debug('A client connected');

    ws.on('message', (message) => {

        const json = JSON.parse(message);

        if (json.type == 'authentication') {
            if (json.data.token == process.env.APP_KEY) {
                log.debug('Successfully authenticated client');
                sendResponse(ws, true, {});
                authenticated[ws] = true;
            }
            else {
                log.debug('Failed to authenticate client');
                sendResponse(ws, false, {'error': 'Invalid token'});
            }
        }

        if (json.type == 'bindings') {
            log.debug('Successfully binded client');
            channelBindings[ws] = json.data.bindings;
            sendResponse(ws, true, {'response':'Successfully binded to ' + channelBindings[ws].join(', ')});
        }

        if (json.type == 'message') {
            if (!authenticated[ws]) {
                log.debug('Client attempted to send unauthenticated message');
                sendResponse(ws, false, {'error': 'Unauthenticated response'});
            } else {
                log.debug('Successfully broadcasted to all');
                sendResponse(ws, true, {});
                broadcastToAll(ws, json.channel, json.data);
            }
        }

    });
});

function sendResponse(ws, success, data) {
    ws.send(JSON.stringify({'success':success, 'response':data}));
}

function broadcastToAll(origin, channel, message) {
    wss.clients.forEach((client) => {
        if (client != origin && isListening(client, channel) && client.readyState === WebSocket.OPEN) {
            log.debug('Sent to client');
            client.send(JSON.stringify(message));
        }
    });
}

function isListening(client, channel) {
    if (!channelBindings[client] || channelBindings[client].length == 0 || channelBindings[client].includes(channel)) {
        return true;
    } else  {
        return false;
    }
}

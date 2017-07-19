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

log.add(log.transports.File, { filename: process.env.STORAGE_DIR + process.env.LOG_FILE});

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
                channelBindings[ws] = json.data.bindings;
            }
            else {
                log.debug('Failed to authenticate client');
                sendResponse(ws, false, {'error': 'Invalid token'});
            }
        }

        if (json.type == 'message') {
            if (!authenticated[ws]) {
                log.debug('Client attempted to send unauthenticated message');

                sendResponse(ws, false, {'error': 'Unauthenticated response'});

                return;
            }

            broadcastToAll(json.channel, json.data);
        }

    });
});

function sendResponse(ws, success, data) {
    ws.send(JSON.stringify({'success':success, 'response':data}));
}

function broadcastToAll(channel, message) {
    wss.clients.forEach((client) => {
        if (channelBindings[client].includes(channel) && client.readyState === WebSocket.OPEN) {
            log.debug('Sent to client');
            client.send(JSON.stringify(message));
        }
    });
}

/*
wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};
*/

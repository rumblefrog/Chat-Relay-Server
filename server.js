"use strict";

require('dotenv').config();
const net = require('net');
const log = require('winston');

const clients = [];
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

const server = net.createServer().listen(process.env.PORT || 8080);

server.on('listening', () => {
    log.info('Server started on port ' + server.address().port);
});

server.on('connection', (socket) => {

    socket.name = socket.remoteAddress + ":" + socket.remotePort;

    clients.push(socket);

    authenticated[socket] = false;
    channelBindings[socket] = [];

    log.debug('A client connected');

    socket.on('data', (data) => {

        var json;

        try {
            json = JSON.parse(data);
        } catch (e) {
            sendResponse(socket, false, 'invalid', {'error': 'Invalid payload'});
            return;
        }

        if (json.type == 'authentication') {
            if (json.data.token == process.env.APP_KEY) {
                log.debug('Successfully authenticated client');
                sendResponse(socket, true, 'authentication', {});
                authenticated[socket] = true;
            }
            else {
                log.debug('Failed to authenticate client');
                sendResponse(socket, false, 'authentication', {'error': 'Invalid token'});
            }
        }

        if (json.type == 'bindings') {
            log.debug('Successfully binded client');
            channelBindings[socket] = json.data.bindings;
            sendResponse(socket, true, 'bindings', {'response':'Successfully binded to ' + channelBindings[socket].join(', ')});
        }

        if (json.type == 'message') {
            if (!authenticated[socket]) {
                log.debug('Client attempted to send unauthenticated message');
                sendResponse(socket, false, 'message', {'error': 'Unauthenticated response'});
            } else {
                log.debug('Successfully broadcasted to all');
                sendResponse(socket, true, 'sent', {});
                broadcastToAll(socket, json.data.channel, {'success':true, 'type':'message', 'response':json.data});
            }
        }

    });

    socket.on('end', () => {
        clients.splice(clients.indexOf(socket), 1);
        log.debug('Removed client from array');
    });

    socket.on('error', (err) => {
        clients.splice(clients.indexOf(socket), 1);
        log.debug('Removed client from array');
        log.warn('An error has occured: ' + err);
    });
});

function sendResponse(socket, success, type, data) {
    socket.write(JSON.stringify({'success':success, 'type':type, 'response':data}));
}

function broadcastToAll(origin, channel, message) {
    clients.forEach((client) => {
        if (client != origin && isListening(client, channel)) {
            log.debug('Sent to client');
            client.write(JSON.stringify(message));
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

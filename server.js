"use strict";

require('dotenv').config();
const net = require('net');
const log = require('winston');
const async = require('async');

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

    socket.setNoDelay(true);

    socket.name = socket.remoteAddress + ":" + socket.remotePort;

    clients.push(socket);

    log.info('A client connected');

    socket.on('data', (data) => {

        var json;

        try {
            json = JSON.parse(data);
        } catch (e) {
            sendResponse(socket, false, 'invalid', {'error': 'Invalid payload'});
            return;
        }

        if (json.type == 'message') {
            if (json.token != process.env.APP_KEY) {
                log.warn('Client attempted to send unauthenticated message');
                sendResponse(socket, false, 'message', {'error': 'Unauthenticated response'});
            } else {
                log.debug('Successfully broadcasted to all on channel ' + json.data.channel);
                sendResponse(socket, true, 'sent', {});
                broadcastToAll(socket, parseInt(json.data.channel), {'success':true, 'type':'message', 'response':json.data});
            }
        }

    });

    socket.on('end', () => {
        clients.splice(clients.indexOf(socket), 1);
        log.debug('Removed client from array');
    });

    socket.on('error', (err) => {
        clients.splice(clients.indexOf(socket), 1);
        log.warn(err);
    });
});

function sendResponse(socket, success, type, data) {
    socket.write(JSON.stringify({'success':success, 'type':type, 'response':data}) + '\n');
}

function broadcastToAll(origin, channel, message) {
    let i = 0;
    async.whilst(
        () => { return i < clients.length; },
        callback => {
            let client = clients[i++];
            if (client != origin) {
                client.write(JSON.stringify(message) + '\n', () => {
                    callback(null, i);
                });
            } else
                callback(null, i);
        },
        () => {
            log.debug('Finished broadcasting');
        }
    );
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isListening(client, channel) {
    if (!channelBindings[client] || channelBindings[client].length == 0 || channelBindings[client].includes(channel)) {
        return true;
    } else  {
        return false;
    }
}

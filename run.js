const config = require("./config.json");
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');

const API_KEY_HEADER_KEY = "X-Tetteblue-Key";
const API_KEY_HEADER_VALUE = "ea6d35a3-c4c9-45dd-9a20-5165b14f271a";



const app = express();
const jsonParser = bodyParser.json();

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'tetteblue_scrapper',
    password: 'tetteblue_scrapper',
    database: 'tetteblue_scrapper',
    charset: 'utf8mb4_bin'
});

connection.connect();

// use it before all route definitions
app.use(cors({ origin: '*' }));

app.get('/api/get_messages', jsonParser, getMessages);
app.post('/api/get_messages', jsonParser, getMessages);

async function getMessages(req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    // Validate the request
    const request = req.body;
    if (req.header(API_KEY_HEADER_KEY) !== API_KEY_HEADER_VALUE) {
        res.sendStatus(401);
        return;
    }
    if (request.offset == null || request.offset == undefined || typeof(request.offset) != 'number' || request.offset < 0) {
        request.offset = 0;
    }
    if (request.limit == null || request.limit == undefined || typeof(request.limit) != 'number' || request.limit > config.max_limit) {
        request.limit = config.max_limit;
    }
    if (request.channel == null || request.channel == undefined || typeof(request.channel) != 'string' || request.channel.length == 0) {
        res.sendStatus(400);
        return;
    }
    const channelId = await getChannelId(request.channel);
    if (channelId == null) {
        res.sendStatus(400);
        return;
    }
    if (request.dateStart != null && request.dateStart != undefined) {
        if (typeof(request.dateStart) != 'string') {
            request.dateStart = undefined;
        }

        request.dateStart = new Date(request.dateStart);
    }
    if (request.dateEnd != null && request.dateEnd != undefined) {
        if (typeof(request.dateEnd) != 'string') {
            request.dateEnd = undefined;
        }

        request.dateEnd = new Date(request.dateEnd);
    }
    if (request.search != null && request.search != undefined) {
        if (typeof(request.username) != 'string') {
            res.sendStatus(400);
            return;
        }
    }

    const parameters = [];
    var sqlQuery = 'SELECT * FROM `message`';
    var conditions = " WHERE channel_id = ?";
    parameters.push(channelId);

    if (request.dateStart != null && request.dateStart != undefined) {
        parameters.push(request.dateStart);
        conditions += ' AND date_sent >= ?';
    }
    if (request.dateEnd != null && request.dateEnd != undefined) {
        parameters.push(request.dateEnd);
        conditions += ' AND date_sent <= ?';
    }
    if (request.search != null && request.search != undefined) {
        parameters.push("%" + request.search + "%");
        conditions += ' AND message LIKE ?';
    }

    parameters.push(request.limit, request.offset);
    sqlQuery += conditions + ' ORDER BY `message`.`date_sent` DESC LIMIT ? OFFSET ?';
    var messages;
    connection.query(sqlQuery, parameters, function(error, results, fields) {
        if (error) throw error;
        messages = results;

        connection.query('SELECT COUNT(*) FROM `message`' + conditions, parameters, function(error, results, fields) {
            if (error) throw error;

            res.send({
                "rows": results[0]["COUNT(*)"],
                "messages": messages
            });
        });
    });
}



app.get('/api/get_messages_by_username', jsonParser, getMessagesByUsername);
app.post('/api/get_messages_by_username', jsonParser, getMessagesByUsername);

async function getMessagesByUsername(req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    // Validate the request
    const request = req.body;
    if (req.header(API_KEY_HEADER_KEY) !== API_KEY_HEADER_VALUE) {
        res.sendStatus(401);
        return
    }
    if (request.username == null || request.username == undefined || typeof(request.username) != 'string') {
        res.sendStatus(400);
        return
    }
    if (request.offset == null || request.offset == undefined || typeof(request.offset) != 'number' || request.offset < 0) {
        request.offset = 0;
    }
    if (request.limit == null || request.limit == undefined || typeof(request.limit) != 'number' || request.limit > config.max_limit) {
        request.limit = config.max_limit;
    }
    if (request.channel == null || request.channel == undefined || typeof(request.channel) != 'string' || request.channel.length == 0) {
        res.sendStatus(400);
        return;
    }
    const channelId = await getChannelId(request.channel);
    if (channelId == null) {
        res.sendStatus(400);
        return;
    }
    if (request.dateStart != null && request.dateStart != undefined) {
        if (typeof(request.dateStart) != 'string') {
            request.dateStart = undefined;
        }

        request.dateStart = new Date(request.dateStart);
    }
    if (request.dateEnd != null && request.dateEnd != undefined) {
        if (typeof(request.dateEnd) != 'string') {
            request.dateEnd = undefined;
        }

        request.dateEnd = new Date(request.dateEnd);
    }
    if (request.search != null && request.search != undefined) {
        if (typeof(request.username) != 'string') {
            res.sendStatus(400);
            return
        }
    }

    const parameters = [request.username, channelId];
    var sqlQuery = 'SELECT * FROM `message`';
    var conditions = " WHERE username = ? AND channel_id = ?";

    if (request.dateStart != null && request.dateStart != undefined) {
        parameters.push(request.dateStart);
        conditions += ' AND date_sent >= ?';
    }
    if (request.dateEnd != null && request.dateEnd != undefined) {
        parameters.push(request.dateEnd);
        conditions += ' AND date_sent <= ?';
    }
    if (request.search != null && request.search != undefined) {
        parameters.push("%" + request.search + "%");
        conditions += ' AND message LIKE ?';
    }

    parameters.push(request.limit, request.offset);
    sqlQuery += conditions + ' ORDER BY `message`.`date_sent` DESC LIMIT ? OFFSET ?';

    var messages;
    connection.query(sqlQuery, parameters, function(error, results, fields) {
        if (error) throw error;
        messages = results;

        connection.query('SELECT COUNT(*) FROM `message`' + conditions, parameters, function(error, results, fields) {
            if (error) throw error;

            res.send({
                "rows": results[0]["COUNT(*)"],
                "messages": messages
            });
        });
    });
}



app.get('/api/search_username', jsonParser, searchUsername);
app.post('/api/search_username', jsonParser, searchUsername);

async function searchUsername(req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    // Validate the request
    const request = req.body;
    if (req.header(API_KEY_HEADER_KEY) !== API_KEY_HEADER_VALUE) {
        res.sendStatus(401);
        return
    }
    if (request.username == null || request.username == undefined || typeof(request.username) != 'string') {
        res.sendStatus(400);
        return
    }
    if (request.channel == null || request.channel == undefined || typeof(request.channel) != 'string' || request.channel.length == 0) {
        res.sendStatus(400);
        return;
    }
    const channelId = await getChannelId(request.channel);
    if (channelId == null) {
        res.sendStatus(400);
        return;
    }

    connection.query('SELECT DISTINCT username AS user_name, (SELECT user_id FROM `message` WHERE username = user_name ORDER BY user_id DESC LIMIT 1) AS user_id FROM `message` WHERE username LIKE ? AND channel_id = ? LIMIT 10', [request.username.toLowerCase() + '%', channelId], function(error, results, fields) {
        if (error) throw error;

        res.send(results);
    });

}




if (config.ssl_enabled) {
    const privateKey = fs.readFileSync(config.ssl.keyPath);
    const certificate = fs.readFileSync(config.ssl.certPath);

    https.createServer({
        key: privateKey,
        cert: certificate
    }, app).listen(config.port, () => {
        console.log(`Tetteblue-WebService listening on port ${config.port}`)
    });
} else {
    app.listen(config.port, () => {
        console.log(`Tetteblue-WebService listening on port ${config.port}`)
    });
}



function getChannelId(channelName) {
    return new Promise((resolve) => {
        connection.query('SELECT id FROM channel WHERE name = ?', ["#" + channelName], (error, results, _) => {
            if (error) {
                resolve(null);
                return;
            }
            if (results.length == 0) {
                resolve(null);
                return;
            }
            resolve(results[0].id);
        });
    });
}
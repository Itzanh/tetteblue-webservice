const config = require("./config.json");
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const fs = require('fs');

// TODO! Grabar audio del tette
/*
ffmpeg -re -i "https://usher.ttvnw.net/api/channel/hls/auronplay.m3u8?allow_source=true&fast_bread=true&p=5084257&play_session_id=ff54a3416de6fe8a80e526e22789e5a5&player_backend=mediaplayer&playlist_include_framerate=true&reassignments_supported=true&sig=fb1754698d605b8f41a9de2c612bb201f55024d4&supported_codecs=avc1&token=%7B%22adblock%22%3Afalse%2C%22authorization%22%3A%7B%22forbidden%22%3Afalse%2C%22reason%22%3A%22%22%7D%2C%22blackout_enabled%22%3Afalse%2C%22channel%22%3A%22auronplay%22%2C%22channel_id%22%3A459331509%2C%22chansub%22%3A%7B%22restricted_bitrates%22%3A%5B%5D%2C%22view_until%22%3A1924905600%7D%2C%22ci_gb%22%3Afalse%2C%22geoblock_reason%22%3A%22%22%2C%22device_id%22%3A%226ead57e8c582d2cf%22%2C%22expires%22%3A1662925654%2C%22extended_history_allowed%22%3Afalse%2C%22game%22%3A%22%22%2C%22hide_ads%22%3Afalse%2C%22https_required%22%3Atrue%2C%22mature%22%3Afalse%2C%22partner%22%3Afalse%2C%22platform%22%3A%22web%22%2C%22player_type%22%3A%22site%22%2C%22private%22%3A%7B%22allowed_to_view%22%3Atrue%7D%2C%22privileged%22%3Afalse%2C%22role%22%3A%22%22%2C%22server_ads%22%3Atrue%2C%22show_ads%22%3Atrue%2C%22subscriber%22%3Afalse%2C%22turbo%22%3Afalse%2C%22user_id%22%3A147711645%2C%22user_ip%22%3A%2270.34.237.107%22%2C%22version%22%3A2%7D&warp=true&cdm=wv&player_version=1.13.0" -c:v none -c:a mp3 output.mp3
*/

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

function getMessages(req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    // Validate the request
    const request = req.body;
    if (req.header(API_KEY_HEADER_KEY) !== API_KEY_HEADER_VALUE) {
        res.sendStatus(401);
        return
    }
    if (request.offset == null || request.offset == undefined || typeof(request.offset) != 'number' || request.offset < 0) {
        request.offset = 0;
    }
    if (request.limit == null || request.limit == undefined || typeof(request.limit) != 'number' || request.limit > config.max_limit) {
        request.limit = config.max_limit;
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

    const parameters = [];
    var sqlQuery = 'SELECT * FROM `message`';
    var conditions = "";

    if (request.dateStart != null && request.dateStart != undefined) {
        parameters.push(request.dateStart);
        conditions += ' WHERE date_sent >= ?';

        if (request.dateEnd != null && request.dateEnd != undefined) {
            parameters.push(request.dateEnd);
            conditions += ' AND date_sent <= ?';
        }
    } else if (request.dateEnd != null && request.dateEnd != undefined) {
        parameters.push(request.dateEnd);
        conditions += ' WHERE date_sent <= ?';
    }
    if (request.search != null && request.search != undefined) {
        parameters.push("%" + request.search + "%");
        if (conditions == "") {
            conditions += ' WHERE message LIKE ?';
        } else {
            conditions += ' AND message LIKE ?';
        }
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

function getMessagesByUsername(req, res) {
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

    const parameters = [request.username];
    var sqlQuery = 'SELECT * FROM `message`';
    var conditions = " WHERE username = ?";

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

function searchUsername(req, res) {
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

    connection.query('SELECT DISTINCT username AS user_name, (SELECT user_id FROM `message` WHERE username = user_name ORDER BY user_id DESC LIMIT 1) AS user_id FROM `message` WHERE username LIKE ? LIMIT 10', [request.username.toLowerCase() + '%'], function(error, results, fields) {
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
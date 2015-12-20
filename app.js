'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _readline = require('readline');

var _readline2 = _interopRequireDefault(_readline);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var arrTopics = 'undefined' !== typeof process.argv[2] ? process.argv[2].split(',') : _config2.default.likes;
var phrases = _config2.default.phrases;
var log = _config2.default.log;
var bannedPhrases = _config2.default.bannedPhrases;
var autoPhrases = _config2.default.autoPhrases;
var endpoint = 'http://front4.omegle.com';
var strUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36';
var headers = {
    'Referer': 'http://www.omegle.com/',
    'User-Agent': strUserAgent,
    'Cache-Control': 'no-cache',
    'Origin': 'http://www.omegle.com',
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
};
var app;
var App = (function () {
    function App() {
        _classCallCheck(this, App);

        this.randid = Math.floor(Math.random() * 1000000000 + 1000000000).toString(36).toUpperCase();
        this.clientID = null;
        this.isConnected = false;
        this.rl = null;
        this.logFilename = null;
    }

    _createClass(App, [{
        key: 'start',
        value: function start() {
            this.login();
            this.setupEvents();
        }
    }, {
        key: 'login',
        value: function login() {
            var _this = this;

            var query = {
                rcs: 1,
                firstevents: 1,
                spid: '',
                randid: this.randid,
                topics: JSON.stringify(arrTopics),
                lang: 'en'
            };
            console.log('Connecting with likes ' + arrTopics.join(', '));
            _request2.default.post(endpoint + '/start?' + _querystring2.default.encode(query), {}, function (err, response, body) {
                if (err) throw err;

                body = JSON.parse(body);
                console.log('Response received. Initialising.');
                _this.clientID = body.clientID;
                if ('undefined' !== typeof body.events) {
                    _this.parseEvents(body.events);
                }
                _this.events();
            });
        }
    }, {
        key: 'connected',
        value: function connected() {
            this.isConnected = true;
            console.log('Connected.');
            this.init();
        }
    }, {
        key: 'commonLikes',
        value: function commonLikes(arrCommonLikes) {
            this.print('Common likes: ' + arrCommonLikes.join(', '));
            this.writeToFile('Common likes: ' + arrCommonLikes.join(', '));
        }
    }, {
        key: 'strangerTyping',
        value: function strangerTyping() {
            if (!this.isConnected) {
                this.connected();
            }
            this.print('Stranger typing...');
        }
    }, {
        key: 'gotMessage',
        value: function gotMessage(msg) {
            if (!this.isConnected) {
                this.connected();
            }
            for (var i in bannedPhrases) {
                if (-1 !== msg.indexOf(bannedPhrases[i])) {
                    this.print('Stranger said a banned phrase, disconnecting: ' + msg);
                    this.writeToFile('Stranger said a banned phrase, disconnecting: ' + msg);
                    return this.disconnect();
                }
            }
            for (var phrase in autoPhrases) {
                if (-1 !== msg.toLowerCase().indexOf(phrase.toLowerCase())) {
                    this.print('Stranger (will auto-reply): ' + msg);
                    this.writeToFile('Stranger (will auto-reply): ' + msg);
                    return this.send(autoPhrases[phrase]);
                }
            }
            this.print('Stranger: ' + msg);
            this.writeToFile('Stranger: ' + msg);
        }
    }, {
        key: 'print',
        value: function print(msg) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            console.log(msg);
            this.rl.prompt(true);
        }
    }, {
        key: 'parseEvents',
        value: function parseEvents(body) {
            for (var i = 0; i < body.length; i++) {
                switch (body[i][0]) {
                    case 'waiting':
                        console.log('Waiting...');
                        break;
                    case 'connected':
                        this.connected();
                        break;
                    case 'commonLikes':
                        this.commonLikes(body[i][1]);
                        break;
                    case 'typing':
                        this.strangerTyping();
                        break;
                    case 'stoppedTyping':
                        this.print('Stranger stopped typing.');
                        break;
                    case 'gotMessage':
                        this.gotMessage(body[i][1]);
                        break;
                    case 'strangerDisconnected':
                        console.log('Stranger disconnected');
                        this.writeToFile('Stranger disconnected');
                        this.disconnect();
                        break;
                    case 'statusInfo':
                    case 'identDigests':
                        break;
                    case 'error':
                        console.log('Encountered an error: ' + body[i][1]);
                        console.log('Last request was ', body);
                        break;
                    default:
                        console.log(body[i]);
                        break;
                }
            }
        }
    }, {
        key: 'events',
        value: function events() {
            var _this2 = this;

            var body = 'id=' + _querystring2.default.escape(this.clientID);
            _request2.default.post(endpoint + '/events', { body: body, headers: headers }, function (err, response, body) {
                if (err) throw err;
                try {
                    body = JSON.parse(body);
                } catch (err) {
                    console.log('Body was not JSON.');
                    console.log(body);
                    process.exit(0);
                }

                if (null === body) {
                    console.log('Body was NULL');
                    process.exit(1);
                } else {
                    _this2.parseEvents(body);
                }
                _this2.events();
            });
        }
    }, {
        key: 'typing',
        value: function typing() {
            var localHeader = headers;
            localHeader.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
            _request2.default.post(endpoint + '/typing', {
                body: 'id=' + _querystring2.default.escape(this.clientID),
                headers: localHeader
            }, function (err, response, body) {});
        }
    }, {
        key: 'bored',
        value: function bored() {
            var _this3 = this;

            var body = 'id=' + _querystring2.default.escape(this.clientID);
            _request2.default.post(endpoint + '/stoplookingforcommonlikes', { body: body, headers: headers }, function (err, response, body) {
                _this3.print('Looking for a random');
            });
        }
    }, {
        key: 'disconnect',
        value: function disconnect() {
            var _this4 = this;

            var body = 'id=' + _querystring2.default.escape(this.clientID);
            _request2.default.post(endpoint + '/disconnect', { body: body, headers: headers }, function (err, response, body) {
                console.log('Disconnected.');
                _this4.writeToFile('Disconnected');
                process.exit(0);
            });
        }
    }, {
        key: 'send',
        value: function send(text) {
            var _this5 = this;

            var localHeader = headers,
                phrase = null;
            localHeader.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
            if ('/' == text[0]) {
                phrase = phrases[text.substr(1, text.length)];
                if ('undefined' !== typeof phrase) {
                    text = phrase;
                }
            }
            _request2.default.post(endpoint + '/send', {
                body: 'msg=' + _querystring2.default.escape(text) + '&id=' + _querystring2.default.escape(this.clientID),
                headers: localHeader
            }, function (err, response, body) {
                _this5.print("You: " + text);
                _this5.writeToFile('You: ' + text);
            });
        }
    }, {
        key: 'writeToFile',
        value: function writeToFile(data) {
            if (false === log) return;

            _fs2.default.appendFile(this.logFilename, data + "\n", {
                mode: 384
            }, function () {});
        }
    }, {
        key: 'startPhrase',
        value: function startPhrase() {
            if ('undefined' !== typeof phrases.start) {
                this.send(phrases.start);
            }
        }
    }, {
        key: 'init',
        value: function init() {
            var _this6 = this;

            this.rl = _readline2.default.createInterface({
                input: process.stdin,
                output: process.stdout
            }).on('line', function (data) {
                _this6.send(data);
                _this6.rl.prompt(true);
            }).on('pause', function () {
                _this6.typing();
            }).on('close', function () {
                _this6.disconnect();
            }).on('SIGINT', function () {
                _this6.disconnect();
            });

            this.startPhrase();
        }
    }, {
        key: 'setupEvents',
        value: function setupEvents() {
            var _this7 = this;

            var date = new Date();
            this.logFilename = __dirname + '/logs/' + date.toISOString() + '.log';
            console.log('Logging to ' + this.logFilename);

            process.on('SIGINT', function () {
                _this7.disconnect();
            });
        }
    }]);

    return App;
})();

app = new App();
app.start();


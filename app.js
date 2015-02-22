var request = require('request'),
    readline = require('readline'),
    fs = require('fs'),
    querystring = require('querystring'),
    objConfig = require('./config'),
    arrTopics = ('undefined' !== typeof process.argv[2])?process.argv[2].split(','):objConfig.likes,
    objPhrases = objConfig.phrases,
    bLog = objConfig.log,
    App = function() {
        var endpoint = 'http://front2.omegle.com',
            strUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.132 Safari/537.36',
            headers = {
                'Referer': 'http://www.omegle.com/',
                'User-Agent': strUserAgent,
                'Cache-Control': 'no-cache',
                'Origin': 'http://www.omegle.com',
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            };

        this.randid = (Math.floor(Math.random() * 100000000000 + 100000000000)).toString(36).toUpperCase();
        this.clientID = null;
        this.isConnected = false;
        this.rl = null;
        this.logFilename = null;

        this.start = function() {
            this.login();
            this.setupEvents();
        }.bind(this);

        this.login = function() {
            var query = {
                    rcs: 1,
                    firstevents: 1,
                    spid: '',
                    randid: this.randid,
                    topics: JSON.stringify(arrTopics),
                    lang: 'en'
                };
            console.log('Connecting with likes '+arrTopics.join(', '));
            request.post(
                endpoint+'/start?'+querystring.encode(query),
                {},
                function(err, response, body) {
                    if (err) throw err;

                    body = JSON.parse(body);
                    console.log('Response received. Initialising.');
                    this.clientID = body.clientID;
                    if ('undefined' !== typeof this.events) {
                        this.parseEvents(body.events);
                    }
                    this.events();
                }.bind(this)
            );
        }.bind(this);

        this.connected = function() {
            this.isConnected = true;
            console.log('Connected.');
            this.init();
        }.bind(this);

        this.commonLikes = function(arrCommonLikes) {
            this.print('Common likes: '+arrCommonLikes.join(', '));
            this.writeToFile('Common likes: '+arrCommonLikes.join(', '));
        }.bind(this);

        this.strangerTyping = function() {
            if (!this.isConnected) {
                this.connected();
            }

            this.print('Stranger typing...');
        }.bind(this);

        this.gotMessage = function(msg) {
            if (!this.isConnected) {
                this.connected();
            }
            this.print('Stranger: '+msg);
            this.writeToFile('Stranger: '+msg);
        }.bind(this);

        this.print = function(msg) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            console.log(msg);
            this.rl.prompt(true);
        }.bind(this);

        this.parseEvents = function(body) {
            for (var i = 0; i < body.length; i++) {
                switch(body[i][0]) {
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
                    	console.log('Encountered an error: '+body[i][1]);
                    	console.log('Last request was ', this.lastResponse)
                    	break;
                    default:
                    	console.log(body[i]);
                        break;
                }
            }
        }.bind(this);

        this.lastResponse = null;

        this.events = function() {
            request.post(
                endpoint+'/events',
                {
                    body: 'id='+querystring.escape(this.clientID),
                    headers: headers
                },
                function(err, response, body) {
                    if (err) throw err;
                    this.lastResponse = response;
                    try {
                        body = JSON.parse(body);
                    } catch (err) {
                        console.log('Body was not JSON.');
                        console.log(body);
                        process.exit(0);
                    }

                    if (null === body) {
                        console.log('Body was NULL');
                    }

                    this.parseEvents(body);
                    this.events();
                }.bind(this)
            );
        }.bind(this);

        this.typing = function() {
            var lH = headers;
            lH.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
            request.post(
                endpoint+'/typing',
                {
                    body: 'id='+querystring.escape(this.clientID),
                    headers: lH
                },
                function(err, response, body) {
                }
            );
        }.bind(this);

        this.bored = function() {
            request.post(
                endpoint+'/stoplookingforcommonlikes',
                {
                    body: 'id='+querystring.escape(this.clientID),
                    headers: headers
                },
                function(err, response, body) {
                    this.print('Looking for a random');
                }.bind(this)
            );
        }.bind(this);

        this.disconnect = function() {
            request.post(
                endpoint+'/disconnect',
                {
                    body: 'id='+querystring.escape(this.clientID),
                    headers: headers
                },
                function(err, response, body) {
                    console.log('Disconnected.');
                    process.exit(0);
                }.bind(this)
            );

            this.writeToFile('Disconnected');
        }.bind(this);

        this.send = function(text) {
            var lH = headers,
                phrase = null;
            lH.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
            if ('/' == text[0]) {
                phrase = objPhrases[text.substr(1,text.length)];
                if ('undefined' !== typeof phrase) {
                    text = phrase;
                }
            }
            request.post(
                endpoint+'/send',
                {
                    body: 'msg='+querystring.escape(text)+'&id='+querystring.escape(this.clientID),
                    headers: lH
                },
                function(err, response, body) {
                    this.print("You: "+text);
                    this.writeToFile('You: '+text);
                }.bind(this)
            );
        }.bind(this);

        this.writeToFile = function(data) {
            if (false === bLog) {
                return;
            }

            fs.appendFile(
                this.logFilename,
                data + "\n",
                {
                    mode: 0600
                },
                function() {
                }
            );
        }.bind(this);

        this.startPhrase = function() {
            if ('undefined' !== typeof objPhrases.start) {
                this.send(objPhrases.start);
            }
        }.bind(this);

        this.init = function() {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            })
            .on('line', function(data) {
                this.send(data);
                this.rl.prompt(true);
            }.bind(this))
            .on('pause', function() {
                this.typing();
            }.bind(this))
            .on('close', function() {
                this.disconnect();
            }.bind(this))
            .on('SIGINT', function() {
                this.disconnect();
            }.bind(this));

            this.startPhrase();
        }.bind(this);

        this.setupEvents = function() {
            var date = new Date();
            this.logFilename = __dirname +
                '/logs/' +
                date.toISOString() +
                '.log';
            console.log('Logging to '+this.logFilename);

            process.on('SIGINT', function() {
                this.disconnect();
            }.bind(this));
        };
    },
    app = new App();
app.start();

var request = require('request'),
    readline = require('readline'),
    fs = require('fs'),
    querystring = require('querystring'),
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

        this.start = function() {
            this.login();
            this.setupEvents();
        }.bind(this);

        this.login = function() {
            var arrTopics = JSON.parse(fs.readFileSync(__dirname+'/likes.json')),
                query = {
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
                    this.events();
                }.bind(this)
            );
        }.bind(this);

        this.connected = function(arrCommonLikes) {
            console.log('Connected. Common likes: '+arrCommonLikes.join(', '));
            this.init();
        }.bind(this);

        this.gotMessage = function(msg) {
            console.log('Stranger: '+msg);
        };

        this.events = function() {
            request.post(
                endpoint+'/events',
                {
                    body: 'id='+querystring.escape(this.clientID),
                    headers: headers
                },
                function(err, response, body) {
                    if (err) throw err;
                    try {
                        body = JSON.parse(body);
                    } catch (err) {
                        console.log('Body was not JSON.');
                        process.exit(0);
                    }

                    if (null === body) {
                        console.log('Body was NULL');
                        this.disconnect();
                    }
                    else if ('waiting' == body[0][0]) {
                        console.log('Waiting...');
                    }
                    else if ('connected' == body[0][0]) {
                        this.connected(body[1][1]);
                    }
                    else if ('typing' == body[0][0]) {
                        console.log('Stranger typing...');
                    }
                    else if ('stoppedTyping' == body[0][0]) {
                        console.log('Stranger stopped typing.');
                    }
                    else if ('gotMessage' == body[0][0]) {
                        this.gotMessage(body[0][1]);
                    }
                    else if ('strangerDisconnected' == body[0][0]) {
                        console.log('Stranger disconnected');
                        this.disconnect();
                    }
                    else {
                        console.log(body);
                    }

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
                    console.log('Looking for a random');
                }
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
                }
            );
        }.bind(this);

        this.send = function(text) {
            var lH = headers;
            lH.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
            request.post(
                endpoint+'/send',
                {
                    body: 'msg='+querystring.escape(text)+'&id='+querystring.escape(this.clientID),
                    headers: lH
                },
                function(err, response, body) {
                }
            )
        }.bind(this);

        this.init = function() {
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            })
            .on('line', function(data) {
                this.send(data);
            }.bind(this))
            .on('pause', function() {
                this.typing();
            }.bind(this))
            .on('close', function() {
                this.disconnect();
            }.bind(this))
            .on('SIGINT', function() {
                this.disconnect();
            }.bind(this);
        }.bind(this);

        this.setupEvents = function() {
            process.on('SIGINT', function() {
                this.disconnect();
            }.bind(this));
        };
    },
    app = new App();
app.start();

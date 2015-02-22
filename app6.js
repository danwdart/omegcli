import * as request from 'request';
import * as readline from 'readline';
import * as fs from 'fs';
import * as querystring from 'querystring';
import * as objConfig from './config';

var arrTopics = ('undefined' !== typeof process.argv[3])?process.argv[3].split(','):objConfig.likes,
    {phrases, log} = objConfig,
    endpoint = 'http://front4.omegle.com',
    strUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.101 Safari/537.36',
    headers = {
        'Referer': 'http://www.omegle.com/',
        'User-Agent': strUserAgent,
        'Cache-Control': 'no-cache',
        'Origin': 'http://www.omegle.com',
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    app;

class App
{
	constructor()
	{
        this.randid = (Math.floor(Math.random() * 100000000000 + 100000000000)).toString(36).toUpperCase();
        this.clientID = null;
        this.isConnected = false;
        this.rl = null;
        this.logFilename = null;
	}

	start()
	{
		this.login();
        	this.setupEvents();
	}

	login()
	{
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
            (err, response, body) => {
                if (err) throw err;

                body = JSON.parse(body);
                console.log('Response received. Initialising.');
                this.clientID = body.clientID;
                if ('undefined' !== typeof this.events) {
                    this.parseEvents(body.events);
                }
                this.events();
            }
        );
	}

	connected()
	{
		this.isConnected = true;
        	console.log('Connected.');
        	this.init();
	}

	commonLikes(arrCommonLikes)
	{
		this.print('Common likes: '+arrCommonLikes.join(', '));
        	this.writeToFile('Common likes: '+arrCommonLikes.join(', '));
	}

	strangerTyping()
	{
		if (!this.isConnected) {
            		this.connected();
        	}
	   	this.print('Stranger typing...');
	}

	gotMessage(msg)
	{
		if (!this.isConnected) {
            this.connected();
        }
        this.print('Stranger: '+msg);
        this.writeToFile('Stranger: '+msg);
	}
		
	print(msg)
	{
	    process.stdout.clearLine();
        process.stdout.cursorTo(0);
        console.log(msg);
        this.rl.prompt(true);
	}

	parseEvents(body)
	{
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
                	console.log('Last request was ', body)
                	break;
                default:
                	console.log(body[i]);
                    break;
            }
        }
	}

	events()
	{
		var body = 'id='+querystring.escape(this.clientID);
		request.post(
            endpoint+'/events',
            {body, headers},
            (err, response, body) => {
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
                }
		else {
	                this.parseEvents(body);
		}
                this.events();
            }
        );
	}

	typing()
	{
		var lH = headers;
        lH.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
        request.post(
            endpoint+'/typing',
            {
                body: 'id='+querystring.escape(this.clientID),
                headers: lH
            },
            (err, response, body) => {}
        );
	}

	bored()
	{
		var body = 'id='+querystring.escape(this.clientID);
		request.post(
            endpoint+'/stoplookingforcommonlikes',
            {body, headers},
            (err, response, body) => {
                this.print('Looking for a random');
            }
        );
	}

	disconnect()
	{
		var body = 'id='+querystring.escape(this.clientID);
		request.post(
            endpoint+'/disconnect',
            {body, headers},
            (err, response, body) => {
                console.log('Disconnected.');
                this.writeToFile('Disconnected');
                process.exit(0);
            }
        );
	}

	send(text)
	{
		var lH = headers,
            phrase = null;
        lH.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
        if ('/' == text[0]) {
            phrase = phrases[text.substr(1,text.length)];
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
            (err, response, body) => {
                this.print("You: "+text);
                this.writeToFile('You: '+text);
            }
        );
	}

	writeToFile(data)
	{
		if (false === log) return;

        fs.appendFile(
            this.logFilename,
            data + "\n",
            {
                mode: 0600
            },
            () => {}
        );
	}

	startPhrase()
	{
	    if ('undefined' !== typeof phrases.start) {
	        this.send(phrases.start);
	    }
	}

	init()
	{
		this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        .on('line', (data) => {
            this.send(data);
            this.rl.prompt(true);
        })
        .on('pause', () => {
            this.typing();
        })
        .on('close', () => {
            this.disconnect();
        })
        .on('SIGINT', () => {
            this.disconnect();
        });

        this.startPhrase();
	}

	setupEvents()
	{
		var date = new Date();
        this.logFilename = __dirname +
            '/logs/' +
            date.toISOString() +
            '.log';
        console.log('Logging to '+this.logFilename);

        process.on('SIGINT', () => {
            this.disconnect();
        });
	}
}

app = new App();
app.start();

import request from 'request';
import readline from 'readline';
import fs from 'fs';
import querystring from 'querystring';
import notification from 'notify-send';
import objConfig from './config';

const arrTopics = ('undefined' !== typeof process.argv[2])?process.argv[2].split(','):objConfig.likes,
    {phrases, log, bannedPhrases, rxBannedPhrases, autoPhrases} = objConfig,
    endpoint = 'http://front4.omegle.com',
    strUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36',
    headers = {
        'Referer': 'http://www.omegle.com/',
        'User-Agent': strUserAgent,
        'Cache-Control': 'no-cache',
        'Origin': 'http://www.omegle.com',
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    notify = notification.notify;

let app;

class App
{
	constructor()
	{
        this.randid = (Math.floor(Math.random() * 1000000000 + 1000000000)).toString(36).toUpperCase();
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
		let query = {
                caps: 'recaptcha2,t',
                // rcs: 1,
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
                if ('undefined' !== typeof body.events) {
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
        for (let phrase of bannedPhrases) {
            if (-1 !== msg.indexOf(phrase)) {
                this.print(`Stranger said a banned phrase (${phrase}), disconnecting: ${msg}`);
                this.writeToFile(`Stranger said a banned phrase (${phrase}), disconnecting: ${msg}`);
                return this.disconnect();
            }
        }
        for (let phrase of rxBannedPhrases) {
            if (new RegExp(phrase).test(msg)) {
                this.print(`Stranger said a banned phrase (${phrase}), disconnecting: ${msg}`);
                this.writeToFile(`Stranger said a banned phrase (${phrase}), disconnecting: ${msg}`);
                return this.disconnect();
            }
        }
        for (let phrase in autoPhrases) {
            if (-1 !== msg.toLowerCase().indexOf(phrase.toLowerCase())) {
                this.print(`Stranger (will auto-reply): ${msg}`);
                this.writeToFile(`Stranger (will auto-reply): ${msg}`);
                return this.send(autoPhrases[phrase]);
            }
        }
        notify('Omegle Message', msg);
        this.print(`Stranger: ${msg}`);
        this.writeToFile(`Stranger: ${msg}`);
	}

	print(msg)
	{
	    //process.stdout.clearLine();
        //process.stdout.cursorTo(0);
        console.log(msg);
        this.rl.prompt(true);
	}

	parseEvents(body)
	{
		for (let i = 0; i < body.length; i++) {
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
		let body = 'id='+querystring.escape(this.clientID);
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
                    console.log('Body was NULL, presumably the connection was severed.');
                    process.exit(0);
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
		let localHeader = headers;
        localHeader.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
        request.post(
            endpoint+'/typing',
            {
                body: 'id='+querystring.escape(this.clientID),
                headers: localHeader
            },
            (err, response, body) => {}
        );
	}

	bored()
	{
		let body = 'id='+querystring.escape(this.clientID);
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
		let body = 'id='+querystring.escape(this.clientID);
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
		let localHeader = headers,
            phrase = null;
        localHeader.Accept = 'text/javascript, text/html, application/xml, text/xml, */*';
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
                headers: localHeader
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
                mode: 0o600
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
		let date = new Date();
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

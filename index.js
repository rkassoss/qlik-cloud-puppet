import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

import https from "https";
import fs from 'fs';
import morgan from 'morgan';
const port = 4000;

// CORS add allowed origin from all qlikcloud.com subdomains
import cors from 'cors';
var allowedOrigins = ['https://kassovitz.us.qlikcloud.com'];
app.use(cors({
    origin: function(origin, callback){
        // allow requests with no origin 
        // (like mobile apps or curl requests)
        if(!origin) return callback(null, true);
        if(allowedOrigins.indexOf(origin) === -1){
          var msg = 'The CORS policy for this site does not ' +
                    'allow access from the specified Origin.';
          return callback(new Error(msg), false);
        }
        return callback(null,true);
    },
    credentials: true
}));

// Middleware
app.use(morgan("dev"));

// Read SSL certificate and key files
const options = {
    key: fs.readFileSync("C:/certificates/localhost.key"),
    cert: fs.readFileSync("C:/certificates/localhost.crt"),
};

let userId;

// Create HTTPS server
const server = https.createServer(options, app);
server.listen(port, () => {
    console.log(`App listening on https://localhost:${port}`);
});

import puppeteer from 'puppeteer';
import { auth as qlikAuth, users as qlikUsers } from "@qlik/api";

const qlikConfig = {
    authType: "oauth2",
    host: process.env.QLIK_HOST,
    clientId: process.env.QLIK_CLIENT_ID,
    clientSecret: process.env.QLIK_CLIENT_SECRET,
};

//set the host configuration to talk to Qlik tenant
qlikAuth.setDefaultHostConfig(qlikConfig);

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

//access token method the frontend will call
app.post("/access-token", async (req, res) => {
    console.log("getting access token for user: " + userId);
    // const userId = "_Mvc3vkMq2YXadXEnYIkb08rXEBXn6L8";
    try {
        //call to Qlik Cloud tenant to obtain an access token
        const accessToken = await qlikAuth.getAccessToken({
        hostConfig: {
            ...qlikConfig,
            userId,
            noCache: true,
        },
        });
        console.log("I got an access token!");
        //access token returned to front end
        res.send(accessToken);
    } catch (err) {
        console.log(err);
        res.status(401).send("No access");
    }
});

app.use(function (req, res, next) {
    console.log('Time:', Date.now())
    next()
});

app.get('/', (req, res) => res.send('Hello World!'));

// Serve the Qlik mashup
app.get('/qlik-embed-demo', function(req, res) {
    const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
    const __dirname = path.dirname(__filename); // get the name of the directory
    res.sendFile(path.join(__dirname, '/qlik-embed-demo.html'));
});

// Use puppeteer to take a screenshot of the Qlik mashup
app.post('/qlik-cloud-puppet', async (req, res) => {
    console.log("puppeteer started for user: " + userId);
    // Launch the browser and open a new blank page, add access token to the URL
    const browser = await puppeteer.launch({
        headless: true,
        devtools: false,
        defaultViewport: {
            width:1920,
            height:1080
        }
    });
    const page = await browser.newPage();

    // console.log(req);

    // check if the request has the required parameters
    // get userId, appId, and tempNookId from the request
    // userId = req.body.userId;
    // const appId = req.body.appId;
    // const bookmarkId = req.body.bookmarkId;

    // get params from query
    userId = req.query.userId;
    const appId = req.query.appId;
    const bookmarkId = req.query.bookmarkId;

    
    const mashup = `https://localhost:4000/qlik-embed-demo?appId=${appId}&bookmarkId=${bookmarkId}`;

    await page.goto(mashup); // able to login using the access token but the websocket is blocked - CSRF token is missing too. also, it seems to append the header to all requests - even the ones that are not to the qlik server, so the page does not load properly

    await delay(5000); // wait for the page to load, will use a better method later to indicate Qlik is ready for pictures

    // take screenshot of the whole page, later will need to take a screenshot of the specific objects so I could get hypercube data of the tables
    // const screenshot = await page.screenshot({
    //     path: 'screenshot_full.jpg',
    //     fullPage: true
    // });

    console.log("pdf generation started");

    // page pdf
    const pdf = await page.pdf({path: 'report.pdf', format: 'A4'});

    console.log("pdf generation finished");

    await browser.close();

    // send the screenshot back to the client
    // res.set('Content-Type', 'image/jpeg');
    // res.send(screenshot);


    // send the screenshot back to client for download
    // res.setHeader('Content-Type', 'image/jpeg');
    // res.setHeader('Content-Disposition', 'attachment; filename=download.jpg');
    // res.send(screenshot);

    // send the pdf back to client for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
    res.send(pdf);
    
});
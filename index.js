import express from 'express';
const app = express();

import https from "https";
import fs from 'fs';
import morgan from 'morgan';
const port = 4000;

// Middleware
app.use(morgan("dev"));

// Read SSL certificate and key files
const options = {
    key: fs.readFileSync("C:/certificates/localhost.key"),
    cert: fs.readFileSync("C:/certificates/localhost.crt"),
};

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

app.use(function (req, res, next) {
    console.log('Time:', Date.now())
    next()
});

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/qlik-cloud-puppet', async (req, res) => {
    let accessToken;

    // const userId = req.session?.user?.id;
    const userId = "_Mvc3vkMq2YXadXEnYIkb08rXEBXn6L8"; // Hardcoded for testing, should be replaced with the user ID from the front end, the qlik extension button will have to get the user id from the current session and passit in the request
    try {
        // Call to Qlik Cloud tenant to obtain an access token
        accessToken = await qlikAuth.getAccessToken({
            hostConfig: {
                ...qlikConfig,
                userId,
                noCache: true,
            },
        });
        console.log("I got an access token!");
        // Access token returned to front end (will be used by peuppeteer to authenticate to Qlik Sense server)
    } catch (err) {
        console.log(err);
        res.status(401).send("No access");
    }

    console.log({accessToken});

    // Launch the browser and open a new blank page, add access token to the URL
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        defaultViewport: {
            width:1920,
            height:1080
        }
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${accessToken}`
    });

    // const appId = req.query.appId;
    // const sheetId = req.query.sheetId;
    // const selections = req.query.selections;
    
        // will need to covnert selections to the format that Qlik expects
        // SENSESERVER/sense/app/456942a2-d3e2-40a5-bad6-985e80294f05/sheet/2c6000a4-44a4-49aa-9590-f111e880bda9/state/analysis/select/Dim1/B/select/Dim2/c;d
        // another option to pass selections will be to creat a tempBookmark with the button extension and just pass the bookmark ID to the backend, but then can we pass bookmark id in the url or do we need to use qix for it on the same session?

    // const qlikUrl = `${qlikConfig.host}/sense/app/${appId}/sheet/${sheetId}/state/analysis/${selections}`;
    // const qlikUrl = `${qlikConfig.host}/sense/app/d6152f1d-c366-4471-8aa6-7ae473e63f59/sheet/XuWLHFK/state/analysis`
    const qlikUrl = `${qlikConfig.host}/`;

    await page.goto(qlikUrl); // able to login using the access token but the websocket is blocked - CSRF token is missing too. also, it seems to append the header to all requests - even the ones that are not to the qlik server, so the page does not load properly

    await delay(5000); // wait for the page to load, will use a better method later to indicate Qlik is ready for pictures

    // take screenshot of the whole page, later will need to take a screenshot of the specific objects so I could get hypercube data of the tables
    const screenshot = await page.screenshot({
        path: 'screenshot_full.jpg',
        fullPage: true
    });

    res.send(screenshot);

    await browser.close();
});
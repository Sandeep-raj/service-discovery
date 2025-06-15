const express = require('express');
const httpProxy = require('http-proxy');
const axios = require('axios');

const app = express();
const proxy = httpProxy.createProxyServer({});
const CONSUL_HOST = 'http://localhost:8500';
let serviceList = ['service-a', 'service-b'];
let serviceCol = {}
let serviceIdx = {}

// Function to update service list from Consul
async function updateServiceList(serviceName) {
    try {
        const res = await axios.get(`${CONSUL_HOST}/v1/health/service/${serviceName}?passing=true`);
        let tempList = res.data.map(entry => {
            return {
                address: entry.Service.Address || entry.Node.Address,
                port: entry.Service.Port
            };
        });
        serviceCol[serviceName] = tempList
        console.log('Updated services ' + serviceName + ':', tempList);
    } catch (err) {
        console.error('Failed to fetch service list from Consul:', err.message);
    }
}

function subscribeToServices() {
    for (let i = 0; i < serviceList.length; i++) {
        updateServiceList(serviceList[i])
    }
}

function initializeCounter() {
    for (let i = 0; i < serviceList.length; i++) {
        serviceIdx[serviceList[i]] = 0
    }
}

// Update service list every 10 seconds
setInterval(subscribeToServices, 10000);
subscribeToServices(); // initial fetch
initializeCounter();

// Route traffic to backend services using round-robin
app.use((req, res) => {
    let currSrv = ""
    if (req.path.startsWith("/service-a")) {
        currSrv = 'service-a'
    } else if (req.path.startsWith("/service-b")) {
        currSrv = 'service-b'
    } else {
        return res.status(404).send("not a valid request...")
    }


    if (!serviceCol[currSrv].length) {
        return res.status(503).send('No healthy backend services available');
    }

    if (serviceCol[currSrv].length <= serviceIdx[currSrv]) {
        serviceIdx[currSrv] = 0
    }

    const target = serviceCol[currSrv][serviceIdx[currSrv]];
    serviceIdx[currSrv] = (serviceIdx[currSrv] + 1) % serviceCol[currSrv].length;

    const targetUrl = `http://${target.address}:${target.port}`;
    console.log(`Proxying request to: ${targetUrl}${req.url}`);

    // Dynamically remove the service prefix from the URL
    const prefixRegex = new RegExp(`^/${currSrv}`);
    const strippedUrl = req.url.replace(prefixRegex, '') || '/';

    // Update req.url before proxying
    req.url = strippedUrl;

    proxy.web(req, res, { target: targetUrl }, err => {
        console.error('Proxy error:', err.message);
        res.status(502).send('Bad Gateway');
    });
});

// Start Load Balancer
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Load balancer listening on http://localhost:${PORT}`);
});

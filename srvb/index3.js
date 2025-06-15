const express = require("express")
const axios = require('axios');
const app = express()

const port = 5002
const CONSUL_HOST = 'http://localhost:8500'; // Or your consul IP:PORT
const SERVICE_ID = `service-b-${port}`;
const SERVICE_NAME = 'service-b';

app.get('/', (req, res) => {
    return res.send(`this is from service B from port ${port}`)
})

app.get('/health', (req, res) => {
    res.send('OK');
  });

app.listen(port, async () => {
    console.log(`services started on port ${port}`)

    // Register with Consul
    try {
        await axios.put(`${CONSUL_HOST}/v1/agent/service/register`, {
            Name: SERVICE_NAME,
            ID: SERVICE_ID,
            Address: '192.168.29.151', // or actual IP if not using Docker/Podman
            Port: port,
            Check: {
                HTTP: `http://192.168.29.151:${port}/health`,
                Interval: '10s',
                Timeout: '5s',
                DeregisterCriticalServiceAfter: '1m'
            }
        });
        console.log('Service registered with Consul');
    } catch (err) {
        console.error('Error registering service with Consul:', err.message);
    }
})
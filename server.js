import express from 'express';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const app = express();
app.use(express.json());
app.use(express.static('.'));

// API routes
import loginHandler from './api/login.js';
import logoutHandler from './api/logout.js';
import statsHandler from './api/stats.local.js';

app.post('/api/login', (req, res) => loginHandler(req, res));
app.post('/api/logout', (req, res) => logoutHandler(req, res));
app.get('/api/stats', (req, res) => statsHandler(req, res));
app.post('/api/stats', (req, res) => statsHandler(req, res));

app.listen(3000, () => console.log('http://localhost:3000'));

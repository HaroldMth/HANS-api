// server.js - HANS API backend (full, production-ready)
// Minimal comments as requested. Assumes config.js exists and apis/ contains JS modules.

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const nodeCron = require('node-cron');
const nodemailer = require('nodemailer');
const qrcode = require('qrcode');
const { createObjectCsvWriter } = require('csv-writer');
const rateLimit = require('express-rate-limit');

const config = require('./config');

const app = express();
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

// connect mongo
mongoose.set('strictQuery', false);
mongoose
  .connect(config.mongoUri, { autoIndex: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => { console.error('MongoDB connection error:', err.message); process.exit(1); });

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  apiKey: { type: String, unique: true, sparse: true },
  verified: { type: Boolean, default: false },
  role: { type: String, default: 'user' },
  dailyLimit: { type: Number, default: config.defaultDailyLimit },
  usageToday: { type: Number, default: 0 },
  usageResetAt: { type: Date, default: () => nextResetDate() },
  banned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const verificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
});
const apiLogSchema = new mongoose.Schema({
  apiKey: String,
  endpoint: String,
  ip: String,
  timestamp: { type: Date, default: Date.now }
});

const endpointDefaultsSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  defaults: { type: Object, default: {} }
}, { timestamps: true });

const EndpointDefaults = mongoose.model('EndpointDefaults', endpointDefaultsSchema);
const User = mongoose.model('User', userSchema);
const Verification = mongoose.model('Verification', verificationSchema);
const ApiLog = mongoose.model('ApiLog', apiLogSchema);

// helpers
function generateApiKey() {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}
function nextResetDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// mailer
const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.port === 465,
  auth: { user: config.mail.user, pass: config.mail.pass }
});
async function sendVerificationEmail(user, token) {
  const verifyUrl = `${process.env.BASE_URL || `http://localhost:${config.port}`}/auth/verify?token=${token}`;
  const mail = {
    from: `HANS API <${config.mail.user}>`,
    to: user.email,
    subject: 'Confirm your HANS API account',
    text: `Welcome to HANS API. Verify: ${verifyUrl}`,
    html: `<p>Welcome to <b>HANS API</b>.</p><p>Click <a href="${verifyUrl}">verify your email</a>.</p>`
  };
  await transporter.sendMail(mail);
}
async function sendWelcomeWithApiKey(user) {
  const mail = {
    from: `HANS API <${config.mail.user}>`,
    to: user.email,
    subject: 'Your HANS API key',
    text: `Your API key: ${user.apiKey}`,
    html: `<p>Your API key: <code>${user.apiKey}</code></p>`
  };
  await transporter.sendMail(mail);
}

// auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ status: 'error', message: 'Missing Authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ status: 'error', message: 'Bad Authorization' });
  try {
    const data = jwt.verify(parts[1], config.jwtSecret);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  if (req.user.email !== config.adminEmail) return res.status(403).json({ status: 'error', message: 'Forbidden' });
  next();
}

// api key middleware
async function requireApiKey(req, res, next) {
  const key = req.get('x-api-key') || req.query.key;
  if (!key) return res.status(401).json({ status: 'error', message: 'Missing API key' });
  const user = await User.findOne({ apiKey: key });
  if (!user) return res.status(401).json({ status: 'error', message: 'Invalid API key' });
  if (user.banned) return res.status(403).json({ status: 'error', message: 'User banned' });

  if (!user.usageResetAt || user.usageResetAt <= new Date()) {
    user.usageToday = 0;
    user.usageResetAt = nextResetDate();
  }
  if (user.usageToday >= user.dailyLimit) {
    return res.status(429).json({ status: 'error', message: 'Daily limit reached' });
  }
  user.usageToday += 1;
  await user.save().catch(() => {});
  const log = new ApiLog({ apiKey: key, endpoint: req.path, ip: req.ip });
  log.save().catch(() => {});
  req.apiUser = user;
  next();
}

// rate limiters for auth endpoints
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }); // 20 req/min
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }); // 10 req/min

// --- Endpoint Defaults Cache and Loader ---
const endpointDefaultsCache = new Map();

// helper to load all defaults into memory once
async function loadEndpointDefaultsToCache() {
  try {
    const docs = await EndpointDefaults.find({});
    docs.forEach(doc => {
      endpointDefaultsCache.set(doc.endpoint, doc.defaults || {});
    });
    console.log('Loaded endpoint defaults into cache:', endpointDefaultsCache.size);
  } catch (err) {
    console.error('Failed to load endpoint defaults into cache:', err.message);
  }
}

// middleware to apply defaults into req.query (GET) or req.body (POST/PUT)
function applyEndpointDefaults(req, res, next) {
  try {
    const ep = req.path; // e.g. "/api/my-endpoint"
    const defaults = endpointDefaultsCache.get(ep);
    if (!defaults) return next();
    if (req.method === 'GET' || req.method === 'DELETE') {
      req.query = Object.assign({}, defaults, req.query);
    } else {
      req.body = Object.assign({}, defaults, req.body);
    }
    next();
  } catch (err) {
    next();
  }
}

// Global API list for dynamic loader and monitor
const apiList = [];

// async dynamic API loader (replaces your synchronous loader)
async function loadApisAndMount() {
  const apisDir = path.join(__dirname, 'apis');
  if (!fs.existsSync(apisDir)) return;
  const files = fs.readdirSync(apisDir).filter(f => f.endsWith('.js'));

  // ensure cache loaded first
  await loadEndpointDefaultsToCache();

  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(apisDir, file))];
      const mod = require(path.join(apisDir, file));
      const name = mod.name || path.basename(file, '.js');
      const route = `/api/${name}`;
      mod._defaults = endpointDefaultsCache.get(route) || {};
      if (typeof mod.handler === 'function') {
        if (mod.public) {
          app.get(route, applyEndpointDefaults, mod.handler);
          app.post(route, applyEndpointDefaults, mod.handler);
        } else {
          app.get(route, applyEndpointDefaults, requireApiKey, mod.handler);
          app.post(route, applyEndpointDefaults, requireApiKey, mod.handler);
        }
        apiList.push({ route, description: mod.description || '', file, public: !!mod.public });
      }
    } catch (err) {
      console.error('Error loading api', file, err.message);
    }
  }
}

// After mongoose connects, load APIs and mount
mongoose.connection.once('open', () => {
  loadApisAndMount().catch(err => console.error('loadApisAndMount failed', err));
});

// core endpoints
app.get('/api/info', requireApiKey, async (req, res) => {
  const u = req.apiUser;
  return res.json({
    status: 'success',
    data: {
      email: u.email,
      requests_left: Math.max(0, u.dailyLimit - u.usageToday),
      reset_at: u.usageResetAt
    }
  });
});




// auth: register
app.post('/auth/register', authLimiter, async (req, res) => {
  const schema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(6).required() });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });
  const email = value.email.toLowerCase();
  if (await User.findOne({ email })) return res.status(400).json({ status: 'error', message: 'Email in use' });
  const pwHash = await bcrypt.hash(value.password, 12);
  const user = new User({ email, passwordHash: pwHash, role: email === config.adminEmail ? 'admin' : 'user' });
  await user.save();
  const token = uuidv4();
  const v = new Verification({ userId: user._id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) });
  await v.save();
  try { await sendVerificationEmail(user, token); } catch (err) { console.error('Verification email failed', err.message); }
  res.json({ status: 'success', message: 'Registered. Check email for verification link.' });
});

// verify
app.get('/auth/verify', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('Missing token');
  const v = await Verification.findOne({ token });
  if (!v) return res.status(400).send('Token invalid');
  if (v.expiresAt < new Date()) return res.status(400).send('Token expired');
  const user = await User.findById(v.userId);
  if (!user) return res.status(400).send('User not found');
  if (!user.apiKey) user.apiKey = generateApiKey();
  user.verified = true;
  await user.save();
  await Verification.deleteOne({ _id: v._id }).catch(() => {});
  try { await sendWelcomeWithApiKey(user); } catch (err) { console.error('Welcome mail failed', err.message); }
  res.send(`<h2>Verified</h2><p>Your account is verified. Your API key has been emailed.</p>`);
});

// login
app.post('/auth/login', loginLimiter, async (req, res) => {
  const schema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });
  const user = await User.findOne({ email: value.email.toLowerCase() });
  if (!user) return res.status(400).json({ status: 'error', message: 'Invalid credentials' });
  const ok = await bcrypt.compare(value.password, user.passwordHash);
  if (!ok) return res.status(400).json({ status: 'error', message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ status: 'success', data: { token } });
});

// admin: overview
app.get('/dashboard-control-9000', requireAuth, requireAdmin, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalRequestsToday = await ApiLog.countDocuments({ timestamp: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } });
  const topUsersAgg = await ApiLog.aggregate([{ $group: { _id: '$apiKey', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 } ]);
  const top = await Promise.all(topUsersAgg.map(async (t) => {
    const u = await User.findOne({ apiKey: t._id });
    return { email: u ? u.email : 'unknown', requests: t.count };
  }));
  res.json({ status: 'success', data: { totalUsers, totalRequestsToday, top } });
});

app.get('/api/categories', async (req, res) => {
  try {
    const categoriesPath = path.join('api', 'categories.json');
    if (!fs.existsSync(categoriesPath)) {
      return res.status(500).json({ status: 'error', message: 'Categories file not found' });
    }
    const rawData = await fs.promises.readFile(categoriesPath, 'utf-8');
    const categories = JSON.parse(rawData);
    res.json({ status: 'success', data: categories });
  } catch (err) {
    console.error('Failed to load categories:', err);
    res.status(500).json({ status: 'error', message: 'Failed to load categories' });
  }
});

  // total API requests (all-time)
app.get('/admin/total-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalRequests = await ApiLog.countDocuments();
    res.json({ status: 'success', data: { totalRequests } });
  } catch (err) {
    console.error('Failed to fetch total requests:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch total requests' });
  }
});



app.get('/api/categories', async (req, res) => {
  try {
    const categoriesPath = path.join('api', 'categories.json'); // adjust path if you store it elsewhere
    if (!fs.existsSync(categoriesPath)) {
      return res.status(500).json({ status: 'error', message: 'Categories file not found' });
    }
    const rawData = await fs.promises.readFile(categoriesPath, 'utf-8');
    const categories = JSON.parse(rawData);
    res.json({ status: 'success', data: categories });
  } catch (err) {
    console.error('Failed to load categories:', err);
    res.status(500).json({ status: 'error', message: 'Failed to load categories' });
  }
});

  // user: view own API key
app.get('/user/api-key', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: { apiKey: user.apiKey } });
  } catch (err) {
    console.error('Failed to fetch API key:', err.message);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

app.get('/user/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({
      status: 'success',
      data: {
        email: user.email,
        role: user.role,
        isAdmin: user.email === config.adminEmail
      }
    });
  } catch (err) {
    console.error('Failed to fetch profile:', err.message);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});



// admin: change persistent limit
app.post('/admin/user/:id/limit', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const limit = parseInt(req.body.limit, 10);
  if (!Number.isInteger(limit) || limit < 0) return res.status(400).json({ status: 'error', message: 'Invalid limit' });
  const user = await User.findByIdAndUpdate(id, { dailyLimit: limit }, { new: true });
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  res.json({ status: 'success', data: { email: user.email, dailyLimit: user.dailyLimit } });
});

// admin: add persistent requests (increment dailyLimit)
app.post('/admin/user/:id/add-requests', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const amount = parseInt(req.body.amount, 10);
  if (!Number.isInteger(amount) || amount === 0) return res.status(400).json({ status: 'error', message: 'Invalid amount' });
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  user.dailyLimit = (user.dailyLimit || 0) + amount;
  await user.save();
  res.json({ status: 'success', data: { email: user.email, new_daily_limit: user.dailyLimit } });
});

// admin: set/update endpoint defaults
app.post('/admin/endpoint-defaults', requireAuth, requireAdmin, async (req, res) => {
  const { endpoint, defaults } = req.body;
  if (!endpoint || typeof defaults !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Invalid body' });
  }
  try {
    const doc = await EndpointDefaults.findOneAndUpdate(
      { endpoint },
      { $set: { defaults } },
      { new: true, upsert: true }
    );
    // update in-memory cache so changes are live without server restart
    endpointDefaultsCache.set(endpoint, defaults);
    res.json({ status: 'success', data: doc });
  } catch (err) {
    console.error('Failed to save defaults:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to save defaults' });
  }
});

// anyone: get defaults for an endpoint
app.get('/endpoint-defaults/:endpoint', async (req, res) => {
  try {
    const doc = await EndpointDefaults.findOne({ endpoint: req.params.endpoint });
    res.json({ status: 'success', data: doc ? doc.defaults : {} });
  } catch (err) {
    console.error('Failed to fetch defaults:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch defaults' });
  }
});

// admin: add temporary requests for today (instant effect)
app.post('/admin/user/:id/add-today', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const amount = parseInt(req.body.amount, 10);
  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ status: 'error', message: 'Invalid amount' });
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  user.usageToday = Math.max(0, (user.usageToday || 0) - amount);
  await user.save();
  res.json({ status: 'success', data: { email: user.email, requests_left: Math.max(0, user.dailyLimit - user.usageToday), usageToday: user.usageToday } });
});


app.get('/user/api-list', requireAuth, async (req, res) => {
  const apis = [];
  const files = fs.readdirSync(path.join(__dirname, 'apis')).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(__dirname, 'apis', file));
      apis.push({
        name: mod.name || file.replace('.js',''),
        description: mod.description || '',
        public: !!mod.public,
        params: mod.params || []
      });
    } catch {}
  }
  res.json({ status: 'success', data: apis });
});

// GET /admin/users - list all users (admin only)
app.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, {
      _id: 1,
      email: 1,
      apiKey: 1,
      role: 1,
      dailyLimit: 1,
      usageToday: 1,
      verified: 1,
      banned: 1,
      createdAt: 1
    }).sort({ createdAt: -1 });

    res.json({ status: 'success', data: users });
  } catch (err) {
    console.error('Failed to fetch users:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
});

// admin: regenerate user's api key
app.post('/admin/user/:id/regenerate-key', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  user.apiKey = generateApiKey();
  await user.save();
  res.json({ status: 'success', data: { email: user.email, apiKey: user.apiKey } });
});

// admin: download logs
app.get('/admin/logs/download', requireAuth, requireAdmin, async (req, res) => {
  const logs = await ApiLog.find().limit(10000).lean();
  const csvWriter = createObjectCsvWriter({
    path: 'apilogs.csv',
    header: [
      { id: 'apiKey', title: 'API_KEY' },
      { id: 'endpoint', title: 'ENDPOINT' },
      { id: 'ip', title: 'IP' },
      { id: 'timestamp', title: 'TIMESTAMP' }
    ]
  });
  await csvWriter.writeRecords(logs);
  res.download(path.join(process.cwd(), 'apilogs.csv'), 'apilogs.csv');
});

// user self-service: increase persistent limit (requires JWT)
app.post('/user/add-requests', requireAuth, async (req, res) => {
  const amount = parseInt(req.body.amount, 10);
  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ status: 'error', message: 'Invalid amount' });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  user.dailyLimit = (user.dailyLimit || 0) + amount;
  await user.save();
  res.json({ status: 'success', data: { new_daily_limit: user.dailyLimit } });
});

// user self-service: regenerate own api key
app.post('/user/regenerate-key', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  user.apiKey = generateApiKey();
  await user.save();
  res.json({ status: 'success', data: { apiKey: user.apiKey } });
});

// root redirect to your Vercel site
app.get('/', (req, res) => {
  return res.redirect(302, 'https://hans-api-site.vercel.app');
});

// monitor page
app.get('/monitor', (req, res) => {
  const uptime = process.uptime();
  const html = `<!doctype html>
  <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HANS API Monitor</title></head>
    <body style="font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial; padding:20px;">
      <h1>HANS API - Monitor</h1>
      <p>Server time: ${new Date().toISOString()}</p>
      <p>Uptime (s): ${Math.floor(uptime)}</p>
      <p>MongoDB: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}</p>
      <p>Available endpoints (sample):</p>
      <ul>${apiList.map(a => `<li><strong>${a.route}</strong> — ${a.description} ${a.public ? '(public)' : ''}</li>`).join('')}</ul>
      <p>Note: root <code>/</code> redirects to <a href="https://hans-api-site.vercel.app">hans-api-site.vercel.app</a></p>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// simple status
app.get('/status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), mongo: mongoose.connection.readyState });
});

// cron reset daily usage at midnight UTC
nodeCron.schedule('0 0 * * *', async () => {
  try {
    await User.updateMany({}, { $set: { usageToday: 0, usageResetAt: nextResetDate() } });
    console.log('Daily usage counters reset');
  } catch (err) {
    console.error('Reset failed', err.message);
  }
});

// seed admin if missing
(async function seedAdmin() {
  try {
    const existing = await User.findOne({ email: config.adminEmail });
    if (!existing) {
      const pw = config.initialAdminSeedPassword || 'adminpass';
      const hash = await bcrypt.hash(pw, 12);
      const admin = new User({ email: config.adminEmail, passwordHash: hash, role: 'admin', verified: true });
      admin.apiKey = generateApiKey();
      await admin.save();
      console.log('Admin seeded. Email:', config.adminEmail, 'seed password:', config.initialAdminSeedPassword ? '(from .env)' : pw);
    }
  } catch (err) {
    console.error('Admin seed error', err.message);
  }
})();

// start server
app.listen(config.port, () => console.log(`HANS API listening on port ${config.port}`));
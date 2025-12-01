require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const knexLib = require("knex");
const KnexSessionStore = require("connect-session-knex")(session);

const app = express();

// --------------------------
// DATABASE (PostgreSQL)
// --------------------------
const knex = knexLib({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
});

// --------------------------
// MIDDLEWARE
// --------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(helmet());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-change-this",
    resave: false,
    saveUninitialized: false,
    store: new KnexSessionStore({
      knex,
      tablename: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// --------------------------
// VIEW ENGINE
// --------------------------
app.set("view engine", "ejs");

// --------------------------
// AUTH HELPERS
// --------------------------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user || req.session.user.role !== "manager") {
    return res.status(403).send("Forbidden");
  }
  next();
}

// --------------------------
// PAGES
// --------------------------
app.get("/", (req, res) => {
  res.send(`
    <h1>Ella Rises</h1>
    ${req.session.user ? `
      <p>Welcome, ${req.session.user.email}</p>
      <a href="/dashboard">Dashboard</a><br>
      <a href="/logout">Logout</a>
    ` : `
      <a href="/login">Login</a>
    `}
  `);
});

app.get("/login", (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/login">
      <input name="email" placeholder="email" required><br>
      <input name="password" type="password" placeholder="password" required><br>
      <button>Login</button>
    </form>
  `);
});

app.post("/login", async (req, res) => {
  // Replace with real DB lookup
  const { email, password } = req.body;

  if (email === "admin@test.com" && password === "pass") {
    req.session.user = { id: 1, email, role: "manager" };
    return res.redirect("/dashboard");
  }

  res.send("Invalid login. <a href='/login'>Try again</a>");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// --------------------------
// DASHBOARD
// --------------------------
app.get("/dashboard", requireLogin, (req, res) => {
  res.send(`
    <h1>Dashboard</h1>
    <p>Hello ${req.session.user.email}</p>
    <ul>
      <li><a href="/participants">Participants</a></li>
      <li><a href="/events">Events</a></li>
      <li><a href="/surveys">Surveys</a></li>
      <li><a href="/milestones">Milestones</a></li>
      <li><a href="/donations">Donations</a></li>
    </ul>
  `);
});

// --------------------------
// CRUD ROUTES (SUPER BASIC)
// --------------------------

// PARTICIPANTS
app.get("/participants", requireLogin, async (req, res) => {
  const rows = await knex("participants").select("*").catch(() => []);
  res.send(rows);
});

app.post("/participants", requireManager, async (req, res) => {
  await knex("participants").insert(req.body);
  res.redirect("/participants");
});

// EVENTS
app.get("/events", requireLogin, async (req, res) => {
  const rows = await knex("events").select("*").catch(() => []);
  res.send(rows);
});

// SURVEYS
app.get("/surveys", requireLogin, async (req, res) => {
  const rows = await knex("surveys").select("*").catch(() => []);
  res.send(rows);
});

// MILESTONES
app.get("/milestones", requireLogin, async (req, res) => {
  const rows = await knex("milestones").select("*").catch(() => []);
  res.send(rows);
});

// DONATIONS
app.get("/donations", requireLogin, async (req, res) => {
  const rows = await knex("donations").select("*").catch(() => []);
  res.send(rows);
});

// --------------------------
// ERROR HANDLE 418 PAGE
// --------------------------
app.get("/teapot", (req, res) => {
  res.status(418).send("I'm a teapot ☕");
});

// --------------------------
// RUN SERVER
// --------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

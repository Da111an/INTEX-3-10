require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const knexLib = require("knex");
const KnexSessionStore = require("connect-session-knex")(session);
const bcrypt = require("bcryptjs");
const path = require("path");



const app = express();

// --------------------------
// DATABASE (PostgreSQL)
// --------------------------
const knex = knexLib({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
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
    store: new KnexSessionStore({ knex, tablename: "sessions" }),
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
app.use(express.static(path.join(__dirname, "views", "public")));


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
// PUBLIC PAGES
// --------------------------
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

app.get("/visitor-donation", (req, res) => {
  res.render("public/visitorDonation");
});

// --------------------------
// AUTH ROUTES
// --------------------------
app.get("/login", (req, res) => {
  res.render("auth/login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // TODO: replace with real DB auth
  if (email === "admin@test.com" && password === "pass") {
    req.session.user = { id: 1, email, role: "manager" };
    return res.redirect("/dashboard");
  }

  res.render("auth/login", { error: "Invalid login" });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// --------------------------
// DASHBOARD
// --------------------------
app.get("/dashboard", requireLogin, (req, res) => {
  res.render("dashboard/home", { user: req.session.user });
});

// --------------------------
// USERS (Manager only)
// --------------------------
app.get("/users", requireManager, async (req, res) => {
  const users = await knex("users").select("*").catch(() => []);
  res.render("users/list", { users });
});

app.get("/users/add", requireManager, (req, res) => {
  res.render("users/add");
});

app.post("/users/add", requireManager, async (req, res) => {
  await knex("users").insert(req.body);
  res.redirect("/users");
});

app.get("/users/edit/:id", requireManager, async (req, res) => {
  const user = await knex("users").where("id", req.params.id).first();
  res.render("users/edit", { user });
});

app.post("/users/edit/:id", requireManager, async (req, res) => {
  await knex("users").where("id", req.params.id).update(req.body);
  res.redirect("/users");
});

// --------------------------
// PARTICIPANTS
// --------------------------
app.get("/participants", requireLogin, async (req, res) => {
  const participants = await knex("participants").select("*").catch(() => []);
  res.render("participants/list", { participants });
});

app.get("/participants/add", requireManager, (req, res) => {
  res.render("participants/add");
});

app.post("/participants/add", requireManager, async (req, res) => {
  await knex("participants").insert(req.body);
  res.redirect("/participants");
});

app.get("/participants/edit/:id", requireManager, async (req, res) => {
  const participant = await knex("participants").where("id", req.params.id).first();
  res.render("participants/edit", { participant });
});

app.post("/participants/edit/:id", requireManager, async (req, res) => {
  await knex("participants").where("id", req.params.id).update(req.body);
  res.redirect("/participants");
});

// Milestones for participants
app.get("/participants/milestones/:id", requireManager, async (req, res) => {
  const milestones = await knex("milestones").where("participant_id", req.params.id);
  res.render("participants/milestones", { milestones, participantId: req.params.id });
});

app.post("/participants/milestones/:id", requireManager, async (req, res) => {
  await knex("participants").where("id", req.params.id).update(req.body);
  res.redirect("/participants");
});

// --------------------------
// EVENTS
// --------------------------
app.get("/events", requireLogin, async (req, res) => {
  const events = await knex("events").select("*").catch(() => []);
  res.render("events/list", { events });
});

app.get("/events/add", requireManager, (req, res) => {
  res.render("events/add");
});

app.post("/events/add", requireManager, async (req, res) => {
  await knex("events").insert(req.body);
  res.redirect("/events");
});

app.get("/events/edit/:id", requireManager, async (req, res) => {
  const event = await knex("events").where("id", req.params.id).first();
  res.render("events/edit", { event });
});

app.post("/events/edit/:id", requireManager, async (req, res) => {
  await knex("events").where("id", req.params.id).update(req.body);
  res.redirect("/events");
});

// --------------------------
// SURVEYS
// --------------------------
app.get("/surveys", requireLogin, async (req, res) => {
  const surveys = await knex("surveys").select("*").catch(() => []);
  res.render("surveys/list", { surveys });
});

app.get("/surveys/add", requireManager, (req, res) => {
  res.render("surveys/add");
});

app.post("/surveys/add", requireManager, async (req, res) => {
  await knex("surveys").insert(req.body);
  res.redirect("/surveys");
});

app.get("/surveys/edit/:id", requireManager, async (req, res) => {
  const survey = await knex("surveys").where("id", req.params.id).first();
  res.render("surveys/edit", { survey });
});

app.post("/surveys/edit/:id", requireManager, async (req, res) => {
  await knex("surveys").where("id", req.params.id).update(req.body);
  res.redirect("/surveys");
});

// --------------------------
// DONATIONS
// --------------------------
app.get("/donations", requireLogin, async (req, res) => {
  const donations = await knex("donations").select("*").catch(() => []);
  res.render("donations/list", { donations });
});

app.get("/donations/add", requireManager, (req, res) => {
  res.render("donations/add");
});

app.post("/donations/add", requireManager, async (req, res) => {
  await knex("donations").insert(req.body);
  res.redirect("/donations");
});

app.get("/donations/edit/:id", requireManager, async (req, res) => {
  const donation = await knex("donations").where("id", req.params.id).first();
  res.render("donations/edit", { donation });
});

app.post("/donations/edit/:id", requireManager, async (req, res) => {
  await knex("donations").where("id", req.params.id).update(req.body);
  res.redirect("/donations");
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

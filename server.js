const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const crypto = require("crypto");
const path = require("path");

const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "TRIQUELME";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CMTV_PASSWORD = process.env.CMTV_PASSWORD;
const MRODRIGUEZ_PASSWORD = process.env.MRODRIGUEZ_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurada.");
}
if (!ADMIN_USERNAME) {
  throw new Error("ADMIN_USERNAME no está configurado.");
}
if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD no está configurada.");
}
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET no está configurada.");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: "12mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta nuevamente más tarde." },
});

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map(v => v.trim())
      .filter(Boolean)
      .map(pair => {
        const idx = pair.indexOf("=");
        if (idx < 0) return [pair, ""];
        return [
          decodeURIComponent(pair.slice(0, idx)),
          decodeURIComponent(pair.slice(idx + 1)),
        ];
      })
  );
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signSession(payload) {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");

  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Date.now() >= payload.exp) return null;
    if (!payload?.username || !payload?.role) return null;
    return payload;
  } catch {
    return null;
  }
}

function getSession(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies.roac_session);
}

function isAuthenticated(req) {
  return !!getSession(req);
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Sesión no autenticada." });
  }
  req.session = session;
  next();
}

function requireEditor(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Sesión no autenticada." });
  }
  if (session.role !== "admin") {
    return res.status(403).json({
      error: "Usuario de solo lectura. No tiene permisos para modificar información."
    });
  }
  req.session = session;
  next();
}

function setSessionCookie(res, user) {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const token = signSession({
    exp: Date.now() + sevenDays,
    username: user.username,
    role: user.role,
  });
  const secure = NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `roac_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `roac_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
  );
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data JSONB NOT NULL,
      revision BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS state_history (
      id BIGSERIAL PRIMARY KEY,
      revision BIGINT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_state_history_created_at
      ON state_history(created_at DESC);
  `);
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("health:", error);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/session", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    username: session.username,
    role: session.role,
  });
});

app.post("/api/login", loginLimiter, (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  const users = [
    {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      role: "admin",
    },
    {
      username: "CMTV",
      password: CMTV_PASSWORD,
      role: "viewer",
    },
    {
      username: "Mrodriguez",
      password: MRODRIGUEZ_PASSWORD,
      role: "viewer",
    },
  ].filter(user => user.password);

  const normalized = username.toUpperCase();
  const user = users.find(
    candidate => candidate.username.toUpperCase() === normalized
  );

  const valid =
    !!user &&
    safeEqual(password, user.password);

  if (!valid) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }

  setSessionCookie(res, user);
  res.json({
    ok: true,
    username: user.username,
    role: user.role,
  });
});

app.post("/api/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/state", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT data, revision, updated_at FROM app_state WHERE id = 1"
    );

    if (result.rowCount === 0) {
      return res.json({
        exists: false,
        state: null,
        revision: 0,
        updatedAt: null,
        username: req.session.username,
        role: req.session.role,
      });
    }

    const row = result.rows[0];
    res.json({
      exists: true,
      state: row.data,
      revision: Number(row.revision),
      updatedAt: row.updated_at,
      username: req.session.username,
      role: req.session.role,
    });
  } catch (error) {
    console.error("GET /api/state:", error);
    res.status(500).json({ error: "No fue posible leer la base de datos." });
  }
});

app.put("/api/state", requireEditor, async (req, res) => {
  const incomingState = req.body?.state;
  const incomingRevision = Number(req.body?.revision);

  if (!incomingState || typeof incomingState !== "object" || !incomingState.casinos) {
    return res.status(400).json({ error: "Estado de aplicación inválido." });
  }
  if (!Number.isInteger(incomingRevision) || incomingRevision < 0) {
    return res.status(400).json({ error: "Revisión inválida." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await client.query(
      "SELECT data, revision, updated_at FROM app_state WHERE id = 1 FOR UPDATE"
    );

    if (current.rowCount === 0) {
      if (incomingRevision !== 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "conflict",
          state: null,
          revision: 0,
          updatedAt: null,
        });
      }

      const inserted = await client.query(
        `INSERT INTO app_state(id, data, revision, updated_at)
         VALUES (1, $1::jsonb, 1, NOW())
         RETURNING revision, updated_at`,
        [JSON.stringify(incomingState)]
      );

      await client.query("COMMIT");
      return res.json({
        ok: true,
        revision: Number(inserted.rows[0].revision),
        updatedAt: inserted.rows[0].updated_at,
      });
    }

    const row = current.rows[0];
    const currentRevision = Number(row.revision);

    if (incomingRevision !== currentRevision) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "conflict",
        state: row.data,
        revision: currentRevision,
        updatedAt: row.updated_at,
      });
    }

    await client.query(
      `INSERT INTO state_history(revision, data)
       VALUES ($1, $2::jsonb)`,
      [currentRevision, JSON.stringify(row.data)]
    );

    const updated = await client.query(
      `UPDATE app_state
       SET data = $1::jsonb,
           revision = revision + 1,
           updated_at = NOW()
       WHERE id = 1
       RETURNING revision, updated_at`,
      [JSON.stringify(incomingState)]
    );

    await client.query(`
      DELETE FROM state_history
      WHERE id NOT IN (
        SELECT id FROM state_history
        ORDER BY created_at DESC
        LIMIT 50
      )
    `);

    await client.query("COMMIT");

    res.json({
      ok: true,
      revision: Number(updated.rows[0].revision),
      updatedAt: updated.rows[0].updated_at,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/state:", error);
    res.status(500).json({ error: "No fue posible guardar en la base de datos." });
  } finally {
    client.release();
  }
});

app.get("/", (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  index: false,
  maxAge: NODE_ENV === "production" ? "1h" : 0,
}));

async function main() {
  await ensureSchema();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ROAC Casinos escuchando en puerto ${PORT}`);
  });
}

main().catch(error => {
  console.error("Error fatal al iniciar:", error);
  process.exit(1);
});

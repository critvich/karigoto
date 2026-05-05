const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "");

      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true });
      }

      if (path === "/api/login" && request.method === "POST") {
        return login(request, env);
      }

      if (path === "/api/logout" && request.method === "POST") {
        return logout(request, env);
      }

      if (path === "/api/session" && request.method === "GET") {
        return getSession(request, env);
      }

      const activityMatch = path.match(/^\/api\/workers\/([A-Z0-9]{4})\/activity$/);
      if (activityMatch) {
        const workerCode = activityMatch[1];
        if (request.method === "GET") {
          return getActivity(env, workerCode);
        }
        if (request.method === "PATCH") {
          return updateActivity(request, env, workerCode);
        }
      }

      const taskListMatch = path.match(/^\/api\/workers\/([A-Z0-9]{4})\/tasks$/);
      if (taskListMatch) {
        const workerCode = taskListMatch[1];
        if (request.method === "GET") {
          return listTasks(env, workerCode);
        }
        if (request.method === "POST") {
          return createTask(request, env, workerCode);
        }
      }

      const taskMatch = path.match(/^\/api\/workers\/([A-Z0-9]{4})\/tasks\/([a-f0-9-]+)$/i);
      if (taskMatch) {
        const workerCode = taskMatch[1];
        const taskId = taskMatch[2];
        if (request.method === "PATCH") {
          return updateTask(request, env, workerCode, taskId);
        }
        if (request.method === "DELETE") {
          return deleteTask(request, env, workerCode, taskId);
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Unexpected error" }, 500);
    }
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders
    }
  });
}

function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}

function badRequest(message) {
  return json({ error: message }, 400);
}

function getBoardTimeZone(env) {
  return String(env.BOARD_TIMEZONE || "America/New_York");
}

function getLocalDayKey(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value || "0000";
  const month = parts.find(part => part.type === "month")?.value || "00";
  const day = parts.find(part => part.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

function getIsoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isAllowedWorker(env, workerCode) {
  const allowed = String(env.ALLOWED_WORKER_CODES || "BRBO")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(Boolean);
  return allowed.includes(workerCode);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function getBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function requireAuth(request, env) {
  const token = await getBearerToken(request);
  if (!token) {
    return { ok: false, response: unauthorized("Missing bearer token.") };
  }

  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const row = await env.boardbinding
    .prepare(`
      SELECT id, username, worker_code
      FROM sessions
      WHERE token_hash = ? AND expires_at > ?
      LIMIT 1
    `)
    .bind(tokenHash, now)
    .first();

  if (!row) {
    return { ok: false, response: unauthorized("Session expired or invalid.") };
  }

  return {
    ok: true,
    session: {
      id: row.id,
      user: row.username,
      workerCode: row.worker_code
    }
  };
}

async function login(request, env) {
  const body = await readJson(request);
  const user = String(body.user || "").trim();
  const password = String(body.password || "");
  const workerCode = String(body.workerCode || "BRBO").trim().toUpperCase();

  if (!user || !password) {
    return badRequest("Username and password are required.");
  }

  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  if (user !== String(env.ADMIN_USER || "").trim()) {
    return unauthorized("This account is not allowed.");
  }

  if (password !== String(env.ADMIN_PASSWORD || "")) {
    return unauthorized("Incorrect password.");
  }

  const token = createToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = new Date(now + 1000 * 60 * 60 * 24 * 14).toISOString();

  await env.boardbinding
    .prepare(`
      INSERT INTO sessions (id, worker_code, username, token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      workerCode,
      user,
      tokenHash,
      new Date(now).toISOString(),
      expiresAt
    )
    .run();

  return json({
    ok: true,
    token,
    user: {
      user,
      workerCode
    }
  });
}

async function logout(request, env) {
  const token = await getBearerToken(request);
  if (!token) {
    return json({ ok: true });
  }

  const tokenHash = await sha256Hex(token);
  await env.boardbinding
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();

  return json({ ok: true });
}

async function getSession(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return json({ user: null });
  }

  return json({
    user: {
      user: auth.session.user,
      workerCode: auth.session.workerCode
    }
  });
}

async function getActivity(env, workerCode) {
  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  await cleanupWorkerState(env, workerCode);

  const row = await env.boardbinding
    .prepare(`
      SELECT title, detail, updated_at
      FROM activities
      WHERE worker_code = ?
      LIMIT 1
    `)
    .bind(workerCode)
    .first();

  if (row?.title === "__LUNCH__") {
    return json({
      activity: {
        title: row.title,
        detail: row.detail,
        updatedAt: row.updated_at
      }
    });
  }

  const doingTask = await env.boardbinding
    .prepare(`
      SELECT title, detail, updated_at
      FROM tasks
      WHERE worker_code = ? AND status = 'doing'
      ORDER BY datetime(updated_at) DESC
      LIMIT 1
    `)
    .bind(workerCode)
    .first();

  if (doingTask) {
    return json({
      activity: {
        title: doingTask.title,
        detail: doingTask.detail,
        updatedAt: doingTask.updated_at
      }
    });
  }

  return json({
    activity: row
      ? {
          title: row.title,
          detail: row.detail,
          updatedAt: row.updated_at
        }
      : null
  });
}

async function updateActivity(request, env, workerCode) {
  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const title = String(body.title || "").trim();
  const detail = String(body.detail || "").trim();
  if (!title) {
    return badRequest("Activity title is required.");
  }

  const now = new Date().toISOString();
  await env.boardbinding
    .prepare(`
      INSERT INTO activities (worker_code, title, detail, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(worker_code) DO UPDATE SET
        title = excluded.title,
        detail = excluded.detail,
        updated_at = excluded.updated_at
    `)
    .bind(workerCode, title, detail, now)
    .run();

  return json({
    ok: true,
    activity: {
      title,
      detail,
      updatedAt: now
    }
  });
}

async function listTasks(env, workerCode) {
  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  await cleanupWorkerState(env, workerCode);

  const { results } = await env.boardbinding
    .prepare(`
      SELECT id, worker_code, preset, title, detail, author, priority, status, done_at, done_day, archived_at, created_at, updated_at
      FROM tasks
      WHERE worker_code = ?
      ORDER BY datetime(created_at) DESC
    `)
    .bind(workerCode)
    .all();

  return json({
    tasks: results.map(row => ({
      id: row.id,
      workerCode: row.worker_code,
      preset: row.preset,
      title: row.title,
      detail: row.detail,
      author: row.author,
      priority: row.priority,
      status: row.status,
      doneAt: row.done_at,
      doneDay: row.done_day,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  });
}

async function createTask(request, env, workerCode) {
  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const body = await readJson(request);
  const preset = String(body.preset || "").trim();
  const title = String(body.title || "").trim();
  const detail = String(body.detail || "").trim();
  const author = String(body.author || "").trim().slice(0, 32);
  const priority = normalizePriority(body.priority);

  if (!preset || !title) {
    return badRequest("Task type and title are required.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.boardbinding
    .prepare(`
      INSERT INTO tasks (id, worker_code, preset, title, detail, author, priority, status, done_at, done_day, archived_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, ?, ?)
    `)
    .bind(id, workerCode, preset, title, detail, author, priority, now, now)
    .run();

  return json({
    ok: true,
    task: {
      id,
      workerCode,
      preset,
      title,
      detail,
      author,
      priority,
      status: "open",
      createdAt: now,
      updatedAt: now
    }
  }, 201);
}

async function updateTask(request, env, workerCode, taskId) {
  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const patch = {};

  if (body.title !== undefined) {
    patch.title = String(body.title || "").trim();
  }
  if (body.detail !== undefined) {
    patch.detail = String(body.detail || "").trim();
  }
  if (body.status !== undefined) {
    patch.status = normalizeStatus(body.status);
  }
  if (body.priority !== undefined) {
    patch.priority = normalizePriority(body.priority);
  }

  if (Object.keys(patch).length === 0) {
    return badRequest("Nothing to update.");
  }

  const existing = await env.boardbinding
    .prepare("SELECT * FROM tasks WHERE id = ? AND worker_code = ? LIMIT 1")
    .bind(taskId, workerCode)
    .first();

  if (!existing) {
    return json({ error: "Task not found." }, 404);
  }

  const nextTitle = patch.title ?? null;
  const nextDetail = patch.detail ?? null;
  const now = new Date().toISOString();
  const currentDay = getLocalDayKey(new Date(), getBoardTimeZone(env));
  const nextPriority = patch.priority ?? existing.priority;
  const nextStatus = patch.status ?? existing.status;
  let nextDoneAt = existing.done_at;
  let nextDoneDay = existing.done_day;
  let nextArchivedAt = existing.archived_at;

  if (patch.status === "doing") {
    await env.boardbinding
      .prepare(`
        UPDATE tasks
        SET status = 'open', done_at = NULL, done_day = NULL, archived_at = NULL, updated_at = ?
        WHERE worker_code = ? AND status = 'doing' AND id != ?
      `)
      .bind(now, workerCode, taskId)
      .run();
    nextDoneAt = null;
    nextDoneDay = null;
    nextArchivedAt = null;
  } else if (patch.status === "open") {
    nextDoneAt = null;
    nextDoneDay = null;
    nextArchivedAt = null;
  } else if (patch.status === "done") {
    nextDoneAt = now;
    nextDoneDay = currentDay;
    nextArchivedAt = null;
  } else if (patch.status === "archived") {
    nextArchivedAt = existing.archived_at || now;
  }

  await env.boardbinding
    .prepare(`
      UPDATE tasks
      SET
        title = COALESCE(?, title),
        detail = COALESCE(?, detail),
        status = ?,
        priority = ?,
        done_at = ?,
        done_day = ?,
        archived_at = ?,
        updated_at = ?
      WHERE id = ? AND worker_code = ?
    `)
    .bind(nextTitle, nextDetail, nextStatus, nextPriority, nextDoneAt, nextDoneDay, nextArchivedAt, now, taskId, workerCode)
    .run();

  return json({ ok: true });
}

async function deleteTask(request, env, workerCode, taskId) {
  if (!isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const existing = await env.boardbinding
    .prepare("SELECT status FROM tasks WHERE id = ? AND worker_code = ? LIMIT 1")
    .bind(taskId, workerCode)
    .first();

  if (!existing) {
    return json({ error: "Task not found." }, 404);
  }

  if (existing.status !== "archived") {
    return badRequest("Only archived tasks can be deleted permanently.");
  }

  await env.boardbinding
    .prepare("DELETE FROM tasks WHERE id = ? AND worker_code = ?")
    .bind(taskId, workerCode)
    .run();

  return json({ ok: true });
}

function normalizePriority(value) {
  const priority = String(value || "Medium").trim().toLowerCase();
  if (priority === "low") return "Low";
  if (priority === "high") return "High";
  return "Medium";
}

function normalizeStatus(value) {
  const status = String(value || "open").trim().toLowerCase();
  if (["open", "doing", "done", "archived"].includes(status)) {
    return status;
  }
  return "open";
}

async function cleanupWorkerState(env, workerCode) {
  const now = new Date().toISOString();
  const currentDay = getLocalDayKey(new Date(), getBoardTimeZone(env));

  await env.boardbinding
    .prepare(`
      UPDATE tasks
      SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE worker_code = ? AND status = 'done' AND done_day IS NOT NULL AND done_day < ?
    `)
    .bind(now, now, workerCode, currentDay)
    .run();

  await env.boardbinding
    .prepare(`
      DELETE FROM tasks
      WHERE worker_code = ? AND status = 'archived' AND archived_at IS NOT NULL AND archived_at < ?
    `)
    .bind(workerCode, getIsoDaysAgo(30))
    .run();
}

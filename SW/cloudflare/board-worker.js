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

      if (path === "/api/display-login" && request.method === "POST") {
        return displayLogin(request, env);
      }

      if (path === "/api/logout" && request.method === "POST") {
        return logout(request, env);
      }

      if (path === "/api/session" && request.method === "GET") {
        return getSession(request, env);
      }

      if (path === "/api/accounts" && request.method === "POST") {
        return requestAccount(request, env);
      }

      if (path === "/api/accounts" && request.method === "GET") {
        return listAccounts(request, env);
      }

      if (path === "/api/workers" && request.method === "GET") {
        return listWorkers(env);
      }

      const accountMatch = path.match(/^\/api\/accounts\/([A-Z]{4})$/i);
      if (accountMatch && request.method === "PATCH") {
        return updateAccountStatus(request, env, normalizeAccountCode(accountMatch[1]));
      }

      if (accountMatch && request.method === "DELETE") {
        return deleteAccount(request, env, normalizeAccountCode(accountMatch[1]));
      }

      if (path === "/api/display" && request.method === "GET") {
        return getDisplayState(env);
      }

      if (path === "/api/display" && request.method === "PATCH") {
        return updateDisplayState(request, env);
      }

      if (path === "/api/display/media" && request.method === "GET") {
        return listMediaAssets(env);
      }

      if (path === "/api/display/media/link" && request.method === "POST") {
        return createLinkedMediaAsset(request, env);
      }

      if (path === "/api/display/media/upload" && request.method === "POST") {
        return uploadMediaAsset(request, env, url.origin);
      }

      const mediaContentMatch = path.match(/^\/api\/display\/media\/([a-f0-9-]+)\/content$/i);
      if (mediaContentMatch && request.method === "GET") {
        return getMediaAssetContent(request, env, mediaContentMatch[1]);
      }

      const mediaAssetMatch = path.match(/^\/api\/display\/media\/([a-f0-9-]+)$/i);
      if (mediaAssetMatch && request.method === "PATCH") {
        return updateMediaAsset(request, env, mediaAssetMatch[1]);
      }

      if (mediaAssetMatch && request.method === "DELETE") {
        return deleteMediaAsset(request, env, mediaAssetMatch[1]);
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

function getConfiguredWorkerCodes(env) {
  return String(env.ALLOWED_WORKER_CODES || "BRBO")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(Boolean);
}

async function isAllowedWorker(env, workerCode) {
  const normalizedWorkerCode = String(workerCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(normalizedWorkerCode)) {
    return false;
  }

  if (getConfiguredWorkerCodes(env).includes(normalizedWorkerCode)) {
    return true;
  }

  const account = await env.boardbinding
    .prepare("SELECT code FROM accounts WHERE code = ? AND status IN ('pending', 'approved') LIMIT 1")
    .bind(normalizedWorkerCode)
    .first();

  return Boolean(account);
}

async function listWorkers(env) {
  const configuredCodes = getConfiguredWorkerCodes(env);
  const { results } = await env.boardbinding
    .prepare("SELECT code FROM accounts WHERE status IN ('pending', 'approved') ORDER BY code ASC")
    .all();
  const codes = [...new Set([
    ...configuredCodes,
    ...results.map(row => row.code)
  ])].filter(code => /^[A-Z0-9]{4}$/.test(code));

  return json({
    workers: codes.map(code => ({
      code,
      title: `${code} Task Board`
    }))
  });
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

function createSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeAccountCode(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidAccountCode(code) {
  return /^[A-Z]{4}$/.test(code);
}

async function hashAccountPassword(password, salt) {
  return sha256Hex(`${salt}:${password}`);
}

function isAdminUser(env, user) {
  const adminUser = String(env.ADMIN_USER || "display-admin").trim();
  return String(user || "").trim() === adminUser;
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

  const isAdmin = isAdminUser(env, row.username);
  if (!isAdmin) {
    const account = await env.boardbinding
      .prepare("SELECT code FROM accounts WHERE code = ? AND status = 'approved' LIMIT 1")
      .bind(row.username)
      .first();

    if (!account) {
      await env.boardbinding
        .prepare("DELETE FROM sessions WHERE id = ?")
        .bind(row.id)
        .run();
      return { ok: false, response: unauthorized("Session expired or invalid.") };
    }
  }

  return {
    ok: true,
    session: {
      id: row.id,
      user: row.username,
      workerCode: row.worker_code,
      isAdmin
    }
  };
}

async function requireAdmin(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return auth;
  }

  if (!auth.session.isAdmin) {
    return { ok: false, response: unauthorized("Admin account required.") };
  }

  return auth;
}

async function requireWorkerAccess(request, env, workerCode) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return auth;
  }

  if (!auth.session.isAdmin && auth.session.workerCode !== workerCode) {
    return { ok: false, response: unauthorized("This account cannot manage this board.") };
  }

  return auth;
}

async function login(request, env) {
  const body = await readJson(request);
  const user = normalizeAccountCode(body.user);
  const password = String(body.password || "");
  const workerCode = String(body.workerCode || "BRBO").trim().toUpperCase();

  if (!user || !password) {
    return badRequest("Username and password are required.");
  }

  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  if (isAdminUser(env, body.user)) {
    if (password !== String(env.ADMIN_PASSWORD || "")) {
      return unauthorized("Incorrect password.");
    }

    return createSession(env, String(env.ADMIN_USER || "display-admin").trim(), workerCode);
  }

  if (!isValidAccountCode(user)) {
    return badRequest("Account code must be four letters.");
  }

  const account = await env.boardbinding
    .prepare("SELECT code, password_salt, password_hash, status FROM accounts WHERE code = ? LIMIT 1")
    .bind(user)
    .first();

  if (!account) {
    return unauthorized("This account is not allowed.");
  }

  if (account.status === "pending") {
    return unauthorized("This account is waiting for admin approval.");
  }

  if (account.status !== "approved") {
    return unauthorized("This account is not approved.");
  }

  const passwordHash = await hashAccountPassword(password, account.password_salt);
  if (passwordHash !== account.password_hash) {
    return unauthorized("Incorrect password.");
  }

  return createSession(env, account.code, account.code);
}

async function displayLogin(request, env) {
  const body = await readJson(request);
  const password = String(body.password || "");
  const workerCode = String(body.workerCode || "BRBO").trim().toUpperCase();
  const user = String(env.ADMIN_USER || "display-admin").trim() || "display-admin";

  if (!password) {
    return badRequest("Password is required.");
  }

  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  if (password !== String(env.ADMIN_PASSWORD || "")) {
    return unauthorized("Incorrect password.");
  }

  return createSession(env, user, workerCode);
}

async function createSession(env, user, workerCode) {
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
      workerCode,
      isAdmin: isAdminUser(env, user)
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
      workerCode: auth.session.workerCode,
      isAdmin: auth.session.isAdmin
    }
  });
}

async function requestAccount(request, env) {
  const body = await readJson(request);
  const code = normalizeAccountCode(body.code);
  const password = String(body.password || "");

  if (!isValidAccountCode(code)) {
    return badRequest("Account code must be four letters.");
  }

  if (password.length < 6) {
    return badRequest("Password must be at least 6 characters.");
  }

  if (isAdminUser(env, code)) {
    return badRequest("That account code is reserved.");
  }

  const existing = await env.boardbinding
    .prepare("SELECT status FROM accounts WHERE code = ? LIMIT 1")
    .bind(code)
    .first();

  if (existing?.status === "pending") {
    return badRequest("That account is already waiting for approval.");
  }

  if (existing?.status === "approved") {
    return badRequest("That account already exists.");
  }

  const now = new Date().toISOString();
  const salt = createSalt();
  const passwordHash = await hashAccountPassword(password, salt);

  await env.boardbinding
    .prepare(`
      INSERT INTO accounts (code, password_salt, password_hash, status, requested_at, approved_at, approved_by, updated_at)
      VALUES (?, ?, ?, 'pending', ?, NULL, '', ?)
      ON CONFLICT(code) DO UPDATE SET
        password_salt = excluded.password_salt,
        password_hash = excluded.password_hash,
        status = 'pending',
        requested_at = excluded.requested_at,
        approved_at = NULL,
        approved_by = '',
        updated_at = excluded.updated_at
    `)
    .bind(code, salt, passwordHash, now, now)
    .run();

  return json({
    ok: true,
    account: {
      code,
      status: "pending",
      requestedAt: now
    }
  }, 201);
}

async function listAccounts(request, env) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const { results } = await env.boardbinding
    .prepare(`
      SELECT code, status, requested_at, approved_at, approved_by, updated_at
      FROM accounts
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        datetime(requested_at) DESC
    `)
    .all();

  return json({
    accounts: results.map(row => ({
      code: row.code,
      status: row.status,
      requestedAt: row.requested_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      updatedAt: row.updated_at
    }))
  });
}

async function updateAccountStatus(request, env, code) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const nextStatus = String(body.status || "").trim().toLowerCase();
  if (!["approved", "rejected", "pending"].includes(nextStatus)) {
    return badRequest("Status must be approved, rejected, or pending.");
  }

  const existing = await env.boardbinding
    .prepare("SELECT code FROM accounts WHERE code = ? LIMIT 1")
    .bind(code)
    .first();

  if (!existing) {
    return json({ error: "Account not found." }, 404);
  }

  const now = new Date().toISOString();
  const approvedAt = nextStatus === "approved" ? now : null;
  const approvedBy = nextStatus === "approved" ? auth.session.user : "";

  await env.boardbinding
    .prepare(`
      UPDATE accounts
      SET status = ?, approved_at = ?, approved_by = ?, updated_at = ?
      WHERE code = ?
    `)
    .bind(nextStatus, approvedAt, approvedBy, now, code)
    .run();

  return json({ ok: true });
}

async function deleteAccount(request, env, code) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const existing = await env.boardbinding
    .prepare("SELECT code FROM accounts WHERE code = ? LIMIT 1")
    .bind(code)
    .first();

  if (!existing) {
    return json({ error: "Account not found." }, 404);
  }

  await env.boardbinding
    .prepare("DELETE FROM accounts WHERE code = ?")
    .bind(code)
    .run();

  await env.boardbinding
    .prepare("DELETE FROM sessions WHERE username = ?")
    .bind(code)
    .run();

  return json({ ok: true });
}

function getDefaultDisplayState() {
  return {
    headline: "",
    subheadline: "",
    statusLabel: "Steelwrist Presents",
    statusValue: "",
    metricOneLabel: "Open Tasks",
    metricOneValue: "0",
    metricTwoLabel: "Orders",
    metricTwoValue: "--",
    metricThreeLabel: "Priority",
    metricThreeValue: "Normal",
    announcement: "",
    ticker: "",
    mediaUrl: "",
    mediaType: "image",
    mediaAlt: "Promotional media",
    ctaLabel: "Now Showing",
    ctaDetail: "",
    playlist: [],
    slideDurationSeconds: 12,
    theme: "day",
    updatedBy: "",
    updatedAt: new Date().toISOString()
  };
}

function rowToDisplayState(row) {
  if (!row) {
    return getDefaultDisplayState();
  }

  return {
    headline: row.headline,
    subheadline: row.subheadline,
    statusLabel: row.status_label,
    statusValue: row.status_value,
    metricOneLabel: row.metric_one_label,
    metricOneValue: row.metric_one_value,
    metricTwoLabel: row.metric_two_label,
    metricTwoValue: row.metric_two_value,
    metricThreeLabel: row.metric_three_label,
    metricThreeValue: row.metric_three_value,
    announcement: row.announcement,
    ticker: row.ticker,
    mediaUrl: row.media_url || "",
    mediaType: row.media_type || "image",
    mediaAlt: row.media_alt || "",
    ctaLabel: row.cta_label || "",
    ctaDetail: row.cta_detail || "",
    playlist: parsePlaylist(row.playlist_json),
    slideDurationSeconds: Number(row.slide_duration_seconds || 12),
    theme: row.theme,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
}

async function getDisplayState(env) {
  const row = await env.boardbinding
    .prepare(`
      SELECT headline, subheadline, status_label, status_value,
        metric_one_label, metric_one_value,
        metric_two_label, metric_two_value,
        metric_three_label, metric_three_value,
        announcement, ticker, media_url, media_type, media_alt,
        cta_label, cta_detail, playlist_json, slide_duration_seconds,
        transition_style, theme, updated_by, updated_at
      FROM tv_display_state
      WHERE id = 'main'
      LIMIT 1
    `)
    .first();

  return json({ display: rowToDisplayState(row) });
}

async function updateDisplayState(request, env) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const current = rowToDisplayState(await env.boardbinding
    .prepare(`
      SELECT headline, subheadline, status_label, status_value,
        metric_one_label, metric_one_value,
        metric_two_label, metric_two_value,
        metric_three_label, metric_three_value,
        announcement, ticker, media_url, media_type, media_alt,
        cta_label, cta_detail, playlist_json, slide_duration_seconds,
        transition_style, theme, updated_by, updated_at
      FROM tv_display_state
      WHERE id = 'main'
      LIMIT 1
    `)
    .first());

  const next = {
    headline: normalizeDisplayText(body.headline, current.headline, 92),
    subheadline: normalizeDisplayText(body.subheadline, current.subheadline, 180),
    statusLabel: normalizeDisplayText(body.statusLabel, current.statusLabel, 34),
    statusValue: normalizeDisplayText(body.statusValue, current.statusValue, 54),
    metricOneLabel: normalizeDisplayText(body.metricOneLabel, current.metricOneLabel, 34),
    metricOneValue: normalizeDisplayText(body.metricOneValue, current.metricOneValue, 28),
    metricTwoLabel: normalizeDisplayText(body.metricTwoLabel, current.metricTwoLabel, 34),
    metricTwoValue: normalizeDisplayText(body.metricTwoValue, current.metricTwoValue, 28),
    metricThreeLabel: normalizeDisplayText(body.metricThreeLabel, current.metricThreeLabel, 34),
    metricThreeValue: normalizeDisplayText(body.metricThreeValue, current.metricThreeValue, 28),
    announcement: normalizeDisplayText(body.announcement, current.announcement, 220),
    ticker: normalizeDisplayText(body.ticker, current.ticker, 280),
    mediaUrl: normalizeDisplayText(body.mediaUrl, current.mediaUrl, 700),
    mediaType: normalizeMediaType(body.mediaType ?? current.mediaType),
    mediaAlt: normalizeDisplayText(body.mediaAlt, current.mediaAlt, 140),
    ctaLabel: normalizeDisplayText(body.ctaLabel, current.ctaLabel, 60),
    ctaDetail: normalizeDisplayText(body.ctaDetail, current.ctaDetail, 180),
    playlist: normalizePlaylist(body.playlist ?? current.playlist),
    slideDurationSeconds: normalizeSlideDuration(body.slideDurationSeconds ?? current.slideDurationSeconds),
    theme: normalizeTheme(body.theme ?? current.theme),
    updatedBy: auth.session.user,
    updatedAt: new Date().toISOString()
  };

  await env.boardbinding
    .prepare(`
      INSERT INTO tv_display_state (
        id, headline, subheadline, status_label, status_value,
        metric_one_label, metric_one_value, metric_two_label, metric_two_value,
        metric_three_label, metric_three_value, announcement, ticker,
        media_url, media_type, media_alt, cta_label, cta_detail,
        playlist_json, slide_duration_seconds, transition_style,
        theme, updated_by, updated_at
      )
      VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        headline = excluded.headline,
        subheadline = excluded.subheadline,
        status_label = excluded.status_label,
        status_value = excluded.status_value,
        metric_one_label = excluded.metric_one_label,
        metric_one_value = excluded.metric_one_value,
        metric_two_label = excluded.metric_two_label,
        metric_two_value = excluded.metric_two_value,
        metric_three_label = excluded.metric_three_label,
        metric_three_value = excluded.metric_three_value,
        announcement = excluded.announcement,
        ticker = excluded.ticker,
        media_url = excluded.media_url,
        media_type = excluded.media_type,
        media_alt = excluded.media_alt,
        cta_label = excluded.cta_label,
        cta_detail = excluded.cta_detail,
        playlist_json = excluded.playlist_json,
        slide_duration_seconds = excluded.slide_duration_seconds,
        transition_style = excluded.transition_style,
        theme = excluded.theme,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `)
    .bind(
      next.headline,
      next.subheadline,
      next.statusLabel,
      next.statusValue,
      next.metricOneLabel,
      next.metricOneValue,
      next.metricTwoLabel,
      next.metricTwoValue,
      next.metricThreeLabel,
      next.metricThreeValue,
      next.announcement,
      next.ticker,
      next.mediaUrl,
      next.mediaType,
      next.mediaAlt,
      next.ctaLabel,
      next.ctaDetail,
      JSON.stringify(next.playlist),
      next.slideDurationSeconds,
      "cinematic",
      next.theme,
      next.updatedBy,
      next.updatedAt
    )
    .run();

  return json({ ok: true, display: next });
}

async function listMediaAssets(env) {
  const { results } = await env.boardbinding
    .prepare(`
      SELECT id, title, media_type, source_type, url, mime_type, size_bytes, created_by, created_at
      FROM media_assets
      ORDER BY datetime(created_at) DESC
    `)
    .all();

  return json({
    assets: results.map(rowToMediaAsset)
  });
}

async function createLinkedMediaAsset(request, env) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const title = normalizeDisplayText(body.title, "", 120);
  const url = normalizeDisplayText(body.url, "", 900);
  const mediaType = normalizeMediaType(body.mediaType);

  if (!title || !url) {
    return badRequest("Title and media URL are required.");
  }

  const asset = {
    id: crypto.randomUUID(),
    title,
    mediaType,
    sourceType: "link",
    url,
    mimeType: "",
    sizeBytes: 0,
    createdBy: auth.session.user,
    createdAt: new Date().toISOString()
  };

  await insertMediaAsset(env, asset, "");
  return json({ ok: true, asset }, 201);
}

async function uploadMediaAsset(request, env, origin) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const mediaBucket = getMediaBucket(env);
  if (!mediaBucket) {
    return badRequest("Uploads need a Cloudflare R2 binding named MEDIA_BUCKET or bucketofun.");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return badRequest("Upload a media file.");
  }

  const title = normalizeDisplayText(form.get("title"), "", 120) || normalizeDisplayText(file.name, "Uploaded media", 120);
  const mediaType = normalizeMediaType(form.get("mediaType") || inferMediaType(file.type));
  const id = crypto.randomUUID();
  const extension = getFileExtension(file.name, mediaType);
  const r2Key = `display-media/${id}${extension}`;
  const bytes = await file.arrayBuffer();

  await mediaBucket.put(r2Key, bytes, {
    httpMetadata: {
      contentType: file.type || (mediaType === "video" ? "video/mp4" : "image/jpeg")
    }
  });

  const asset = {
    id,
    title,
    mediaType,
    sourceType: "upload",
    url: `${origin}/api/display/media/${id}/content`,
    mimeType: file.type || "",
    sizeBytes: file.size || bytes.byteLength || 0,
    createdBy: auth.session.user,
    createdAt: new Date().toISOString()
  };

  await insertMediaAsset(env, asset, r2Key);
  return json({ ok: true, asset }, 201);
}

async function getMediaAssetContent(request, env, assetId) {
  const row = await env.boardbinding
    .prepare("SELECT r2_key, mime_type, size_bytes FROM media_assets WHERE id = ? AND source_type = 'upload' LIMIT 1")
    .bind(assetId)
    .first();

  if (!row || !row.r2_key) {
    return json({ error: "Media not found." }, 404);
  }

  const mediaBucket = getMediaBucket(env);
  if (!mediaBucket) {
    return json({ error: "Media bucket is not configured." }, 503);
  }

  const range = parseRangeHeader(request.headers.get("Range") || "", Number(row.size_bytes || 0));
  const object = range
    ? await mediaBucket.get(row.r2_key, { range: { offset: range.start, length: range.length } })
    : await mediaBucket.get(row.r2_key);
  if (!object) {
    return json({ error: "Media file not found." }, 404);
  }

  return new Response(object.body, {
    status: range ? 206 : 200,
    headers: {
      ...corsHeaders,
      "Content-Type": object.httpMetadata?.contentType || row.mime_type || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "Accept-Ranges": "bytes",
      ...(range
        ? {
            "Content-Range": `bytes ${range.start}-${range.end}/${range.total}`,
            "Content-Length": String(range.length)
          }
        : {})
    }
  });
}

async function deleteMediaAsset(request, env, assetId) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const row = await env.boardbinding
    .prepare("SELECT r2_key FROM media_assets WHERE id = ? LIMIT 1")
    .bind(assetId)
    .first();

  if (!row) {
    return json({ error: "Media not found." }, 404);
  }

  const mediaBucket = getMediaBucket(env);
  if (row.r2_key && mediaBucket) {
    await mediaBucket.delete(row.r2_key);
  }

  await env.boardbinding
    .prepare("DELETE FROM media_assets WHERE id = ?")
    .bind(assetId)
    .run();

  return json({ ok: true });
}

async function updateMediaAsset(request, env, assetId) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const title = normalizeDisplayText(body.title, "", 120);
  if (!title) {
    return badRequest("Media title is required.");
  }

  const existing = await env.boardbinding
    .prepare("SELECT id FROM media_assets WHERE id = ? LIMIT 1")
    .bind(assetId)
    .first();

  if (!existing) {
    return json({ error: "Media not found." }, 404);
  }

  await env.boardbinding
    .prepare("UPDATE media_assets SET title = ? WHERE id = ?")
    .bind(title, assetId)
    .run();

  const row = await env.boardbinding
    .prepare(`
      SELECT id, title, media_type, source_type, url, mime_type, size_bytes, created_by, created_at
      FROM media_assets
      WHERE id = ?
      LIMIT 1
    `)
    .bind(assetId)
    .first();

  return json({ ok: true, asset: rowToMediaAsset(row) });
}

async function insertMediaAsset(env, asset, r2Key) {
  await env.boardbinding
    .prepare(`
      INSERT INTO media_assets (
        id, title, media_type, source_type, url, r2_key, mime_type,
        size_bytes, created_by, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      asset.id,
      asset.title,
      asset.mediaType,
      asset.sourceType,
      asset.url,
      r2Key,
      asset.mimeType,
      asset.sizeBytes,
      asset.createdBy,
      asset.createdAt
    )
    .run();
}

function rowToMediaAsset(row) {
  return {
    id: row.id,
    title: row.title,
    mediaType: row.media_type,
    sourceType: row.source_type,
    url: row.url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function getMediaBucket(env) {
  return env.MEDIA_BUCKET || env.bucketofun || env.BUCKETOFUN || null;
}

function parseRangeHeader(header, totalSize) {
  if (!header || !totalSize) {
    return null;
  }

  const match = String(header).match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return null;
  }

  let start = match[1] ? Number.parseInt(match[1], 10) : 0;
  let end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number.parseInt(match[2], 10);
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  }

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end < start ||
    start >= totalSize
  ) {
    return null;
  }

  end = Math.min(end, totalSize - 1);
  return {
    start,
    end,
    total: totalSize,
    length: end - start + 1
  };
}

async function getActivity(env, workerCode) {
  if (!await isAllowedWorker(env, workerCode)) {
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
  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireWorkerAccess(request, env, workerCode);
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
  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  await cleanupWorkerState(env, workerCode);

  const { results } = await env.boardbinding
    .prepare(`
      SELECT id, worker_code, preset, title, detail, author, priority, status, done_at, done_day, archived_at, created_at, updated_at, edited_at, edited_by
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
      updatedAt: row.updated_at,
      editedAt: row.edited_at,
      editedBy: row.edited_by
    }))
  });
}

async function createTask(request, env, workerCode) {
  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireAuth(request, env);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);
  const preset = String(body.preset || "").trim();
  const title = String(body.title || "").trim();
  const detail = String(body.detail || "").trim();
  const author = String(auth.session.isAdmin ? workerCode : auth.session.user || "").trim().slice(0, 32);
  const priority = normalizePriority(body.priority);

  if (!preset || !title) {
    return badRequest("Task type and title are required.");
  }
  if (!detail) {
    return badRequest("Add at least one ticket detail before posting.");
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
      updatedAt: now,
      editedAt: null,
      editedBy: null
    }
  }, 201);
}

async function updateTask(request, env, workerCode, taskId) {
  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireWorkerAccess(request, env, workerCode);
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
  let nextEditedAt = existing.edited_at;
  let nextEditedBy = existing.edited_by;
  const hasContentEdit =
    (patch.title !== undefined && patch.title !== existing.title) ||
    (patch.detail !== undefined && patch.detail !== existing.detail);

  if (hasContentEdit) {
    nextEditedAt = now;
    nextEditedBy = String(auth.session.isAdmin ? workerCode : auth.session.user || "").trim().slice(0, 32);
  }

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
        updated_at = ?,
        edited_at = ?,
        edited_by = ?
      WHERE id = ? AND worker_code = ?
    `)
    .bind(nextTitle, nextDetail, nextStatus, nextPriority, nextDoneAt, nextDoneDay, nextArchivedAt, now, nextEditedAt, nextEditedBy, taskId, workerCode)
    .run();

  return json({ ok: true });
}

async function deleteTask(request, env, workerCode, taskId) {
  if (!await isAllowedWorker(env, workerCode)) {
    return badRequest("Unknown worker code.");
  }

  const auth = await requireWorkerAccess(request, env, workerCode);
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

function normalizeDisplayText(value, fallback, maxLength) {
  if (value === undefined || value === null) {
    return String(fallback || "").trim();
  }

  return String(value || "").trim().slice(0, maxLength);
}

function normalizeTheme(value) {
  const theme = String(value || "day").trim().toLowerCase();
  if (["day", "night", "alert"].includes(theme)) {
    return theme;
  }

  return "day";
}

function normalizeMediaType(value) {
  const mediaType = String(value || "image").trim().toLowerCase();
  if (["image", "video"].includes(mediaType)) {
    return mediaType;
  }

  return "image";
}

function normalizePlaylist(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item, index) => normalizePlaylistSlide(item, index))
    .filter(item => item.id)
    .slice(0, 30);
}

function normalizePlaylistSlide(item, index = 0) {
  const id = normalizeDisplayText(item?.id || item?.slideId, "", 80) || crypto.randomUUID();
  const legacyUrl = normalizeDisplayText(item?.url, "", 900);
  const mediaItems = Array.isArray(item?.mediaItems)
    ? item.mediaItems.map(normalizeSlideMediaItem).filter(media => media.id && media.url).slice(0, 30)
    : legacyUrl
      ? [{
          id,
          title: normalizeDisplayText(item?.title, `Media ${index + 1}`, 120),
          mediaType: normalizeMediaType(item?.mediaType),
          url: legacyUrl
        }]
      : [];

  return {
    id,
    title: normalizeDisplayText(item?.title || item?.slideTitle, `Slide ${index + 1}`, 120),
    mediaItems,
    mediaDurationSeconds: normalizeSlideDuration(item?.mediaDurationSeconds || 0, true),
    durationSeconds: normalizeSlideDuration(item?.durationSeconds || 0, true),
    layoutMode: normalizeLayoutMode(item?.layoutMode),
    statusLabel: normalizeDisplayText(item?.statusLabel, "", 34),
    headline: normalizeDisplayText(item?.headline, "", 92),
    subheadline: normalizeDisplayText(item?.subheadline, "", 180),
    announcement: normalizeDisplayText(item?.announcement, "", 220)
  };
}

function normalizeSlideMediaItem(item) {
  const id = normalizeDisplayText(item?.id, "", 80) || crypto.randomUUID();
  return {
    id,
    title: normalizeDisplayText(item?.title, "Untitled media", 120),
    mediaType: normalizeMediaType(item?.mediaType),
    url: normalizeDisplayText(item?.url, "", 900)
  };
}

function normalizeSlideDuration(value, allowZero = false) {
  const duration = Number.parseInt(value, 10);
  if (allowZero && duration === 0) {
    return 0;
  }

  if (Number.isNaN(duration)) {
    return 12;
  }

  return Math.max(3, Math.min(duration, 300));
}

function normalizeTransitionStyle(value) {
  const transitionStyle = String(value || "fade").trim().toLowerCase();
  if (["fade", "cut"].includes(transitionStyle)) {
    return transitionStyle;
  }

  return "fade";
}

function normalizeLayoutMode(value) {
  const layoutMode = String(value || "split").trim().toLowerCase();
  if (["fullscreen", "fullscreen-text", "split"].includes(layoutMode)) {
    return layoutMode;
  }

  return "split";
}

function parsePlaylist(value) {
  try {
    return normalizePlaylist(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function inferMediaType(mimeType) {
  return String(mimeType || "").toLowerCase().startsWith("video/") ? "video" : "image";
}

function getFileExtension(fileName, mediaType) {
  const match = String(fileName || "").match(/\.[a-z0-9]{2,8}$/i);
  if (match) {
    return match[0].toLowerCase();
  }

  return mediaType === "video" ? ".mp4" : ".jpg";
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

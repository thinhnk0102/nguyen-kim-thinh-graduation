const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3000;
const ROOT = __dirname;
const WISHES_FILE = path.join(ROOT, "data", "wishes.json");

const ADMIN_USER = process.env.ADMIN_USER || "nguyenkimthinh";
const ADMIN_PASS = process.env.ADMIN_PASS || "abc@123";
const SESSION_MAX_AGE = 24 * 60 * 60;

const sessions = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

function ensureWishesFile() {
  const dir = path.dirname(WISHES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(WISHES_FILE)) {
    fs.writeFileSync(WISHES_FILE, "[]", "utf-8");
  }
}

function readWishes() {
  ensureWishesFile();
  try {
    const raw = fs.readFileSync(WISHES_FILE, "utf-8").replace(/^\uFEFF/, "");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Lỗi đọc wishes.json:", err.message);
    return [];
  }
}

function writeWishes(wishes) {
  ensureWishesFile();
  fs.writeFileSync(WISHES_FILE, JSON.stringify(wishes, null, 2), "utf-8");
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || "";
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });
  return token;
}

function getAuthToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return parseCookies(req).admin_session || null;
}

function getSession(req) {
  const token = getAuthToken(req);
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return { token, ...session };
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `admin_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Strict`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict");
}

function sendJSON(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    sendJSON(res, 401, { success: false, message: "Bạn cần đăng nhập để thực hiện thao tác này." });
    return null;
  }
  return session;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.toLowerCase().startsWith(ROOT.toLowerCase())) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (ext === ".js" || ext === ".css" || ext === ".html") {
      headers["Cache-Control"] = "no-cache";
    }
    if (ext === ".mp3" || ext === ".webm" || ext === ".ogg") {
      headers["Accept-Ranges"] = "bytes";
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  if (req.method === "OPTIONS") {
    sendJSON(res, 204, {});
    return;
  }

  // --- Public wishes API ---
  if (urlPath === "/api/wishes" && req.method === "GET") {
    sendJSON(res, 200, { success: true, wishes: readWishes() });
    return;
  }

  if (urlPath === "/api/wishes" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const name = String(body.name || "").trim();
      const attendance = String(body.attendance || "").trim();
      const wish = String(body.wish || "").trim();

      if (!name) {
        sendJSON(res, 400, { success: false, message: "Vui lòng nhập tên của bạn." });
        return;
      }

      if (!["attending", "maybe", "absent"].includes(attendance)) {
        sendJSON(res, 400, { success: false, message: "Vui lòng chọn phản hồi tham dự." });
        return;
      }

      const newWish = {
        id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        attendance,
        wish,
        createdAt: new Date().toISOString(),
      };

      const wishes = readWishes();
      wishes.push(newWish);
      writeWishes(wishes);

      sendJSON(res, 201, { success: true, wish: newWish, wishes });
      return;
    } catch (err) {
      sendJSON(res, 400, { success: false, message: err.message || "Dữ liệu không hợp lệ." });
      return;
    }
  }

  // --- Admin auth API ---
  if (urlPath === "/api/admin/login" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");

      if (!safeEqual(username, ADMIN_USER) || !safeEqual(password, ADMIN_PASS)) {
        sendJSON(res, 401, { success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng." });
        return;
      }

      const token = createSession(username);
      setSessionCookie(res, token);
      sendJSON(res, 200, {
        success: true,
        message: "Đăng nhập thành công.",
        username,
        token,
      });
      return;
    } catch (err) {
      sendJSON(res, 400, { success: false, message: err.message || "Dữ liệu không hợp lệ." });
      return;
    }
  }

  if (urlPath === "/api/admin/logout" && req.method === "POST") {
    const session = getSession(req);
    destroySession(session?.token);
    clearSessionCookie(res);
    sendJSON(res, 200, { success: true, message: "Đã đăng xuất." });
    return;
  }

  if (urlPath === "/api/admin/session" && req.method === "GET") {
    const session = getSession(req);
    if (!session) {
      sendJSON(res, 200, { success: true, loggedIn: false });
      return;
    }
    sendJSON(res, 200, { success: true, loggedIn: true, username: session.username });
    return;
  }

  if (urlPath === "/api/admin/wishes" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJSON(res, 200, { success: true, wishes: readWishes(), file: "data/wishes.json" });
    return;
  }

  if (urlPath === "/api/admin/wishes" && req.method === "DELETE") {
    if (!requireAuth(req, res)) return;
    writeWishes([]);
    sendJSON(res, 200, { success: true, message: "Đã xóa toàn bộ lời chúc.", wishes: [] });
    return;
  }

  const deleteMatch = urlPath.match(/^\/api\/admin\/wishes\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    if (!requireAuth(req, res)) return;

    const wishId = deleteMatch[1];
    const wishes = readWishes();
    const filtered = wishes.filter((w) => w.id !== wishId);

    if (filtered.length === wishes.length) {
      sendJSON(res, 404, { success: false, message: "Không tìm thấy lời chúc này." });
      return;
    }

    writeWishes(filtered);
    sendJSON(res, 200, { success: true, message: "Đã xóa lời chúc.", wishes: filtered });
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

ensureWishesFile();
server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  console.log(`Admin panel: http://127.0.0.1:${PORT}/admin.html`);
});

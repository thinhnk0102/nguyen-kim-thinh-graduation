const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3000;
const ROOT = __dirname;
const WISHES_FILE = path.join(ROOT, "data", "wishes.json");
const WISHES_BACKUP_FILE = path.join(ROOT, "data", "wishes.backup.json");
const WISHES_HISTORY_DIR = path.join(ROOT, "data", "backups");
const MAX_WISH_BACKUPS = 30;

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

function backupWishesFile() {
  if (!fs.existsSync(WISHES_FILE)) return;

  const current = fs.readFileSync(WISHES_FILE, "utf-8");
  fs.writeFileSync(WISHES_BACKUP_FILE, current, "utf-8");

  if (!fs.existsSync(WISHES_HISTORY_DIR)) {
    fs.mkdirSync(WISHES_HISTORY_DIR, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(WISHES_HISTORY_DIR, `wishes-${stamp}.json`), current, "utf-8");

  const historyFiles = fs
    .readdirSync(WISHES_HISTORY_DIR)
    .filter((name) => name.startsWith("wishes-") && name.endsWith(".json"))
    .sort()
    .reverse();

  historyFiles.slice(MAX_WISH_BACKUPS).forEach((name) => {
    fs.unlinkSync(path.join(WISHES_HISTORY_DIR, name));
  });
}

function readWishesFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

function listWishBackups() {
  const items = [];

  if (fs.existsSync(WISHES_BACKUP_FILE)) {
    try {
      const wishes = readWishesFromFile(WISHES_BACKUP_FILE);
      const stat = fs.statSync(WISHES_BACKUP_FILE);
      items.push({
        id: "latest-backup",
        label: "Bản backup gần nhất",
        file: "data/wishes.backup.json",
        count: wishes.length,
        updatedAt: stat.mtime.toISOString(),
      });
    } catch {
      /* ignore invalid backup */
    }
  }

  if (fs.existsSync(WISHES_HISTORY_DIR)) {
    fs.readdirSync(WISHES_HISTORY_DIR)
      .filter((name) => name.startsWith("wishes-") && name.endsWith(".json"))
      .sort()
      .reverse()
      .forEach((name) => {
        const filePath = path.join(WISHES_HISTORY_DIR, name);
        try {
          const wishes = readWishesFromFile(filePath);
          const stat = fs.statSync(filePath);
          items.push({
            id: name,
            label: name.replace("wishes-", "").replace(/-/g, ":").replace(".json", ""),
            file: `data/backups/${name}`,
            count: wishes.length,
            updatedAt: stat.mtime.toISOString(),
          });
        } catch {
          /* ignore invalid history file */
        }
      });
  }

  return items;
}

function resolveBackupFile(source) {
  if (!source || source === "latest-backup") {
    return fs.existsSync(WISHES_BACKUP_FILE) ? WISHES_BACKUP_FILE : null;
  }

  if (source.startsWith("wishes-") && source.endsWith(".json")) {
    const filePath = path.join(WISHES_HISTORY_DIR, path.basename(source));
    return fs.existsSync(filePath) ? filePath : null;
  }

  return null;
}

function writeWishes(wishes) {
  ensureWishesFile();
  backupWishesFile();
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
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

  const wishReplyMatch = urlPath.match(/^\/api\/wishes\/([^/]+)\/replies$/);

  if (wishReplyMatch && req.method === "POST") {
    try {
      const wishId = wishReplyMatch[1];
      const body = await parseBody(req);
      const isAnonymous = body.anonymous === true;
      let name = String(body.name || "").trim();
      const text = String(body.text || "").trim();

      if (isAnonymous) {
        name = "Ẩn danh";
      } else if (!name) {
        sendJSON(res, 400, { success: false, message: "Vui lòng nhập tên của bạn." });
        return;
      }

      if (!text) {
        sendJSON(res, 400, { success: false, message: "Vui lòng nhập nội dung trả lời." });
        return;
      }

      if (text.length > 300) {
        sendJSON(res, 400, { success: false, message: "Trả lời tối đa 300 ký tự." });
        return;
      }

      const wishes = readWishes();
      const index = wishes.findIndex((w) => w.id === wishId);

      if (index === -1) {
        sendJSON(res, 404, { success: false, message: "Không tìm thấy lời chúc này." });
        return;
      }

      const wish = { ...wishes[index] };

      if (!String(wish.reply || "").trim()) {
        sendJSON(res, 400, { success: false, message: "Thịnh chưa trả lời lời chúc này." });
        return;
      }

      const comment = {
        id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.slice(0, 50),
        anonymous: isAnonymous,
        text,
        createdAt: new Date().toISOString(),
      };

      wish.replyComments = Array.isArray(wish.replyComments) ? wish.replyComments : [];
      if (wish.replyComments.length >= 100) {
        sendJSON(res, 400, { success: false, message: "Đã đạt giới hạn trả lời cho lời chúc này." });
        return;
      }

      wish.replyComments.push(comment);
      wishes[index] = wish;
      writeWishes(wishes);

      sendJSON(res, 201, {
        success: true,
        message: "Đã gửi trả lời.",
        comment,
        wish,
        wishes,
      });
      return;
    } catch (err) {
      sendJSON(res, 400, { success: false, message: err.message || "Dữ liệu không hợp lệ." });
      return;
    }
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

  if (urlPath === "/api/admin/wishes/backups" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJSON(res, 200, {
      success: true,
      backups: listWishBackups(),
      currentCount: readWishes().length,
    });
    return;
  }

  if (urlPath === "/api/admin/wishes/restore" && req.method === "POST") {
    if (!requireAuth(req, res)) return;

    try {
      const body = await parseBody(req);

      if (Array.isArray(body.wishes)) {
        writeWishes(body.wishes);
        sendJSON(res, 200, {
          success: true,
          message: `Đã nhập ${body.wishes.length} lời chúc.`,
          wishes: readWishes(),
        });
        return;
      }

      const backupFile = resolveBackupFile(body.source);
      if (!backupFile) {
        sendJSON(res, 404, { success: false, message: "Không tìm thấy file backup để khôi phục." });
        return;
      }

      const restored = readWishesFromFile(backupFile);
      writeWishes(restored);
      sendJSON(res, 200, {
        success: true,
        message: `Đã khôi phục ${restored.length} lời chúc.`,
        wishes: restored,
      });
      return;
    } catch (err) {
      sendJSON(res, 400, { success: false, message: err.message || "Không thể khôi phục dữ liệu." });
      return;
    }
  }

  if (urlPath === "/api/admin/wishes" && req.method === "DELETE") {
    if (!requireAuth(req, res)) return;
    writeWishes([]);
    sendJSON(res, 200, { success: true, message: "Đã xóa toàn bộ lời chúc.", wishes: [] });
    return;
  }

  const wishIdMatch = urlPath.match(/^\/api\/admin\/wishes\/([^/]+)$/);

  if (wishIdMatch && req.method === "PATCH") {
    if (!requireAuth(req, res)) return;

    try {
      const wishId = wishIdMatch[1];
      const body = await parseBody(req);
      const wishes = readWishes();
      const index = wishes.findIndex((w) => w.id === wishId);

      if (index === -1) {
        sendJSON(res, 404, { success: false, message: "Không tìm thấy lời chúc này." });
        return;
      }

      const wish = { ...wishes[index] };

      if (Object.prototype.hasOwnProperty.call(body, "reply")) {
        const reply = String(body.reply || "").trim();
        if (reply) {
          wish.reply = reply;
          wish.replyAt = new Date().toISOString();
        } else {
          delete wish.reply;
          delete wish.replyAt;
        }
      }

      if (body.clearReply === true) {
        delete wish.reply;
        delete wish.replyAt;
        delete wish.replyComments;
      }

      if (body.deleteReplyComment) {
        const commentId = String(body.deleteReplyComment);
        wish.replyComments = (wish.replyComments || []).filter((c) => c.id !== commentId);
      }

      const VALID_REACTIONS = new Set(["love", "haha", "moved"]);

      if (Object.prototype.hasOwnProperty.call(body, "reaction")) {
        const reaction = body.reaction;
        if (reaction === null || reaction === "") {
          delete wish.reaction;
          delete wish.reactionAt;
        } else if (VALID_REACTIONS.has(reaction)) {
          wish.reaction = reaction;
          wish.reactionAt = new Date().toISOString();
        }
        delete wish.liked;
      }

      if (typeof body.liked === "boolean") {
        if (body.liked) {
          wish.reaction = "love";
          wish.reactionAt = wish.reactionAt || new Date().toISOString();
        } else {
          delete wish.reaction;
          delete wish.reactionAt;
        }
        delete wish.liked;
      }

      if (typeof body.pinned === "boolean") {
        wish.pinned = body.pinned;
      }

      wishes[index] = wish;
      writeWishes(wishes);
      sendJSON(res, 200, { success: true, message: "Đã cập nhật lời chúc.", wish, wishes });
      return;
    } catch (err) {
      sendJSON(res, 400, { success: false, message: err.message || "Dữ liệu không hợp lệ." });
      return;
    }
  }

  if (wishIdMatch && req.method === "DELETE") {
    if (!requireAuth(req, res)) return;

    const wishId = wishIdMatch[1];
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

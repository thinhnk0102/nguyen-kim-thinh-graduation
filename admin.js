const loginSection = document.getElementById("login-section");
const panelSection = document.getElementById("panel-section");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const wishesList = document.getElementById("wishes-admin-list");
const adminUserLabel = document.getElementById("admin-user-label");
const serverBanner = document.getElementById("server-banner");

const API_BASE = (() => {
  const isLocalhost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  if (location.protocol === "file:") return "http://127.0.0.1:3000";
  if (isLocalhost && location.port && location.port !== "3000") return "http://127.0.0.1:3000";
  return "";
})();

const ADMIN_TOKEN_KEY = "admin_token";

let wishes = [];

function getToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setToken(token) {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, (tag) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)
  );
}

function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function attendanceBadge(attendance) {
  if (attendance === "attending") return { cls: "badge-attending", text: "Sẽ tham dự" };
  if (attendance === "absent") return { cls: "badge-absent", text: "Bận việc" };
  return { cls: "badge-maybe", text: "Có thể đến" };
}

function showServerBanner(message) {
  if (!serverBanner) return;
  serverBanner.hidden = false;
  serverBanner.textContent = message;
}

function hideServerBanner() {
  if (serverBanner) serverBanner.hidden = true;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Không kết nối được server. Mở terminal trong thư mục thiepmoi, chạy: npm start — rồi mở http://127.0.0.1:3000/admin.html"
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Lỗi server (${res.status})`);
  }
  return data;
}

async function checkServer() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/session`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (res.ok) {
      hideServerBanner();
      return true;
    }
  } catch {
    showServerBanner("⚠ Server chưa chạy! Mở terminal → npm start → truy cập http://127.0.0.1:3000/admin.html");
    return false;
  }
  return true;
}

function showLogin() {
  loginSection.hidden = false;
  panelSection.hidden = true;
}

function showPanel(username) {
  loginSection.hidden = true;
  panelSection.hidden = false;
  adminUserLabel.textContent = `👤 ${username}`;
}

function updateStats() {
  document.getElementById("stat-total").textContent = wishes.length;
  document.getElementById("stat-attending").textContent = wishes.filter((w) => w.attendance === "attending").length;
  document.getElementById("stat-maybe").textContent = wishes.filter((w) => w.attendance === "maybe").length;
  document.getElementById("stat-absent").textContent = wishes.filter((w) => w.attendance === "absent").length;
}

function renderWishes() {
  updateStats();

  if (!wishes.length) {
    wishesList.innerHTML = `<div class="wish-admin-empty"><i class="fa-regular fa-comment-dots"></i><br>Chưa có lời chúc nào.</div>`;
    return;
  }

  wishesList.innerHTML = "";
  [...wishes].reverse().forEach((item) => {
    const badge = attendanceBadge(item.attendance);
    const el = document.createElement("div");
    el.className = "wish-admin-item";
    el.innerHTML = `
      <div class="wish-admin-top">
        <span class="wish-admin-name">${escapeHTML(item.name)}</span>
        <div class="wish-admin-meta">
          <span class="badge ${badge.cls}">${badge.text}</span>
          <span class="wish-admin-time">${formatTime(item.createdAt)}</span>
        </div>
      </div>
      <p class="wish-admin-content">${item.wish ? `"${escapeHTML(item.wish)}"` : "<em>Không có lời chúc</em>"}</p>
      <button class="btn btn-danger btn-sm delete-btn" data-id="${escapeHTML(item.id)}">
        <i class="fa-solid fa-trash"></i> Xóa
      </button>
    `;
    wishesList.appendChild(el);
  });

  wishesList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteWish(btn.dataset.id));
  });
}

async function loadWishes() {
  const data = await api("/api/admin/wishes");
  wishes = data.wishes || [];
  renderWishes();
}

async function deleteWish(id) {
  if (!confirm("Bạn có chắc muốn xóa lời chúc này?")) return;
  const data = await api(`/api/admin/wishes/${encodeURIComponent(id)}`, { method: "DELETE" });
  wishes = data.wishes || [];
  renderWishes();
}

async function checkSession() {
  const serverOk = await checkServer();
  if (!serverOk) {
    showLogin();
    return false;
  }

  try {
    const data = await api("/api/admin/session");
    if (data.loggedIn) {
      showPanel(data.username);
      await loadWishes();
      return true;
    }
  } catch {
    setToken("");
  }

  showLogin();
  return false;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const username = document.getElementById("admin-user").value.trim();
  const password = document.getElementById("admin-pass").value;

  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (data.token) setToken(data.token);

    hideServerBanner();
    showPanel(data.username || username);
    loginForm.reset();
    await loadWishes();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST" }); } catch { /* ignore */ }
  setToken("");
  showLogin();
});

document.getElementById("refresh-btn").addEventListener("click", async () => {
  try {
    await loadWishes();
    hideServerBanner();
  } catch (err) {
    showServerBanner(err.message);
  }
});

document.getElementById("clear-all-btn").addEventListener("click", async () => {
  if (!confirm("Xóa TOÀN BỘ lời chúc trong file wishes.json? Hành động này không thể hoàn tác.")) return;
  try {
    const data = await api("/api/admin/wishes", { method: "DELETE" });
    wishes = data.wishes || [];
    renderWishes();
  } catch (err) {
    alert(err.message);
  }
});

checkSession();

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

const REACTIONS = {
  love: { emoji: "❤️", label: "Tym", adminLabel: "Đã thả tym" },
  haha: { emoji: "😂", label: "Haha", adminLabel: "Đã cười haha" },
  moved: { emoji: "🥹", label: "Cảm động", adminLabel: "Đã cảm động" },
};

function getWishReaction(wish) {
  if (wish?.reaction && REACTIONS[wish.reaction]) return wish.reaction;
  if (wish?.liked) return "love";
  return null;
}

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

function sortWishes(list) {
  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function updateStats() {
  document.getElementById("stat-total").textContent = wishes.length;
  document.getElementById("stat-attending").textContent = wishes.filter((w) => w.attendance === "attending").length;
  document.getElementById("stat-maybe").textContent = wishes.filter((w) => w.attendance === "maybe").length;
  document.getElementById("stat-absent").textContent = wishes.filter((w) => w.attendance === "absent").length;
  const statReplied = document.getElementById("stat-replied");
  if (statReplied) {
    statReplied.textContent = wishes.filter((w) => w.reply).length;
  }
}

function renderWishes() {
  updateStats();

  if (!wishes.length) {
    wishesList.innerHTML = `<div class="wish-admin-empty"><i class="fa-regular fa-comment-dots"></i><br>Chưa có lời chúc nào.</div>`;
    return;
  }

  wishesList.innerHTML = "";
  sortWishes(wishes).forEach((item) => {
    const badge = attendanceBadge(item.attendance);
    const el = document.createElement("article");
    el.className = `wish-admin-item${item.pinned ? " is-pinned" : ""}`;
    el.dataset.id = item.id;
    el.innerHTML = `
      <div class="wish-admin-top">
        <div class="wish-admin-title-wrap">
          ${item.pinned ? '<span class="pin-flag"><i class="fa-solid fa-thumbtack"></i> Ghim</span>' : ""}
          <span class="wish-admin-name">${escapeHTML(item.name)}</span>
        </div>
        <div class="wish-admin-meta">
          <span class="badge ${badge.cls}">${badge.text}</span>
          ${getWishReaction(item) ? `<span class="badge badge-reaction badge-reaction-${getWishReaction(item)}">${REACTIONS[getWishReaction(item)].emoji} ${REACTIONS[getWishReaction(item)].adminLabel}</span>` : ""}
          <span class="wish-admin-time">${formatTime(item.createdAt)}</span>
        </div>
      </div>
      <p class="wish-admin-content">${item.wish ? `"${escapeHTML(item.wish)}"` : "<em>Không có lời chúc</em>"}</p>
      ${item.reply ? `
        <div class="wish-admin-comment">
          <span class="wish-admin-comment-avatar" aria-hidden="true">T</span>
          <div class="wish-admin-comment-main">
            <div class="wish-admin-comment-bubble">
              <strong>Nguyễn Kim Thịnh</strong>
              <p>${escapeHTML(item.reply)}</p>
            </div>
            <div class="wish-admin-comment-actions">
              <span class="wish-admin-comment-time">${formatTime(item.replyAt)}</span>
              <button type="button" class="wish-admin-comment-btn" data-action="edit-reply">Sửa</button>
              <button type="button" class="wish-admin-comment-btn wish-admin-comment-btn-danger" data-action="clear-reply">Xóa</button>
            </div>
            ${(item.replyComments || []).length ? `
              <div class="wish-admin-thread-replies">
                ${(item.replyComments || []).map((c) => {
                  const isAnon = Boolean(c.anonymous) || c.name === "Ẩn danh";
                  const label = isAnon ? '<span class="anon-tag">Ẩn danh</span>' : escapeHTML(c.name);
                  return `
                  <div class="wish-admin-thread-reply">
                    <div class="wish-admin-thread-reply-bubble">
                      <strong>${label}</strong>
                      <p>${escapeHTML(c.text)}</p>
                    </div>
                    <div class="wish-admin-comment-actions">
                      <span class="wish-admin-comment-time">${formatTime(c.createdAt)}</span>
                      <button type="button" class="wish-admin-comment-btn wish-admin-comment-btn-danger" data-action="delete-thread-reply" data-comment-id="${escapeHTML(c.id)}">Xóa</button>
                    </div>
                  </div>`;
                }).join("")}
              </div>
            ` : ""}
          </div>
        </div>
      ` : ""}
      <div class="reaction-wrap">
        <button type="button" class="reaction-trigger-btn" data-action="toggle-react-menu" aria-expanded="false" aria-haspopup="true">
          ${getWishReaction(item)
            ? `<span class="reaction-trigger-emoji">${REACTIONS[getWishReaction(item)].emoji}</span><span>Đổi cảm xúc</span>`
            : `<span class="reaction-trigger-emoji reaction-trigger-default" aria-hidden="true">😊</span><span>Thả cảm xúc</span>`}
          <i class="fa-solid fa-chevron-up reaction-trigger-caret" aria-hidden="true"></i>
        </button>
        <div class="reaction-popup" hidden>
          <div class="reaction-popup-track" role="menu" aria-label="Chọn cảm xúc">
            ${Object.entries(REACTIONS).map(([key, meta]) => `
              <button type="button" class="reaction-popup-btn${getWishReaction(item) === key ? " is-active" : ""}" data-action="react" data-reaction="${key}" title="${meta.label}" role="menuitem">
                <span class="reaction-popup-emoji" aria-hidden="true">${meta.emoji}</span>
                <span class="reaction-popup-label">${meta.label}</span>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="wish-admin-actions">
        <button type="button" class="btn btn-outline btn-sm action-btn" data-action="pin" title="Ghim lên đầu">
          <i class="fa-solid fa-thumbtack"></i> ${item.pinned ? "Bỏ ghim" : "Ghim"}
        </button>
        ${item.reply ? "" : `
        <button type="button" class="btn btn-primary btn-sm action-btn" data-action="toggle-reply">
          <i class="fa-solid fa-comment-dots"></i> Trả lời
        </button>`}
        <button type="button" class="btn btn-danger btn-sm action-btn" data-action="delete">
          <i class="fa-solid fa-trash"></i> Xóa
        </button>
      </div>
      <form class="wish-reply-form" data-id="${escapeHTML(item.id)}" hidden>
        <label class="reply-label" for="reply-${escapeHTML(item.id)}">Trả lời ${escapeHTML(item.name)}</label>
        <textarea id="reply-${escapeHTML(item.id)}" rows="3" maxlength="500" placeholder="Viết lời cảm ơn hoặc phản hồi...">${item.reply ? escapeHTML(item.reply) : ""}</textarea>
        <div class="reply-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-paper-plane"></i> ${item.reply ? "Cập nhật" : "Gửi trả lời"}
          </button>
          <button type="button" class="btn btn-outline btn-sm" data-action="cancel-reply">Hủy</button>
        </div>
      </form>
    `;
    wishesList.appendChild(el);
  });
}

async function updateWish(id, body) {
  const data = await api(`/api/admin/wishes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  wishes = data.wishes || [];
  renderWishes();
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
  const typed = prompt(
    "CẢNH BÁO: Xóa toàn bộ lời chúc?\nNhập XOA (viết hoa) để xác nhận:"
  );
  if (typed !== "XOA") return;

  try {
    const data = await api("/api/admin/wishes", { method: "DELETE" });
    wishes = data.wishes || [];
    renderWishes();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("restore-backup-btn")?.addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/wishes/backups");
    const backups = data.backups || [];

    if (!backups.length) {
      alert("Chưa có file backup nào trên server.");
      return;
    }

    const lines = backups.map((item, index) => {
      const time = formatTime(item.updatedAt);
      return `${index + 1}. ${item.count} lời chúc · ${time}`;
    });

    const choice = prompt(
      `Chọn bản backup để khôi phục:\n\n${lines.join("\n")}\n\nNhập số thứ tự (1-${backups.length}):`
    );
    const index = Number(choice) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= backups.length) return;

    const selected = backups[index];
    if (!confirm(`Khôi phục ${selected.count} lời chúc từ backup này? Dữ liệu hiện tại sẽ được backup trước.`)) return;

    const restored = await api("/api/admin/wishes/restore", {
      method: "POST",
      body: JSON.stringify({ source: selected.id }),
    });
    wishes = restored.wishes || [];
    renderWishes();
    alert(restored.message || "Đã khôi phục.");
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("import-browser-btn")?.addEventListener("click", async () => {
  const raw = localStorage.getItem("graduation_wishes_backup");
  if (!raw) {
    alert("Trình duyệt này không có bản sao lời chúc (graduation_wishes_backup).");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    alert("Dữ liệu backup trong trình duyệt không hợp lệ.");
    return;
  }

  if (!Array.isArray(parsed) || !parsed.length) {
    alert("Backup trình duyệt rỗng.");
    return;
  }

  if (!confirm(`Nhập ${parsed.length} lời chúc từ trình duyệt vào server?`)) return;

  try {
    const data = await api("/api/admin/wishes/restore", {
      method: "POST",
      body: JSON.stringify({ wishes: parsed }),
    });
    wishes = data.wishes || [];
    renderWishes();
    alert(data.message || "Đã nhập dữ liệu.");
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("export-btn")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(wishes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wishes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

function closeAllReactionPopups() {
  wishesList.querySelectorAll(".reaction-wrap.is-open").forEach((wrap) => {
    wrap.classList.remove("is-open");
    const popup = wrap.querySelector(".reaction-popup");
    const trigger = wrap.querySelector(".reaction-trigger-btn");
    if (popup) popup.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".reaction-wrap")) {
    closeAllReactionPopups();
  }
});

wishesList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const item = btn.closest(".wish-admin-item");
  const id = item?.dataset.id;
  if (!id) return;

  const action = btn.dataset.action;
  const wish = wishes.find((w) => w.id === id);

  try {
    if (action === "delete") {
      await deleteWish(id);
      return;
    }

    if (action === "toggle-react-menu") {
      e.stopPropagation();
      const wrap = btn.closest(".reaction-wrap");
      const popup = wrap?.querySelector(".reaction-popup");
      if (!wrap || !popup) return;
      const willOpen = popup.hidden;
      closeAllReactionPopups();
      if (willOpen) {
        popup.hidden = false;
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
      return;
    }

    if (action === "react") {
      e.stopPropagation();
      const reaction = btn.dataset.reaction;
      const current = getWishReaction(wish);
      closeAllReactionPopups();
      await updateWish(id, { reaction: current === reaction ? null : reaction });
      return;
    }

    if (action === "pin") {
      await updateWish(id, { pinned: !wish?.pinned });
      return;
    }

    if (action === "toggle-reply" || action === "edit-reply") {
      const form = item.querySelector(".wish-reply-form");
      if (form) {
        form.hidden = false;
        const textarea = form.querySelector("textarea");
        textarea?.focus();
        if (action === "edit-reply" && textarea) {
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }
      return;
    }

    if (action === "cancel-reply") {
      const form = item.querySelector(".wish-reply-form");
      if (form) form.hidden = true;
      return;
    }

    if (action === "clear-reply") {
      if (!confirm("Xóa phản hồi đã gửi cho lời chúc này? Các trả lời của mọi người cũng sẽ bị xóa.")) return;
      await updateWish(id, { clearReply: true });
      return;
    }

    if (action === "delete-thread-reply") {
      const commentId = btn.dataset.commentId;
      if (!commentId) return;
      if (!confirm("Xóa trả lời này?")) return;
      await updateWish(id, { deleteReplyComment: commentId });
      return;
    }
  } catch (err) {
    alert(err.message);
  }
});

wishesList.addEventListener("submit", async (e) => {
  const form = e.target.closest(".wish-reply-form");
  if (!form) return;
  e.preventDefault();

  const id = form.dataset.id;
  const textarea = form.querySelector("textarea");
  const reply = textarea?.value.trim() || "";

  if (!reply) {
    alert("Vui lòng nhập nội dung trả lời.");
    return;
  }

  try {
    await updateWish(id, { reply });
  } catch (err) {
    alert(err.message);
  }
});

checkSession();

document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isNarrowScreen = window.matchMedia("(max-width: 599px)").matches;
    const lowPowerMode = prefersReducedMotion || isCoarsePointer || isNarrowScreen;

    // ==========================================================================
    // 1. LOADER & REVEAL ANIMATIONS
    // ==========================================================================
    const loader = document.getElementById("loader");
    const revealSections = document.querySelectorAll(".section-reveal");

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                // revealObserver.unobserve(entry.target); // Optional: only animate once
            }
        });
    }, { threshold: 0.15 });

    revealSections.forEach(section => revealObserver.observe(section));

    const topbar = document.querySelector(".topbar");
    window.addEventListener("scroll", () => {
        topbar?.classList.toggle("is-scrolled", window.scrollY > 24);
    }, { passive: true });

    function dismissLoader() {
        if (!loader) return;
        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        loader.style.pointerEvents = "none";
    }

    // ==========================================================================
    // 2. MUSIC PLAYER LOGIC
    // ==========================================================================
    const musicBtn = document.getElementById("musicToggle");
    const bgMusic = document.getElementById("bgMusic");
    let isMusicPlaying = false;

    if (bgMusic) {
        bgMusic.volume = 0.6;
    }

    async function playMusic() {
        if (!bgMusic) return;
        try {
            await bgMusic.play();
            isMusicPlaying = true;
            musicBtn?.classList.add("playing");
        } catch (err) {
            console.warn("Autoplay blocked or music error:", err);
        }
    }

    function toggleMusic() {
        if (isMusicPlaying) {
            bgMusic.pause();
            isMusicPlaying = false;
            musicBtn?.classList.remove("playing");
        } else {
            playMusic();
        }
    }

    musicBtn?.addEventListener("click", toggleMusic);

    // ==========================================================================
    // 2b. STICKY NAV — highlight active section + auto-scroll pills
    // ==========================================================================
    const navLinks = document.querySelectorAll(".nav-pill[href^='#']");
    const navEl = document.getElementById("topbarNav");
    const navWrap = document.getElementById("topbarNavWrap");
    const navSections = [...navLinks]
        .map(link => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);

    function scrollNavLinkIntoView(link, behavior = "smooth") {
        if (!navEl || !link || navEl.scrollWidth <= navEl.clientWidth + 4) return;
        const navRect = navEl.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        const offset = (linkRect.left + linkRect.width / 2) - (navRect.left + navRect.width / 2);
        navEl.scrollTo({ left: navEl.scrollLeft + offset, behavior });
    }

    function updateNavScrollState() {
        if (!navEl || !navWrap) return;
        const { scrollLeft, scrollWidth, clientWidth } = navEl;
        const canScroll = scrollWidth > clientWidth + 4;
        navWrap.classList.toggle("can-scroll", canScroll);
        navWrap.classList.toggle("at-start", scrollLeft <= 4);
        navWrap.classList.toggle("at-end", scrollLeft + clientWidth >= scrollWidth - 4);
    }

    let navAutoScrollId = null;
    let navAutoPauseTimer = null;
    let navAutoPaused = false;

    function stopNavAutoScroll() {
        if (navAutoScrollId) {
            cancelAnimationFrame(navAutoScrollId);
            navAutoScrollId = null;
        }
        if (navAutoPauseTimer) {
            clearTimeout(navAutoPauseTimer);
            navAutoPauseTimer = null;
        }
        navWrap?.classList.remove("is-auto-scrolling");
    }

    function startNavAutoScroll() {
        stopNavAutoScroll();
        if (lowPowerMode || navAutoPaused || window.innerWidth >= 600) return;
        if (!navEl || navEl.scrollWidth <= navEl.clientWidth + 4) return;

        const maxScroll = navEl.scrollWidth - navEl.clientWidth;
        const speed = 0.45;
        let scrolling = false;

        navEl.scrollLeft = maxScroll;
        updateNavScrollState();
        navWrap?.classList.add("is-auto-scrolling");

        function tick() {
            if (navAutoPaused || window.innerWidth >= 600 || document.hidden) {
                stopNavAutoScroll();
                return;
            }

            if (!scrolling) return;

            navEl.scrollLeft = Math.max(0, navEl.scrollLeft - speed);
            updateNavScrollState();

            if (navEl.scrollLeft <= 0) {
                navEl.scrollLeft = 0;
                scrolling = false;
                navAutoScrollId = null;
                navAutoPauseTimer = window.setTimeout(() => {
                    navEl.scrollLeft = maxScroll;
                    updateNavScrollState();
                    navAutoPauseTimer = window.setTimeout(() => {
                        scrolling = true;
                        navAutoScrollId = requestAnimationFrame(tick);
                    }, 1200);
                }, 1800);
                return;
            }

            navAutoScrollId = requestAnimationFrame(tick);
        }

        navAutoPauseTimer = window.setTimeout(() => {
            navAutoPauseTimer = null;
            scrolling = true;
            navAutoScrollId = requestAnimationFrame(tick);
        }, 800);
    }

    function pauseNavAutoScroll() {
        navAutoPaused = true;
        stopNavAutoScroll();
    }

    navEl?.addEventListener("scroll", updateNavScrollState, { passive: true });
    window.addEventListener("resize", () => {
        updateNavScrollState();
        if (window.innerWidth >= 600) {
            stopNavAutoScroll();
        } else if (!navAutoPaused) {
            startNavAutoScroll();
        }
    }, { passive: true });
    updateNavScrollState();

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            pauseNavAutoScroll();
            scrollNavLinkIntoView(link);
        });
    });

    navEl?.addEventListener("touchstart", pauseNavAutoScroll, { passive: true });
    navEl?.addEventListener("wheel", pauseNavAutoScroll, { passive: true });

    if (navSections.length) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = entry.target.id;
                navLinks.forEach(link => {
                    const isActive = link.getAttribute("href") === `#${id}`;
                    link.classList.toggle("active", isActive);
                    if (isActive) scrollNavLinkIntoView(link);
                });
            });
        }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });

        navSections.forEach(section => navObserver.observe(section));
    }

    // Opening trigger
    async function openInvitation() {
        dismissLoader();
        invitationOpened = true;
        await playMusic();
        triggerConfetti();
        startAmbientConfetti();
        startContinuousConfetti();
        window.setTimeout(() => {
            updateNavScrollState();
            startNavAutoScroll();
        }, 700);
    }

    loader?.addEventListener("click", openInvitation);
    loader?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openInvitation();
        }
    });

    // ==========================================================================
    // 3. COUNTDOWN TIMER (Preserving Logic)
    // ==========================================================================
    const targetDate = new Date("2026-06-22T12:30:00+07:00").getTime();
    const daysVal = document.getElementById("days");
    const hoursVal = document.getElementById("hours");
    const minutesVal = document.getElementById("minutes");
    const secondsVal = document.getElementById("seconds");

    function tickCell(el, value) {
        if (!el) return;
        const next = String(value).padStart(2, "0");
        if (el.textContent !== next) {
            el.textContent = next;
            const cell = el.closest(".cd-cell");
            cell?.classList.remove("tick");
            void cell?.offsetWidth;
            cell?.classList.add("tick");
        }
    }

    function updateCountdown() {
        const now = new Date().getTime();
        const diff = targetDate - now;

        if (diff <= 0) {
            [daysVal, hoursVal, minutesVal, secondsVal].forEach(el => el ? el.textContent = "00" : null);
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        tickCell(daysVal, d);
        tickCell(hoursVal, h);
        tickCell(minutesVal, m);
        tickCell(secondsVal, s);
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();

    // ==========================================================================
    // 4. RSVP & WISHES (Preserving API Integration)
    // ==========================================================================
    const rsvpForm = document.getElementById("rsvp-form");
    const wishesList = document.getElementById("wishes-list");
    const wishesCount = document.getElementById("wishes-count");
    const wishesScrollInner = document.getElementById("wishes-scroll-inner");
    const wishesViewport = document.getElementById("wishes-box");
    const API_BASE =
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
    ? "http://127.0.0.1:3000"
    : "https://nguyen-kim-thinh-graduation.onrender.com";

const WISHES_API = `${API_BASE}/api/wishes`;

    const wishStatusMap = {
        attending: { label: "Tham dự", cls: "attending" },
        maybe: { label: "Có thể", cls: "maybe" },
        absent: { label: "Không", cls: "absent" }
    };

    const REACTIONS = {
        love: { emoji: "❤️", cls: "react-love", label: "Tym" },
        haha: { emoji: "😂", cls: "react-haha", label: "Haha" },
        moved: { emoji: "🥹", cls: "react-moved", label: "Cảm động" }
    };

    function getWishReaction(item) {
        if (item?.reaction && REACTIONS[item.reaction]) return item.reaction;
        if (item?.liked) return "love";
        return null;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function sortWishesForDisplay(list) {
        return [...list].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }

    function formatWishTime(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return "";
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return "Vừa xong";
        if (diffMin < 60) return `${diffMin} phút`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour} giờ`;
        const diffDay = Math.floor(diffHour / 24);
        if (diffDay < 7) return `${diffDay} ngày`;
        return d.toLocaleDateString("vi-VN");
    }

    const REPLY_NAME_KEY = "wish_reply_display_name";
    const REPLY_ANONYMOUS_KEY = "wish_reply_anonymous";

    function getThreadCommentDisplay(comment) {
        const isAnonymous = Boolean(comment.anonymous) || comment.name === "Ẩn danh";
        const label = isAnonymous ? "Ẩn danh" : (comment.name || "Ẩn danh");
        const initial = isAnonymous ? "?" : label.trim().charAt(0).toUpperCase();
        return { isAnonymous, label, initial };
    }

    function buildThreadReplyItem(comment) {
        const display = getThreadCommentDisplay(comment);
        const time = formatWishTime(comment.createdAt);
        return `
            <div class="wish-fb-comment wish-fb-comment-nested">
                <span class="wish-fb-comment-avatar${display.isAnonymous ? " is-anonymous" : ""}" aria-hidden="true">${escapeHtml(display.initial)}</span>
                <div class="wish-fb-comment-body">
                    <div class="wish-fb-comment-bubble">
                        <strong class="wish-fb-comment-author${display.isAnonymous ? " is-anonymous" : ""}">${escapeHtml(display.label)}</strong>
                        <span class="wish-fb-comment-text">${escapeHtml(comment.text)}</span>
                    </div>
                    ${time ? `<time class="wish-fb-comment-time">${escapeHtml(time)}</time>` : ""}
                </div>
            </div>`;
    }

    function updateReplyIdentityUI(form) {
        if (!form) return;
        const isAnonymous = form.querySelector('input[name="identity"][value="anonymous"]')?.checked;
        const nameWrap = form.querySelector(".wish-fb-reply-name-wrap");
        const nameInput = form.querySelector(".wish-fb-reply-name");

        if (isAnonymous) {
            nameWrap?.classList.add("is-hidden");
            nameInput?.removeAttribute("required");
            if (nameInput) nameInput.disabled = true;
        } else {
            nameWrap?.classList.remove("is-hidden");
            nameInput?.setAttribute("required", "");
            if (nameInput) {
                nameInput.disabled = false;
                const savedName = localStorage.getItem(REPLY_NAME_KEY);
                if (savedName && !nameInput.value) nameInput.value = savedName;
            }
        }
    }

    function initReplyIdentityForm(form) {
        if (!form) return;
        const preferAnonymous = localStorage.getItem(REPLY_ANONYMOUS_KEY) === "1";
        const namedRadio = form.querySelector('input[name="identity"][value="named"]');
        const anonRadio = form.querySelector('input[name="identity"][value="anonymous"]');
        if (preferAnonymous && anonRadio) anonRadio.checked = true;
        else if (namedRadio) namedRadio.checked = true;
        updateReplyIdentityUI(form);
    }

    function buildHostResponseBlock(item) {
        const reactionKey = getWishReaction(item);
        const hasReply = Boolean(String(item.reply || "").trim());
        if (!reactionKey && !hasReply) return "";

        let html = '<div class="wish-fb-engage" role="note" aria-label="Phản hồi từ Thịnh">';

        if (reactionKey) {
            const reaction = REACTIONS[reactionKey];
            html += `
                <div class="wish-fb-reaction-bar">
                    <div class="wish-fb-reaction-bar-left">
                        <span class="wish-fb-reaction-icon ${reaction.cls}" aria-hidden="true">${reaction.emoji}</span>
                    </div>
                    <span class="wish-fb-reaction-summary">
                        <strong>Thịnh</strong>
                        <span class="wish-fb-reaction-dot">·</span>
                        <span class="wish-fb-reaction-label">${escapeHtml(reaction.label)}</span>
                    </span>
                </div>`;
        }

        if (hasReply) {
            const replyTime = formatWishTime(item.replyAt);
            const threadComments = Array.isArray(item.replyComments) ? item.replyComments : [];
            const nestedHtml = threadComments.map(buildThreadReplyItem).join("");

            html += `
                <div class="wish-fb-comments">
                    <div class="wish-fb-comment is-host">
                        <span class="wish-fb-comment-avatar is-host" aria-hidden="true">T</span>
                        <div class="wish-fb-comment-body">
                            <div class="wish-fb-comment-bubble is-host">
                                <span class="wish-fb-comment-author-row">
                                    <strong class="wish-fb-comment-author">Thịnh</strong>
                                    <span class="wish-fb-host-badge">Chủ tiệc</span>
                                </span>
                                <span class="wish-fb-comment-text">${escapeHtml(item.reply)}</span>
                            </div>
                            <div class="wish-fb-comment-meta">
                                ${replyTime ? `<time class="wish-fb-comment-time">${escapeHtml(replyTime)}</time>` : ""}
                                <span class="wish-fb-meta-dot" aria-hidden="true">·</span>
                                <button type="button" class="wish-fb-reply-toggle" data-action="toggle-thread-reply">
                                    <i class="fa-regular fa-comment" aria-hidden="true"></i> Trả lời
                                </button>
                            </div>
                        </div>
                    </div>
                    ${nestedHtml ? `<div class="wish-fb-thread-replies">${nestedHtml}</div>` : ""}
                    <form class="wish-fb-reply-form" hidden>
                        <div class="wish-fb-composer">
                            <div class="wish-fb-composer-head">
                                <span class="wish-fb-composer-title">Trả lời Thịnh</span>
                                <div class="wish-fb-reply-identity" role="radiogroup" aria-label="Chọn hiển thị tên">
                                    <label class="wish-fb-identity-option">
                                        <input type="radio" name="identity" value="named" checked>
                                        <span><i class="fa-regular fa-id-card" aria-hidden="true"></i> Ghi tên</span>
                                    </label>
                                    <label class="wish-fb-identity-option">
                                        <input type="radio" name="identity" value="anonymous">
                                        <span><i class="fa-regular fa-user" aria-hidden="true"></i> Ẩn danh</span>
                                    </label>
                                </div>
                            </div>
                            <div class="wish-fb-reply-name-wrap">
                                <input type="text" class="wish-fb-reply-name" name="name" maxlength="50" placeholder="Tên hiển thị của bạn" required autocomplete="name">
                            </div>
                            <textarea class="wish-fb-reply-input" name="text" rows="2" maxlength="300" placeholder="Viết trả lời công khai..." required></textarea>
                            <div class="wish-fb-reply-actions">
                                <button type="button" class="wish-fb-reply-cancel" data-action="cancel-thread-reply">Hủy</button>
                                <button type="submit" class="wish-fb-reply-submit">
                                    <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Gửi
                                </button>
                            </div>
                        </div>
                    </form>
                </div>`;
        }

        html += "</div>";
        return html;
    }

    function createWishCard(item) {
        const card = document.createElement("article");
        const hasHostResponse = Boolean(getWishReaction(item)) || Boolean(String(item.reply || "").trim());
        card.className = `wish-card-premium${item.pinned ? " is-pinned" : ""}${hasHostResponse ? " has-host-response" : ""}`;
        card.dataset.wishId = item.id;
        const initial = (item.name || "?").trim().charAt(0).toUpperCase();
        const status = wishStatusMap[item.attendance] || wishStatusMap.maybe;
        const wishText = item.wish || "Đã gửi lời chúc tới Thịnh.";
        const dateStr = new Date(item.createdAt).toLocaleDateString("vi-VN");
        const hostResponseBlock = buildHostResponseBlock(item);

        card.innerHTML = `
            <div class="wish-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
            <div class="wish-body">
                <div class="wish-header">
                    <strong>${escapeHtml(item.name)}</strong>
                    <div class="wish-header-tags">
                        ${item.pinned ? '<span class="wish-pin-tag" title="Thịnh đã ghim"><i class="fa-solid fa-thumbtack"></i></span>' : ""}
                        <span class="wish-tag ${status.cls}">${status.label}</span>
                    </div>
                </div>
                <p class="wish-message">${escapeHtml(wishText)}</p>
                ${hostResponseBlock}
                <small class="wish-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${escapeHtml(dateStr)}</small>
            </div>
        `;
        return card;
    }

    let autoScrollInterval;
    let autoScrollResumeTimer;
    let isUserInteracting = false;
    let wishesSectionVisible = true;

    function stopWishAutoScroll() {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }

    function pauseWishAutoScroll() {
        isUserInteracting = true;
        clearTimeout(autoScrollResumeTimer);
        autoScrollResumeTimer = window.setTimeout(() => {
            isUserInteracting = false;
        }, 3000);
    }

    function tickWishScroll() {
        if (!wishesViewport || isUserInteracting || document.hidden || !wishesSectionVisible) return;

        const maxScroll = wishesViewport.scrollHeight - wishesViewport.clientHeight;
        if (maxScroll <= 0) return;

        if (wishesViewport.scrollTop >= maxScroll) {
            wishesViewport.scrollTop = 0;
        } else {
            wishesViewport.scrollTop += 1;
        }
    }

    let wishListenersBound = false;

    function setupWishAutoScroll() {
        if (!wishesViewport) return;

        stopWishAutoScroll();

        if (lowPowerMode) return;

        if (!wishListenersBound) {
            wishesViewport.addEventListener("wheel", pauseWishAutoScroll, { passive: true });
            wishesViewport.addEventListener("touchmove", pauseWishAutoScroll, { passive: true });
            wishesViewport.addEventListener("mousedown", pauseWishAutoScroll);
            wishListenersBound = true;
        }

        autoScrollInterval = window.setInterval(tickWishScroll, 90);
    }

    const wishesSection = document.getElementById("rsvp-section");
    if (wishesSection && !lowPowerMode) {
        const wishesVisibilityObserver = new IntersectionObserver((entries) => {
            wishesSectionVisible = entries.some(entry => entry.isIntersecting);
        }, { threshold: 0.05 });
        wishesVisibilityObserver.observe(wishesSection);
    }

    async function loadWishes() {
        try {
            const res = await fetch(`${WISHES_API}?t=${Date.now()}`, { cache: "no-store" });
            const data = await res.json();
            if (data.success) {
                renderWishes(data.wishes);
                localStorage.setItem("graduation_wishes_backup", JSON.stringify(data.wishes));
            }
        } catch (err) {
            console.warn("Could not load wishes from server:", err);
            const cached = localStorage.getItem("graduation_wishes_backup");
            if (cached) renderWishes(JSON.parse(cached));
        }
    }

    function renderWishes(wishes) {
        if (!wishesList) return;
        wishesList.innerHTML = "";
        wishesScrollInner?.querySelector(".wishes-track-clone")?.remove();
        wishesScrollInner?.classList.remove("wishes-scroll-active");
        wishesViewport?.classList.remove("is-static");
        wishesCount.textContent = `${wishes.length} lời chúc`;

        if (!wishes.length) {
            stopWishAutoScroll();
            wishesList.innerHTML = `
                <div class="wishes-empty">
                    <span class="wishes-empty-icon" aria-hidden="true"><i class="fa-regular fa-heart"></i></span>
                    <p class="wishes-empty-title">Chưa có lời chúc nào</p>
                    <p class="wishes-empty-desc">Hãy là người đầu tiên gửi lời chúc đến Thịnh nhé!</p>
                </div>`;
            return;
        }

        sortWishesForDisplay(wishes).forEach(item => {
            wishesList.appendChild(createWishCard(item));
        });

        setupWishAutoScroll();
        bindWishThreadEvents();
    }

    let wishThreadEventsBound = false;

    function bindWishThreadEvents() {
        if (!wishesList || wishThreadEventsBound) return;
        wishThreadEventsBound = true;

        wishesList.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const card = btn.closest(".wish-card-premium");
            if (!card) return;

            const form = card.querySelector(".wish-fb-reply-form");
            if (!form) return;

            if (btn.dataset.action === "toggle-thread-reply") {
                e.preventDefault();
                const willOpen = form.hidden;
                wishesList.querySelectorAll(".wish-fb-reply-form").forEach((f) => { f.hidden = true; });
                if (willOpen) {
                    form.hidden = false;
                    initReplyIdentityForm(form);
                    form.querySelector(".wish-fb-reply-input")?.focus();
                }
                pauseWishAutoScroll();
                return;
            }

            if (btn.dataset.action === "cancel-thread-reply") {
                e.preventDefault();
                form.hidden = true;
                form.reset();
                initReplyIdentityForm(form);
            }
        });

        wishesList.addEventListener("change", (e) => {
            if (e.target.name !== "identity") return;
            const form = e.target.closest(".wish-fb-reply-form");
            updateReplyIdentityUI(form);
            pauseWishAutoScroll();
        });

        wishesList.addEventListener("submit", async (e) => {
            const form = e.target.closest(".wish-fb-reply-form");
            if (!form) return;
            e.preventDefault();

            const card = form.closest(".wish-card-premium");
            const wishId = card?.dataset.wishId;
            if (!wishId) return;

            const nameInput = form.querySelector(".wish-fb-reply-name");
            const textInput = form.querySelector(".wish-fb-reply-input");
            const isAnonymous = form.querySelector('input[name="identity"][value="anonymous"]')?.checked;
            const name = isAnonymous ? "" : (nameInput?.value.trim() || "");
            const text = textInput?.value.trim() || "";

            if (!text) {
                alert("Vui lòng nhập nội dung trả lời.");
                return;
            }

            if (!isAnonymous && !name) {
                alert("Vui lòng nhập tên hoặc chọn ẩn danh.");
                return;
            }

            const submitBtn = form.querySelector(".wish-fb-reply-submit");
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await fetch(`${WISHES_API}/${encodeURIComponent(wishId)}/replies`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, text, anonymous: Boolean(isAnonymous) }),
                });
                const data = await res.json();
                if (!data.success) {
                    alert(data.message || "Không gửi được trả lời.");
                    return;
                }

                localStorage.setItem(REPLY_ANONYMOUS_KEY, isAnonymous ? "1" : "0");
                if (!isAnonymous && name) localStorage.setItem(REPLY_NAME_KEY, name);
                renderWishes(data.wishes);
                pauseWishAutoScroll();
            } catch (err) {
                console.error("Thread reply error:", err);
                alert("Đã có lỗi. Vui lòng thử lại!");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    rsvpForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("rsvp-submit-btn");
        const payload = {
            name: document.getElementById("input-name").value.trim(),
            attendance: document.querySelector('input[name="attendance"]:checked').value,
            wish: document.getElementById("input-wish").value.trim()
        };

        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch(WISHES_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                renderWishes(data.wishes);
                localStorage.setItem("graduation_wishes_backup", JSON.stringify(data.wishes));
                triggerConfetti();
                rsvpForm.reset();
                alert("Cảm ơn bạn đã gửi phản hồi!");
            }
        } catch (err) {
            console.error("Submission error:", err);
            alert("Đã có lỗi xảy ra. Vui lòng thử lại!");
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    loadWishes();

    // ==========================================================================
    // 5. EFFECTS: CONFETTI & SPARKLES
    // ==========================================================================
    const confettiColors = ["#22d3ee", "#3b82f6", "#6366f1", "#f8fafc", "#ffffff"];
    const ambientConfettiEl = document.getElementById("ambientConfetti");
    let confettiTimer = null;
    let invitationOpened = false;
    let ambientConfettiReady = false;

    function shootSideConfetti() {
        if (typeof confetti !== "function" || prefersReducedMotion || document.hidden) return;

        const count = isNarrowScreen ? 1 : 3;
        const shared = {
            particleCount: count,
            spread: 52,
            startVelocity: 26,
            gravity: 1,
            ticks: 120,
            scalar: 0.85,
            colors: confettiColors,
            disableForReducedMotion: true,
            zIndex: 9999
        };

        confetti({ ...shared, angle: 72, drift: 0.3, origin: { x: 0, y: 0.12 } });
        confetti({ ...shared, angle: 108, drift: -0.3, origin: { x: 1, y: 0.12 } });
    }

    function initAmbientConfetti() {
        if (!ambientConfettiEl || ambientConfettiReady || prefersReducedMotion) return;

        const pieceCount = isNarrowScreen ? 10 : 16;
        const palette = ["#22d3ee", "#3b82f6", "#6366f1", "#67e8f9", "#a5b4fc", "#f8fafc"];

        for (let i = 0; i < pieceCount; i += 1) {
            const piece = document.createElement("span");
            piece.className = "confetti-piece";
            const w = 5 + Math.random() * 4;
            const h = 5 + Math.random() * 5;
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.width = `${w}px`;
            piece.style.height = `${h}px`;
            piece.style.background = palette[i % palette.length];
            piece.style.animationDuration = `${10 + Math.random() * 8}s`;
            piece.style.animationDelay = `${-Math.random() * 14}s`;
            piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 80}px`);
            piece.style.setProperty("--spin", `${360 + Math.random() * 540}deg`);
            if (Math.random() > 0.5) piece.style.borderRadius = "50%";
            ambientConfettiEl.appendChild(piece);
        }

        ambientConfettiReady = true;
    }

    function startAmbientConfetti() {
        if (prefersReducedMotion || !ambientConfettiEl) return;
        initAmbientConfetti();
        ambientConfettiEl.classList.remove("is-paused");
        ambientConfettiEl.classList.add("is-active");
    }

    function pauseAmbientConfetti() {
        ambientConfettiEl?.classList.add("is-paused");
    }

    function stopContinuousConfetti() {
        if (confettiTimer) {
            clearInterval(confettiTimer);
            confettiTimer = null;
        }
    }

    function startContinuousConfetti() {
        stopContinuousConfetti();
        if (prefersReducedMotion || !invitationOpened) return;

        const intervalMs = isNarrowScreen ? 2800 : 1600;
        shootSideConfetti();
        confettiTimer = window.setInterval(() => {
            if (!document.hidden && invitationOpened) shootSideConfetti();
        }, intervalMs);
    }

    function triggerConfetti() {
        if (typeof confetti !== "function" || prefersReducedMotion) return;

        confetti({
            particleCount: isNarrowScreen ? 50 : 80,
            spread: 80,
            startVelocity: 38,
            ticks: 140,
            origin: { y: 0.55 },
            colors: confettiColors,
            disableForReducedMotion: true
        });

        shootSideConfetti();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopContinuousConfetti();
            pauseAmbientConfetti();
            stopWishAutoScroll();
            stopNavAutoScroll();
        } else if (invitationOpened) {
            ambientConfettiEl?.classList.remove("is-paused");
            startContinuousConfetti();
            if (!lowPowerMode) {
                setupWishAutoScroll();
                if (!navAutoPaused) startNavAutoScroll();
            }
        }
    });

    // Sparkle canvas — desktop only, pauses when idle
    const canvas = document.getElementById("sparkleCanvas");
    if (canvas && !lowPowerMode) {
        const ctx = canvas.getContext("2d");
        let particles = [];
        let sparkleRaf = null;
        let lastSparkleAt = 0;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener("resize", resizeCanvas, { passive: true });
        resizeCanvas();

        function addSparkle(x, y) {
            const now = Date.now();
            if (now - lastSparkleAt < 60) return;
            lastSparkleAt = now;

            particles.push({
                x, y,
                size: Math.random() * 2.5 + 1,
                speedX: (Math.random() - 0.5) * 1.6,
                speedY: (Math.random() - 0.5) * 1.6,
                alpha: 1,
                color: Math.random() > 0.6 ? "#22d3ee" : Math.random() > 0.3 ? "#60a5fa" : "#ffffff"
            });

            if (particles.length > 48) particles = particles.slice(-48);
            startSparkleLoop();
        }

        function drawSparkles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = particles.length - 1; i >= 0; i -= 1) {
                const p = particles[i];
                p.x += p.speedX;
                p.y += p.speedY;
                p.alpha -= 0.03;

                if (p.alpha <= 0) {
                    particles.splice(i, 1);
                    continue;
                }

                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;

            if (particles.length > 0 && !document.hidden) {
                sparkleRaf = requestAnimationFrame(drawSparkles);
            } else {
                sparkleRaf = null;
            }
        }

        function startSparkleLoop() {
            if (sparkleRaf || document.hidden) return;
            sparkleRaf = requestAnimationFrame(drawSparkles);
        }

        window.addEventListener("mousemove", (e) => addSparkle(e.clientX, e.clientY), { passive: true });
    } else if (canvas) {
        canvas.hidden = true;
    }
});

document.addEventListener("DOMContentLoaded", () => {
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
    let navAutoPaused = false;

    function stopNavAutoScroll() {
        if (navAutoScrollId) {
            cancelAnimationFrame(navAutoScrollId);
            navAutoScrollId = null;
        }
        navWrap?.classList.remove("is-auto-scrolling");
    }

    function startNavAutoScroll() {
        stopNavAutoScroll();
        if (navAutoPaused || window.innerWidth >= 600) return;
        if (!navEl || navEl.scrollWidth <= navEl.clientWidth + 4) return;

        const maxScroll = navEl.scrollWidth - navEl.clientWidth;
        const speed = 0.55;
        let phase = "wait-start";

        navEl.scrollLeft = maxScroll;
        updateNavScrollState();
        navWrap?.classList.add("is-auto-scrolling");

        function tick() {
            if (navAutoPaused || window.innerWidth >= 600) {
                stopNavAutoScroll();
                return;
            }

            if (phase === "scroll-left") {
                navEl.scrollLeft = Math.max(0, navEl.scrollLeft - speed);
                updateNavScrollState();
                if (navEl.scrollLeft <= 0) {
                    navEl.scrollLeft = 0;
                    phase = "pause-end";
                    window.setTimeout(() => {
                        navEl.scrollLeft = maxScroll;
                        updateNavScrollState();
                        phase = "pause-start";
                        window.setTimeout(() => { phase = "scroll-left"; }, 1200);
                    }, 1800);
                }
            }

            navAutoScrollId = requestAnimationFrame(tick);
        }

        window.setTimeout(() => {
            phase = "scroll-left";
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
    const API_BASE = location.hostname === "127.0.0.1" || location.hostname === "localhost" ? "http://127.0.0.1:3000" : "";
    const WISHES_API = `${API_BASE}/api/wishes`;

    const wishStatusMap = {
        attending: { label: "Tham dự", cls: "attending" },
        maybe: { label: "Có thể", cls: "maybe" },
        absent: { label: "Không", cls: "absent" }
    };

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function createWishCard(item) {
        const card = document.createElement("article");
        card.className = "wish-card-premium";
        const initial = (item.name || "?").trim().charAt(0).toUpperCase();
        const status = wishStatusMap[item.attendance] || wishStatusMap.maybe;
        const wishText = item.wish || "Đã gửi lời chúc tới Thịnh.";
        const dateStr = new Date(item.createdAt).toLocaleDateString("vi-VN");

        card.innerHTML = `
            <div class="wish-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
            <div class="wish-body">
                <div class="wish-header">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="wish-tag ${status.cls}">${status.label}</span>
                </div>
                <p>${escapeHtml(wishText)}</p>
                <small>${escapeHtml(dateStr)}</small>
            </div>
        `;
        return card;
    }

    function setupWishAutoScroll() {
        if (!wishesScrollInner || !wishesViewport) return;

        wishesScrollInner.classList.remove("wishes-scroll-active");
        wishesScrollInner.style.removeProperty("--scroll-duration");
        wishesScrollInner.querySelector(".wishes-track-clone")?.remove();

        const cards = wishesList?.querySelectorAll(".wish-card-premium");
        if (!cards || cards.length < 2) return;

        const cloneTrack = document.createElement("div");
        cloneTrack.className = "wishes-track wishes-track-clone";
        cloneTrack.setAttribute("aria-hidden", "true");
        cards.forEach(card => cloneTrack.appendChild(card.cloneNode(true)));
        wishesScrollInner.appendChild(cloneTrack);

        requestAnimationFrame(() => {
            const scrollHeight = wishesScrollInner.scrollHeight;
            const halfHeight = scrollHeight / 2;
            if (halfHeight <= wishesViewport.clientHeight + 8) {
                wishesViewport.classList.add("is-static");
                return;
            }

            wishesViewport.classList.remove("is-static");
            const duration = Math.min(48, Math.max(16, halfHeight / 18));
            wishesScrollInner.style.setProperty("--scroll-duration", `${duration}s`);
            wishesScrollInner.classList.add("wishes-scroll-active");
        });
    }

    async function loadWishes() {
        try {
            const res = await fetch(WISHES_API);
            const data = await res.json();
            if (data.success) {
                renderWishes(data.wishes);
            }
        } catch (err) {
            console.warn("Could not load wishes from server:", err);
            // Fallback to local storage if needed
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
            wishesList.innerHTML = `
                <div class="wishes-empty">
                    <span class="wishes-empty-icon" aria-hidden="true"><i class="fa-regular fa-heart"></i></span>
                    <p class="wishes-empty-title">Chưa có lời chúc nào</p>
                    <p class="wishes-empty-desc">Hãy là người đầu tiên gửi lời chúc đến Thịnh nhé!</p>
                </div>`;
            return;
        }

        wishes.slice().reverse().forEach(item => {
            wishesList.appendChild(createWishCard(item));
        });

        setupWishAutoScroll();
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
    let confettiTimer = null;
    let invitationOpened = false;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function shootSideConfetti() {
        if (typeof confetti !== "function") return;

        confetti({
            particleCount: 4,
            angle: 72,
            spread: 58,
            startVelocity: 38,
            gravity: 1.1,
            drift: 0.4,
            ticks: 220,
            origin: { x: 0, y: 0.15 },
            colors: confettiColors,
            disableForReducedMotion: true
        });

        confetti({
            particleCount: 4,
            angle: 108,
            spread: 58,
            startVelocity: 38,
            gravity: 1.1,
            drift: -0.4,
            ticks: 220,
            origin: { x: 1, y: 0.15 },
            colors: confettiColors,
            disableForReducedMotion: true
        });
    }

    function startContinuousConfetti() {
        if (prefersReducedMotion || confettiTimer) return;
        shootSideConfetti();
        confettiTimer = setInterval(shootSideConfetti, 420);
    }

    function stopContinuousConfetti() {
        if (confettiTimer) {
            clearInterval(confettiTimer);
            confettiTimer = null;
        }
    }

    function triggerConfetti() {
        if (typeof confetti !== "function") return;

        confetti({
            particleCount: 80,
            spread: 80,
            startVelocity: 42,
            origin: { y: 0.55 },
            colors: confettiColors,
            disableForReducedMotion: true
        });

        shootSideConfetti();
        shootSideConfetti();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopContinuousConfetti();
        } else if (invitationOpened) {
            startContinuousConfetti();
        }
    });

    // Sparkle Canvas (Simplified Trail)
    const canvas = document.getElementById("sparkleCanvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        let particles = [];
        
        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener("resize", resize);
        resize();

        function addSparkle(x, y) {
            for (let i = 0; i < 2; i++) {
                particles.push({
                    x, y,
                    size: Math.random() * 3 + 1,
                    speedX: (Math.random() - 0.5) * 2,
                    speedY: (Math.random() - 0.5) * 2,
                    alpha: 1,
                    color: Math.random() > 0.6 ? "#22d3ee" : Math.random() > 0.3 ? "#60a5fa" : "#ffffff"
                });
            }
        }

        window.addEventListener("mousemove", (e) => addSparkle(e.clientX, e.clientY));
        window.addEventListener("touchmove", (e) => {
            const touch = e.touches[0];
            if (touch) addSparkle(touch.clientX, touch.clientY);
        }, { passive: true });

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.alpha -= 0.02;
                if(p.alpha <= 0) {
                    particles.splice(i, 1);
                } else {
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            requestAnimationFrame(animate);
        }
        animate();
    }
});

// 官网演示页：统一直连远程服务端（避免本地 8000 未启动导致生成失败）
const API_BASE = "https://api.hypermeld.com";
const CLIENT_DOWNLOAD_URL = "https://download.hypermeld.com/OrigoOS.exe";

function normalizeDownloadUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "#";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/")) return `${API_BASE}${u}`;
    return u;
}

function isCrossOrigin(url) {
    try {
        const u = new URL(String(url || ""), window.location.href);
        return u.origin !== window.location.origin;
    } catch (_) {
        return false;
    }
}

function escapeHtml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function syncNavAuth() {
    const slot = document.getElementById("nav-auth-slot");
    if (!slot) return;
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const desktopLink = '<a class="btn btn-secondary" href="#" id="nav-desktop-download">下载桌面版</a>';
    if (token && username) {
        slot.innerHTML = `
            <span class="nav-auth-user-dropdown" id="nav-auth-user-dropdown">
                <button type="button" class="btn btn-secondary nav-auth-name" onclick="toggleAuthDropdown(event)">
                    ${escapeHtml(username)}
                </button>
                <div class="nav-auth-menu" id="nav-auth-menu">
                    <a class="nav-auth-menu-item" href="/dashboard">用户中心</a>
                    <a class="nav-auth-menu-item danger" href="#" onclick="logout(event)">退出登录</a>
                </div>
            </span>
            ${desktopLink}
        `;
        return;
    }
    slot.innerHTML = `<a class="btn btn-secondary" href="/login">登录</a>${desktopLink}`;
}

function syncDesktopDownloadLinks() {
    const ids = ["nav-desktop-download", "desktop-download-link", "desktop-download-cta"];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute("href", CLIENT_DOWNLOAD_URL);
        if (String(el.tagName || "").toLowerCase() === "a") {
            el.setAttribute("download", "OrigoOS.exe");
        }
    });
}

function toggleAuthDropdown(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    const root = document.getElementById("nav-auth-user-dropdown");
    if (!root) return;
    root.classList.toggle("open");
}

function logout(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("is_vip");
    window.location.href = "/login";
}

async function api(path, method = "GET", body = null, auth = false) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
        const token = localStorage.getItem("token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "请求失败");
    return data;
}

async function apiForm(path, formData, auth = false) {
    const headers = {};
    if (auth) {
        const token = localStorage.getItem("token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers,
        body: formData
    });
    let data = {};
    try {
        data = await res.json();
    } catch (_) {
        data = {};
    }
    if (!res.ok) throw new Error((data && data.detail) || "请求失败");
    return data;
}

async function register(e) {
    e.preventDefault();
    const username = (document.getElementById("username")?.value || "").trim();
    const password = document.getElementById("password")?.value || "";
    const passwordConfirm = document.getElementById("password_confirm")?.value || "";
    const captchaInput = (document.getElementById("captcha_input")?.value || "").trim().toUpperCase();
    const captchaCode = (window.__registerCaptchaCode || "").toUpperCase();
    if (password !== passwordConfirm) {
        alert("两次输入的密码不一致，请重新确认");
        return;
    }
    if (!captchaInput || captchaInput !== captchaCode) {
        alert("验证码不正确，请重新输入");
        refreshRegisterCaptcha();
        return;
    }
    try {
        await api("/api/register", "POST", { username, password });
        alert("注册成功，请登录");
        location.href = "/login";
    } catch (err) {
        alert(`注册失败：${err.message}`);
        refreshRegisterCaptcha();
    }
}

function _randomCaptchaCode(len = 4) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i += 1) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

function refreshRegisterCaptcha() {
    const code = _randomCaptchaCode(4);
    window.__registerCaptchaCode = code;
    const el = document.getElementById("register-captcha-code");
    if (el) el.textContent = code;
}

function initRegisterForm() {
    if (!document.getElementById("register-captcha-code")) return;
    refreshRegisterCaptcha();
}

function getClientCallback() {
    try {
        const p = new URLSearchParams(window.location.search);
        return p.get("client_callback") || "";
    } catch (_) {
        return "";
    }
}

async function login(e) {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    try {
        const data = await api("/api/login", "POST", { username, password });
        localStorage.setItem("token", data.token);
        localStorage.setItem("is_vip", String(data.is_vip));
        localStorage.setItem("username", username);
        const cb = getClientCallback();
        if (cb) {
            const u = new URL(cb);
            u.searchParams.set("token", data.token);
            u.searchParams.set("username", username);
            u.searchParams.set("is_vip", data.is_vip ? "1" : "0");
            window.location.href = u.toString();
            return;
        }
        location.href = "/dashboard";
    } catch (err) {
        alert(`登录失败：${err.message}`);
    }
}

async function loadStatus() {
    const box = document.getElementById("status");
    try {
        const data = await api("/api/user/status", "GET", null, true);
        const vipText = data.is_vip ? "会员用户" : "免费用户";
        const klass = data.is_vip ? "ok" : "warn";
        box.innerHTML = `<p class="${klass}">当前状态：${vipText}</p><p>到期时间：${data.expire_time || "未开通"}</p>`;
    } catch (err) {
        box.innerHTML = `<p class="warn">获取失败：${err.message}</p>`;
    }
}

async function submitPaymentCallback() {
    const username = localStorage.getItem("username");
    if (!username) {
        alert("请先登录后再提交支付回调");
        return;
    }
    try {
        await api("/api/payment/callback", "POST", { username, paid: true });
        alert("支付回调已提交，会员时长已延长 1 年");
    } catch (err) {
        alert(`支付回调失败：${err.message}`);
    }
}

function initLandingDemo() {
    const input = document.getElementById("demo-input");
    const fileInput = document.getElementById("demo-file");
    const startBtn = document.getElementById("demo-start");
    const uploadBtn = document.getElementById("demo-upload-run");
    const retryBtn = document.getElementById("demo-retry");
    const list = document.getElementById("demo-progress-list");
    const resultBox = document.getElementById("demo-result");
    const downloadBtn = document.getElementById("demo-download");
    const editBtn = document.getElementById("demo-edit");
    const onlineBtn = document.getElementById("hero-online-btn");
    const videoMock = document.getElementById("demo-video-mock");
    if (!input || !startBtn || !list || !resultBox || !downloadBtn || !editBtn) return;

    let runTimer = null;
    let videoTimer = null;
    const SUPPORTED_UPLOAD_EXTS = new Set(["txt", "md", "json", "log"]);

    function clearRunTimer() {
        if (runTimer) clearInterval(runTimer);
        runTimer = null;
    }

    function resetDemoArea() {
        clearRunTimer();
        list.innerHTML = "<li>等待开始...</li>";
        resultBox.classList.add("hidden");
        resultBox.textContent = "";
        retryBtn && retryBtn.classList.add("hidden");
        downloadBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
    }

    function renderProgress(lines, activeIdx, errorIdx = -1) {
        list.innerHTML = "";
        lines.forEach((txt, i) => {
            const li = document.createElement("li");
            li.textContent = txt;
            if (i < activeIdx && i !== errorIdx) li.classList.add("done");
            if (i === activeIdx) li.classList.add("active");
            if (i === errorIdx) li.classList.add("error");
            list.appendChild(li);
        });
    }

    function showDone(nameText, downloadUrl = "#") {
        resultBox.classList.remove("hidden");
        resultBox.innerHTML = `✅ 已生成PPT（简约风格）<br/><br/>文件：${escapeHtml(nameText)}<br/>你可以立即下载，或继续编辑。<br/><br/>客户端可生成更多样式模板（商务 / 科技 / 高级暗色等）并支持更多文件类型：pdf、图片、excel、docx、doc、csv：<a href="#page-top">前往下载</a>`;
        const href = normalizeDownloadUrl(downloadUrl);
        downloadBtn.href = href;
        // 跨域下载在部分浏览器对 download 属性有限制（会报“下载错误/网络错误”）。
        // 这里统一改成新窗口打开，让服务端 content-disposition 控制文件名。
        if (isCrossOrigin(href)) {
            downloadBtn.removeAttribute("download");
            downloadBtn.setAttribute("target", "_blank");
            downloadBtn.setAttribute("rel", "noopener");
        } else {
            downloadBtn.setAttribute("download", nameText || "origo_result.pptx");
            downloadBtn.removeAttribute("target");
            downloadBtn.removeAttribute("rel");
        }
        downloadBtn.classList.remove("hidden");
        editBtn.classList.remove("hidden");
        retryBtn && retryBtn.classList.add("hidden");
    }

    function showError(msg = "") {
        resultBox.classList.remove("hidden");
        resultBox.textContent = `生成失败\n\n${msg || "👉 建议补充资料后重新生成"}`;
        if (retryBtn) retryBtn.classList.remove("hidden");
        downloadBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
    }

    function showUnsupportedFile(fileName) {
        resultBox.classList.remove("hidden");
        resultBox.innerHTML = `页面版当前不支持此类型（${escapeHtml(fileName || "未知文件")}）。<br/>额外支持：pdf、图片、excel、docx、doc、csv 等更多类型，请下载客户端，可进行更完整的文件分析与报告生成：<a href="#page-top">前往下载</a>`;
        retryBtn && retryBtn.classList.add("hidden");
        downloadBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function runRealProgress(promptText, sourceName) {
        resetDemoArea();
        const lines = [
            "正在提交服务端任务（20%）",
            "正在生成PPT大纲（40%）",
            "正在渲染PPT文件（70%）",
            "正在准备下载链接（90%）",
            "生成完成（100%）",
        ];
        renderProgress(lines, 0);
        try {
            await sleep(300);
            renderProgress(lines, 1);
            const data = await api("/api/services/ppt/generate_file", "POST", {
                prompt: promptText,
                title: sourceName || "",
            });
            await sleep(250);
            renderProgress(lines, 2);
            await sleep(250);
            renderProgress(lines, 3);
            await sleep(200);
            renderProgress(lines, lines.length);
            const fileName = data && data.filename ? data.filename : (sourceName || "origo_result.pptx");
            const downloadUrl = data && data.download_url ? data.download_url : "#";
            showDone(fileName, downloadUrl);
        } catch (err) {
            renderProgress(lines, 2, 2);
            showError(err && err.message ? err.message : "服务端生成失败");
        }
    }

    async function runRealProgressFromUpload(file, promptText) {
        resetDemoArea();
        const lines = [
            "正在上传文件到服务端（20%）",
            "正在解析上传内容（40%）",
            "正在生成PPT大纲（70%）",
            "正在渲染PPT并返回下载（90%）",
            "生成完成（100%）",
        ];
        renderProgress(lines, 0);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("prompt", promptText || "");
            formData.append("title", file.name.replace(/\.[^.]+$/, "") || "在线上传生成");
            await sleep(150);
            renderProgress(lines, 1);
            const data = await apiForm("/api/services/ppt/generate_file_upload", formData);
            await sleep(180);
            renderProgress(lines, 2);
            await sleep(180);
            renderProgress(lines, 3);
            await sleep(150);
            renderProgress(lines, lines.length);
            const fileName = data && data.filename ? data.filename : `${file.name.replace(/\.[^.]+$/, "")}_generated.pptx`;
            const downloadUrl = data && data.download_url ? data.download_url : "#";
            showDone(fileName, downloadUrl);
        } catch (err) {
            renderProgress(lines, 2, 2);
            showError(err && err.message ? err.message : "上传生成失败");
        }
    }

    function bootVideoLoop() {
        const steps = videoMock ? Array.from(videoMock.querySelectorAll(".video-step")) : [];
        if (!steps.length) return;
        let i = 0;
        if (videoTimer) clearInterval(videoTimer);
        videoTimer = setInterval(() => {
            steps.forEach((el) => el.classList.remove("active"));
            steps[i % steps.length].classList.add("active");
            i += 1;
        }, 1100);
    }

    function startFromText() {
        const t = input.value.trim();
        if (!t) return;
        runRealProgress(t, "online_generated.pptx");
    }

    function startFromUpload() {
        const f = fileInput && fileInput.files && fileInput.files[0];
        if (!f) {
            alert("请先选择一个文件");
            return;
        }
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if (!SUPPORTED_UPLOAD_EXTS.has(ext)) {
            resetDemoArea();
            list.innerHTML = "<li class=\"error\">页面版当前不支持此类型，请下载客户端使用更多文件分析能力。</li>";
            showUnsupportedFile(f.name);
            return;
        }
        const typed = input.value.trim();
        runRealProgressFromUpload(f, typed);
    }

    onlineBtn && onlineBtn.addEventListener("click", () => {
        const sec = document.getElementById("online-demo");
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    startBtn.addEventListener("click", startFromText);
    uploadBtn && uploadBtn.addEventListener("click", startFromUpload);
    retryBtn && retryBtn.addEventListener("click", startFromText);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startFromText();
        }
    });
    bootVideoLoop();
    resetDemoArea();
}

window.addEventListener("DOMContentLoaded", () => {
    syncNavAuth();
    initRegisterForm();
    syncDesktopDownloadLinks();
});
document.addEventListener("click", (e) => {
    const root = document.getElementById("nav-auth-user-dropdown");
    if (!root) return;
    if (root.contains(e.target)) return;
    root.classList.remove("open");
});

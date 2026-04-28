from pathlib import Path

from flask import Flask, Response, abort, jsonify, redirect, request, send_from_directory
import json
import os
import requests
import time

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

app = Flask(__name__, static_folder=None)
# 页面端代理统一指向远程服务端 API（可通过环境变量覆盖）
BACKEND_BASE = os.getenv("ORIGO_API_BASE", "https://api.hypermeld.com").strip() or "https://api.hypermeld.com"
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")


@app.get("/")
def index():
    return redirect("/index.html", code=307)


@app.get("/index.html")
def index_html():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/login")
def login_html():
    return send_from_directory(PUBLIC_DIR, "login.html")


@app.get("/register")
def register_html():
    return send_from_directory(PUBLIC_DIR, "register.html")


@app.get("/dashboard")
def dashboard_html():
    return send_from_directory(PUBLIC_DIR, "dashboard.html")


@app.get("/pricing")
def pricing_html():
    return send_from_directory(PUBLIC_DIR, "pricing.html")


@app.get("/_assets/<path:filename>")
def assets_file(filename: str):
    return send_from_directory(BASE_DIR, filename)


@app.get("/favicon.ico")
def favicon():
    # 可选静态图标
    fp = PUBLIC_DIR / "favicon.ico"
    if fp.is_file():
        return send_from_directory(PUBLIC_DIR, "favicon.ico")
    return ("", 204)


@app.get("/<path:filename>")
def public_file(filename: str):
    # 允许直接访问 public 下的静态页面资源
    fp = PUBLIC_DIR / filename
    if fp.is_file():
        return send_from_directory(PUBLIC_DIR, filename)
    return abort(404)


@app.get("/_stcore/health")
def stcore_health():
    return {"status": "ok"}, 200


@app.get("/_stcore/host-config")
def stcore_host_config():
    return {}, 200


@app.route("/api/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def proxy_api(path: str):
    target_url = f"{BACKEND_BASE}/api/{path}"
    headers = {}
    auth_header = request.headers.get("Authorization")
    if auth_header:
        headers["Authorization"] = auth_header
    if request.content_type:
        headers["Content-Type"] = request.content_type

    try:
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            params=request.args,
            data=request.get_data(),
            timeout=120,
        )
    except requests.RequestException:
        return jsonify({"detail": "后端服务不可用，请检查远程服务端连接"}), 502

    return Response(
        resp.content,
        status=resp.status_code,
        content_type=resp.headers.get("Content-Type", "application/json"),
    )


@app.post("/api/demo/word-outline")
def demo_word_outline():
    payload = request.get_json(silent=True) or {}
    user_input = str(payload.get("input", "")).strip()
    # v5: 半真实API结构，先提供稳定骨架，后续可接 DeepSeek 真实生成
    outline = [
        "本周工作概述",
        "完成事项",
        "问题与不足",
        "下周计划",
    ]
    if "项目" in user_input:
        outline = ["项目进展", "关键里程碑", "风险与阻塞", "下阶段安排"]
    time.sleep(0.35)
    return jsonify({"outline": outline})


def _safe_json_loads(raw: str) -> dict | None:
    payload = (raw or "").strip()
    if payload.startswith("```"):
        payload = payload.strip("`")
        if payload.startswith("json"):
            payload = payload[4:].strip()
    try:
        data = json.loads(payload)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _fallback_demo_response(text: str, scene_type: str) -> dict:
    if scene_type == "pdf":
        return {
            "message": "已识别为 PDF 处理需求，下面展示合并预览。",
            "status": "preview",
            "rules": {
                "action": "pdf_merge",
                "files": ["文件1.pdf（10页）", "文件2.pdf（8页）"],
                "result": "合并后 18页",
            },
        }
    if scene_type == "word":
        return {
            "message": "已识别为文档生成需求，下面是文档大纲。",
            "status": "preview",
            "rules": {
                "action": "word_generate",
                "outline": ["本周工作概述", "完成事项", "问题与不足", "下周计划"],
            },
        }
    return {
        "message": "已识别为文件重命名需求，下面展示预览。",
        "status": "preview",
        "rules": {
            "action": "rename",
            "pattern": "{date}_{type}_{seq}",
            "examples": [
                "IMG_001.jpg → 2026-04-10_图片_001.jpg",
                "IMG_002.jpg → 2026-04-10_图片_002.jpg",
            ],
        },
    }


@app.post("/api/demo/chat")
def demo_chat():
    payload = request.get_json(silent=True) or {}
    user_input = str(payload.get("input", "")).strip()
    scene_type = str(payload.get("type", "rename")).strip().lower()
    if not user_input:
        return jsonify({"detail": "input 不能为空"}), 400
    if scene_type not in {"rename", "word", "pdf"}:
        scene_type = "rename"

    if not DEEPSEEK_API_KEY:
        return jsonify(_fallback_demo_response(user_input, scene_type))

    system_prompt = (
        "你是 ORIGO 官网 Demo 的 AI。"
        "必须只返回 JSON，格式为 {message,status,rules}。"
        "status 只能是 draft/modify/confirmed/error/preview/generating/done。"
        "不要输出任何解释性文本。"
    )
    user_prompt = (
        f"用户输入：{user_input}\n"
        f"场景类型：{scene_type}\n"
        "请输出可用于前端 Demo 的结果：\n"
        "- message: 给用户看的一句话\n"
        "- status: 推荐用 preview；word 场景可用 generating/preview\n"
        "- rules: rename/pdf/word 对应结构化字段\n"
    )
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 500,
    }
    try:
        resp = requests.post(
            f"{DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions",
            headers=headers,
            json=body,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        parsed = _safe_json_loads(content)
        if not parsed:
            return jsonify(_fallback_demo_response(user_input, scene_type))
        message = str(parsed.get("message", "")).strip() or "已生成演示结果。"
        status = str(parsed.get("status", "preview")).strip().lower()
        rules = parsed.get("rules") if isinstance(parsed.get("rules"), dict) else {}
        if status not in {"draft", "modify", "confirmed", "error", "preview", "generating", "done"}:
            status = "preview"
        return jsonify({"message": message, "status": status, "rules": rules})
    except requests.RequestException:
        return jsonify(_fallback_demo_response(user_input, scene_type))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)

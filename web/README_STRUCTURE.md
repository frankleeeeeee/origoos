# 页面端目录结构（Vercel Flask 规则）

按 Vercel Flask 入口规则重构后：

- `app.py`
  - 根入口文件，导出 Flask 实例 `app`（Vercel 自动识别）
- `src/index.py`
  - 页面端 Flask 业务实现（路由、代理、demo 接口）
- `index.html` / `login.html` / `register.html` / `dashboard.html` / `pricing.html`
  - 页面模板（由 Flask 静态输出）
- `app.js` / `styles.css`
  - 前端静态资源
- `requirements.txt`
  - 部署依赖

这样可同时满足：

1. Vercel 对 Flask 入口自动发现（`app.py` + `app`）
2. 页面端代码可维护性（实现代码进入 `src/`）

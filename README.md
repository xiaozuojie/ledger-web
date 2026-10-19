# 胖虎记账网页版（GitHub Pages + Supabase）

- **本地模式**（默认无密钥）：浏览器 localStorage，可完整使用 P1～P4  
- **云端 C1**：配置 Supabase 后邮箱登录；「我的账本」按账号同步；分享 `/l/<slug>` 仍可打开  

## 1. 准备 Supabase（免费）

1. 打开 [https://supabase.com](https://supabase.com) 注册并 **New project**  
2. **SQL Editor** 依次执行：  
   - `supabase/schema.sql`（新库；已含 pgcrypto public 包装时可不另跑）  
   - `supabase/patch-pgcrypto-public.sql`（若建账报 `gen_random_bytes does not exist`）  
   - `supabase/patch-open-access.sql`（若库是旧口令版）  
   - **`supabase/patch-c1-auth-owner.sql`（C1 账号归属，必跑）**  
3. **Authentication → Providers → Email** 开启邮箱密码（可按需关闭「确认邮件」方便自测）  
4. **Project Settings → API** 复制：  
   - Project URL → `VITE_SUPABASE_URL`  
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`  

**不要**把 `service_role` 写进前端或 GitHub。

## 2. 本地运行

```powershell
Set-Location -LiteralPath "f:\appworkspace\胖虎的工作空间\可扩展记账小程序\web"
Copy-Item .env.example .env
# 编辑 .env 填入 URL 与 anon key
npm install
npm test
npm run dev
```

浏览器打开本地地址。云端模式：先注册/登录，再建「我的账本」；复制链接可给别人打开（C2 再做成员权限）。

## 3. 部署到 GitHub Pages

1. 新建 GitHub 仓库，把 `web` 目录（或整个小程序工程）推上去  
2. 仓库 **Settings → Secrets and variables → Actions** 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`  
   （有密钥即云端构建；**不要**在 workflow 里写死 `VITE_DATA_MODE=local`）
3. **Settings → Pages → Source** 选 GitHub Actions
4. 推送 `main` 后查看 Actions；成功后访问：  
   `https://xiaozuojie.github.io/ledger-web/`  
   分享某本账：`https://xiaozuojie.github.io/ledger-web/l/<邀请码>`
5. Supabase **Authentication → URL Configuration**：Site URL 填上述首页；Redirect URLs 可加同域 `/**`

本地打包预览：

```powershell
$env:VITE_PAGES_BASE="/你的仓库名/"
npm run build
npm run preview
```

## 4. 与微信小程序关系

小程序仍用本地存储，**数据不互通**。网页是独立入口。

## 5. 安全说明

C1 起建账归属登录用户；`service_role` 禁止进前端。分享链接仍可进入账本（C2 收紧）。强制本地：`VITE_DATA_MODE=local`。

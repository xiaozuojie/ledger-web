# 记账网页版（GitHub Pages + Supabase）

**账本开放**：首页可看到全部账本，点进即用；分享 `/l/<邀请码>` 链接即可，**无需口令/单独授权**。  
功能含综合样表、工时账本、模板编辑、导出/结算图。

## 1. 准备 Supabase（免费）

1. 打开 [https://supabase.com](https://supabase.com) 注册并 **New project**
2. 进入 **SQL Editor**，粘贴并运行本目录 `supabase/schema.sql` 全文  
   - 若以前已经跑过旧版 schema（带口令），再执行一次 `supabase/patch-open-access.sql`
3. **Project Settings → API** 复制：
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
4. 免费项目约一周无活动可能暂停，在控制台 **Restore** 即可

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

浏览器打开终端提示的本地地址。创建账本后点「复制链接」发给协作者即可（开放读写）。

## 3. 部署到 GitHub Pages

1. 新建 GitHub 仓库，把 `web` 目录（或整个小程序工程）推上去  
2. 仓库 **Settings → Secrets and variables → Actions** 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 将 `.github/workflows/deploy-pages.yml` 放到**仓库根**的 `.github/workflows/`（若仓库根就是 `web`，把 `working-directory: web` 删掉并改 artifact 路径为 `dist`）
4. **Settings → Pages → Source** 选 GitHub Actions
5. 推送 `main` 后查看 Actions；成功后访问：  
   `https://<用户名>.github.io/<仓库名>/`

本地打包预览：

```powershell
$env:VITE_PAGES_BASE="/你的仓库名/"
npm run build
npm run preview
```

## 4. 与微信小程序关系

小程序仍用本地存储，**数据不互通**。网页是独立入口。

## 5. 安全说明

口令哈希存在数据库；适合熟人小范围。口令泄露等于账本公开。

# V3 已上线 · 今日导航与自我恢复

当前入口：[有意义地生活 V3](https://huixuantang556-netizen.github.io/meaning-cards/web/)。新增可编辑日程、六种恢复入口、睡眠保护和娱乐计时，保留全部 V2 功能、原数据和 JSON 备份。14 项本地自动测试通过；线上资源已逐一核验。详见 [V3 更新、备份与回退](V3-更新与回退.md)。

当前 Pages 使用 **main 分支 / (root)** 发布，保留 `/web/` 路径及根目录已有工具；不要套用下面旧版说明去切换发布来源。旧版说明提到的 `.github/workflows/pages.yml` 在现有仓库实际位于 `workflows/pages.yml`，不是已启用的自定义工作流；当前自动构建由 GitHub 的分支 Pages 流程完成。

**Supabase 的线上公开配置仍为空，本次没有可连接的真实项目；登录和跨设备同步尚未实测。** 无需新增数据库表或迁移；继续保留原有 RLS 与版本冲突保护。仅配置公开 URL/publishable key，禁止提交私钥和私人备份。

以下保留原版部署与 Supabase 说明供参考（实际发布来源以上述 V3 记录为准）。

# 有意义地生活 · GitHub Pages + Supabase

本项目直接从用户提供的 `behavior_meaning_cards.html` 拆分改造，保留原版 15 张卡片的全部文字、分类、晨间三张卡、搜索、阅读、模板生成、AI 提示词、编辑、删除、收藏、JSON 导入导出和恢复示例功能。没有把 AI API 密钥放到网页里；生成仍是本地模板 + 复制提示词到 ChatGPT。

新增邮箱验证码登录、账户隔离、保存后同步、每 15 秒轮询、恢复联网/回到页面时同步、离线待同步保存和并发冲突处理。**这是可部署源码，尚未上线，也未连接真实 Supabase 项目完成双设备验证。**

## 1. 文件在哪里

- `web/`：要发布的网站。入口是 `index.html`，所有资源使用相对路径，支持 GitHub 仓库子路径。
- `web/config.js`：实际使用的配置，默认留空，开箱可使用本机功能。
- `web/config.example.js`：配置模板。
- `supabase/schema.sql`：建表、权限隔离、原子版本检查写入函数。
- `supabase/security-test.sql`：测试项目中运行的数据库权限与冲突验证，结束回滚。
- `supabase/email-template.html`：登录验证码邮件模板。
- `.github/workflows/pages.yml`：自动测试与 GitHub Pages 部署。
- `tests/app.test.cjs`：无需安装依赖的 Node 测试。
- `VERIFICATION.md`：已验证内容及上线前验收清单。

## 2. 创建 Supabase 项目

1. 在 [Supabase](https://supabase.com/dashboard) 创建项目。数据库密码只存你自己的密码管理器，不填进网站。
2. 打开 SQL Editor，粘贴并运行 `supabase/schema.sql`。建议先使用全新项目；SQL 不删除现有卡片。
3. 在 Authentication → Sign In / Providers 启用 Email。保持邮箱验证开启。新用户通过验证码登录时可创建账户；若只给自己使用，先完成首次登录，再在后台关闭允许新用户注册。关闭后已有用户仍可登录。
4. 在 Authentication → Email Templates，把 **Magic Link** 邮件正文替换为 `supabase/email-template.html`，确认含 `{{ .Token }}`。如后台对新注册另发 Confirm signup 邮件，也将该模板改为显示同一变量。本项目输入验证码登录，不使用邮件链接回跳。
5. 配置邮件发送。默认测试邮件服务可能仅能发送到项目团队成员邮箱且有速率限制；正式使用应在 Authentication → SMTP 配置自己的邮件服务。SMTP 密码只填在 Supabase 后台，绝不能写入前端。
6. Authentication → URL Configuration 的 Site URL 填最终网站完整地址，例如 `https://你的用户名.github.io/meaning-cards/`。不要使用宽泛的回跳地址通配符。
7. 在 Project Settings / Connect 找到项目 URL 和 **Publishable key**（以 `sb_publishable_` 开头）。编辑 `web/config.js`：

```js
window.MEANING_CONFIG = {
  supabaseUrl: "https://你的项目编号.supabase.co",
  publishableKey: "sb_publishable_你的公开键"
};
```

这两个值设计上就是公开连接信息，可以出现在公开仓库。浏览器直接连接 Supabase 必须有公开键；安全边界是用户登录令牌、RLS 和写入函数。**不要填写 `service_role`、`sb_secret_`、数据库连接密码、GitHub PAT、邮箱密码或 AI API 密钥。** 本项目主动拒绝非 `sb_publishable_` 键，不支持旧式 anon JWT 配置。

详细依据：[公开键与私密键](https://supabase.com/docs/guides/getting-started/api-keys)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[邮箱验证码](https://supabase.com/docs/guides/auth/auth-email-passwordless)。

## 3. 发布到 GitHub Pages

1. 在 GitHub 建一个仓库，例如 `meaning-cards`。不要把个人 JSON 备份、冲突备份、旧浏览器缓存放进仓库。
2. 解压项目，把项目**里面的内容**上传到仓库根目录，确保根目录下有 `web`、`supabase`、`tests`、`.github`。Mac Finder 默认隐藏 `.github`，可按 Command + Shift + . 显示隐藏文件，或使用 GitHub Desktop 提交整个文件夹。
3. 默认分支使用 `main`；如使用其他分支，修改 `.github/workflows/pages.yml` 中的分支名。
4. Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
5. 提交代码后，在 Actions 等待 “Deploy GitHub Pages” 完成；也可在该工作流下选择 Run workflow。
6. Pages 页面会显示真正的网址。打开网址，确认页面和卡片正常；到「我的数据」用邮箱验证码登录。
7. 如仓库之前用分支发布旧网站，先切换为 GitHub Actions；本工作流只发布 `web/`，SQL、测试与 README 不会作为网页资源发布。

工作流使用 GitHub 自动提供的最小权限令牌，不需要创建或填写 PAT。配置改动后重新提交即可部署。GitHub Pages 的公开页面仅含应用和初始示例文案；用户私有卡片存在 Supabase 中。[GitHub 官方部署说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 4. 把原版卡片迁移过来

1. 在**原来的 HTML、原来的浏览器**打开「我的数据」，下载 JSON 备份。原版 HTML 文件本身只包含初始卡片，后来编辑过的内容在浏览器存储中，需要另外导出。
2. 在新网站未登录状态下，通过「恢复备份」导入旧 JSON，确认数量、内容和收藏。
3. 登录。首次登录账户卡片库为空是正常现象。点击「把本机卡片追加到账户」一次。该操作不会覆盖云端已有卡片，但重复点击会产生副本。
4. 等顶部显示“已同步”。手机打开同一个网站，用同一邮箱登录，等待约 15 秒或点“立即同步”。
5. 以后在任一设备编辑，关闭网页前确认已同步。无网络时修改保留在当前浏览器，联网后继续提交。**没有服务工作线程，不保证离线冷启动网页；已打开的页面可以离线编辑。**

如果希望直接用旧备份替换账户卡片，也可登录后恢复 JSON；这是全量替换，会同步删除云端未包含的卡片，因此先导出当前账户备份。

## 5. 同步与冲突的实际行为

- 采用整库快照和服务器递增版本，不依赖手机/电脑时间。收藏和删除都是快照的一部分，不会被旧设备无条件复活。
- 一次写入是数据库事务，锁定该用户的一行记录；只有客户端版本和当前云端版本一致才接受写入。
- 保存后约 0.8 秒尝试同步；前台页面每 15 秒检查一次。浏览器在后台会限制定时器，回到页面补同步。关闭网页后不继续运行。
- 编辑窗口打开时暂缓拉取，避免覆盖正在输入的文字。保存/关闭编辑后继续同步。
- 两台设备同时编辑，即使修改的是不同卡片，也可能触发整库冲突。本版优先避免静默丢失，不自动进行字段级合并。
- 冲突时「我的数据」出现提示，必须先下载一个包含 `local.cards` 与 `cloud.cards` 的两版本备份，再选择采用本机或云端。备份下载仍需你确认浏览器确实保存成功。
- 手动合并：用文本编辑器打开冲突备份，选择需要的卡片组成 `{"cards":[...]}`，保证 ID 不重复，再通过恢复备份导入。也可从备份复制所需单张卡片到“粘贴 AI 生成的卡片”，此入口会生成新 ID 并追加。
- 请求失败会保留待同步状态。相同操作 ID 可重试；如果别的设备在此期间更新，则保留两份版本供选择。
- 同一个浏览器同一网站只允许一个编辑标签页，其他标签页显示提示。需要现代浏览器 Web Locks 和 HTTPS（本地 localhost 也可）；不支持时云同步禁用。
- 退出前要求同步完成且冲突已处理。退出会清除此浏览器的账户卡片缓存；本机访客卡片保留。不要通过清除浏览器数据来处理未同步冲突。

## 6. 隐私、边界与备份

数据库按 `auth.uid()` 隔离。已登录用户只能读取自己的一行；匿名用户不能读；前端无法直接写表。唯一写入函数不接收 user_id 参数，从已验证登录身份取值。它固定 search_path，并限制数组大小和重复 ID。请先在测试项目执行权限测试，再接入正式数据。

应用不会使用 analytics 或发送卡片给 AI。启用同步后卡片内容会存到你的 Supabase 项目，项目管理员可以访问；这不是端到端加密。登录令牌由 Supabase SDK 保存在浏览器本地，账户卡片也有本地缓存；共用设备请退出。避免在同一 GitHub Pages 域名下部署不可信脚本或项目，因为同源页面可能访问浏览器存储。要求更强隔离时使用独立域名。

云同步 SDK 固定为 `@supabase/supabase-js@2.57.4`，由 `esm.sh` 在启用云同步时加载。它是受信任的第三方代码依赖；首次加载需要网络，该站点不可达时同步不可用。本机功能无需该依赖。后续升级 SDK 应重新测试登录、离线恢复和冲突处理。

同步不是历史备份：误删会同步，云端没有自动回收站。请定期下载 JSON 并保存到自己的备份位置。单库最多 5000 张卡片，前端有约 150 万字符限制，数据库约 2 MB 限制，超限会保留本机并报告错误。页面数据不会写入 GitHub 仓库。网站没有内置账户删除入口，如需彻底删除，先备份，再由项目所有者在 Supabase 删除 Auth 用户，关联卡片行会级联删除。

## 7. 本地预览和测试

无需 npm 安装。使用 Node 22 或更新版本运行：

```sh
node --test tests/*.test.cjs
```

使用 Python 3 启动静态服务器：

```sh
python3 -m http.server 8080 --directory web
```

浏览器访问 `http://localhost:8080`。本机预览的数据与 GitHub Pages 数据是不同浏览器存储；可通过 JSON 迁移。直接双击 `web/index.html` 可试用部分本机功能，但云同步请使用 HTTPS 或 localhost。

数据库测试：在**测试 Supabase 项目**先执行 schema，再执行 `supabase/security-test.sql`。该测试在事务内建立两个临时 Auth 用户，验证访问隔离、匿名拒绝、绕过函数直接写表拒绝、冲突拒绝、幂等重试，最后回滚。若中途报错，执行 `rollback;`，不要把报错当作通过。

## 8. 常见问题

- 没有验证码：检查 Magic Link 模板是否包含 Token、SMTP、垃圾邮件、服务配额、发送间隔和允许注册设置。
- 收到的是链接：尚未按步骤替换邮件模板，本网站不处理链接回跳。
- 登录后没有原卡片：账户与本机分开；点击复制本机卡片，或登录后导入 JSON。
- 表/函数不存在：检查 SQL 是否执行成功、前端是否连接同一个 Supabase 项目。
- 权限错误：检查 grants 和 RLS，不要通过关闭 RLS 或换成 service_role 来解决。
- 页面有卡片但不能同步：检查 config.js、网络是否可访问 esm.sh 和 Supabase，以及浏览器顶部状态。
- 换设备不更新：确认同一项目、同一邮箱，关闭编辑窗口，回到页面并点立即同步。

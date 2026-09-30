# 生产部署（xibaojun.com/drill）

interview-drill 部署在 https://xibaojun.com/drill（**自有前缀 /drill**，页面与 API 全在其下），
与老 xibaojun 项目同机同域名但零路径交集。本文档 = 部署记录 + **日常升级只看「升级步骤」一节**。

## 服务器与架构总览

| 项 | 值 |
|---|---|
| 服务器 | `ssh -p 22222 root@82.29.72.221`（免密）AlmaLinux 10.2 x86_64，2.9G 内存 / 30G 盘 |
| 访问入口 | https://xibaojun.com/drill（证书 certbot 管，续期自动，与老站共用） |
| 应用目录 | `/opt/interview-drill`（rsync 全量源码，服务器上构建） |
| 进程 | systemd `interview-drill.service` → `next start -H 127.0.0.1 -p 8300` |
| 数据库 | PostgreSQL 16.15（dnf 装），库 `drill` / 用户 `drill`，仅监听 `127.0.0.1,::1` |
| Node | v22.23.2（dnf nodejs）；pnpm 11.7.0（`npm i -g pnpm@11.7.0`，与本地大版本对齐） |

### nginx 分流规则（/etc/nginx/conf.d/xibaojun.com.conf）

- `location = /drill` 与 `location /drill/` → **interview-drill**（127.0.0.1:8300，URI 原样
  透传，Next basePath='/drill' 自己认前缀）——drill 的全部页面与 `/drill/api/**` 都在这里；
- 其余一切归老站：`location /api/` → Spring（8081）、`/admin/` `/apk/` → 静态文件；
  **根路径 302 → `/drill`**（域名首页落地到刷题站，老站后台直接访问 /admin/）。

改 nginx 前先备份：`cp xibaojun.com.conf xibaojun.com.conf.bak-$(date +%Y%m%d-%H%M%S)`，改完 `nginx -t && systemctl reload nginx`。

> **⚠️ 三个首日踩过的坑（2026-09-30）**
> 1. **共域抢路径**：最初 drill 占根路径 + 整段 `/api/auth/**`，抢走老站登录接口
>    （`/api/auth/login`、`/api/auth/admin/login`）→ 老站后台/App 登录全 400。
>    根治 = 全站退回 /drill 独占前缀。**别再让 drill 用根路径或裸 /api**。
> 2. **尾斜杠死循环**：nginx 把 /drill 308 → /drill/，Next 又把 /drill/ 308 → /drill（去尾
>    斜杠）。两个 location 都直接反代即可，别加重定向。
> 3. **双前缀**：Next 的 `redirect()`/`<Link>` 会**自动**补 basePath——服务端 redirect 目标
>    给裸路径（如 '/api/auth/signin'），手动 withBase 会叠成 /drill/drill/...。
>    自动带前缀：Link / redirect / router.push。不带（须 withBase 或显式配置）：裸 fetch
>    （client/api.ts 全部已 withBase）、next-auth 客户端（根布局 AuthBridge 的
>    SessionProvider basePath）、pages.signIn 显式 '/drill/signin'、signOut/signIn 的
>    callbackUrl。

## 升级步骤（日常发版就做这些）

```bash
# 0) 本地：改动已提交、测试绿
pnpm typecheck && pnpm test

# 1) 同步代码（本地项目根执行；--delete 保持服务器与本地一致，排除项勿动）
rsync -az --delete -e "ssh -p 22222" \
  --exclude node_modules --exclude .next --exclude .git --exclude .codetui \
  --exclude .env.local --exclude .env.production.local --exclude docs/superpowers \
  ./ root@82.29.72.221:/opt/interview-drill/

# 2) 服务器：装依赖 + 构建（约 1 分钟；2G swap 已保障内存）
ssh -p 22222 root@82.29.72.221
cd /opt/interview-drill
pnpm install --frozen-lockfile && pnpm build

# 3) 数据库迁移 + 题库内容 upsert（先 source 生产 env）
set -a; source .env.production.local; set +a
pnpm exec drizzle-kit migrate      # 有新迁移才有效果，幂等
pnpm content:upsert                # 题库/岗位包有变更时必须重跑

# 4) 重启 + 验证
systemctl restart interview-drill
curl -s https://xibaojun.com/drill/api/health     # 期望 {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" https://xibaojun.com/drill   # 期望 200
```

日志：`journalctl -u interview-drill -f`。

## 运维命令速查

应用进程（systemd 单元 `interview-drill`，开机自启、崩溃自动拉起）：

```bash
# 重启（改了代码/env 后必须重启才生效）——本地一条命令直达：
ssh -p 22222 root@82.29.72.221 'systemctl restart interview-drill'

# 或者先登进服务器再操作：
ssh -p 22222 root@82.29.72.221
systemctl restart interview-drill     # 重启
systemctl stop interview-drill        # 停服（老站不受影响，/drill 会 502）
systemctl start interview-drill       # 启动
systemctl status interview-drill      # 看状态（运行中/主 PID/内存）
journalctl -u interview-drill -f      # 跟日志（Ctrl+C 退出）
journalctl -u interview-drill -n 100  # 看最近 100 行
```

改完 nginx 配置后 reload（配置在 `/etc/nginx/conf.d/xibaojun.com.conf`）：

```bash
nginx -t && systemctl reload nginx    # 必须先 -t 校验通过再 reload
```

健康检查（发完版/重启后各跑一遍）：

```bash
curl -s https://xibaojun.com/drill/api/health            # 期望 {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" https://xibaojun.com/drill   # 期望 200
```

数据库备份 / 进入 psql：

```bash
sudo -u postgres pg_dump drill > /root/drill-$(date +%F).dump   # 重大变更前先备份
sudo -u postgres psql drill                                     # 进库手工查数据
```

### 邀请码（解锁码）的生成与使用

**是什么**：在线支付上线前，用户解锁全部题库（plan→paid）的唯一通道。一码一用，
明文只在铸造时展示一次（库里只存哈希）。

**给谁用**：拿到码的用户在 `/drill/upgrade` 页输入兑换 → 解锁全部题目。

**谁能生成**：管理员（服务器 env 里 `ADMIN_GITHUB_IDS` 白名单内的 GitHub 账号，逗号分隔；
空名单 = 无人可进，fail closed）。

#### 生成路径①：网页后台（推荐，日常用这个）

1. 浏览器打开 **https://xibaojun.com/drill/backstage**（本地开发即 http://localhost:3000/drill/backstage）
2. 用管理员 GitHub 账号登录（没登录或不在白名单 → 只会看到「这里没有你要找的东西」）
3. 表单填**数量**和**备注**（给谁/干什么用）→ 点铸造
4. 明文码逐张展示，**仅此一次**——当场点「一键复制」发给用户；关页即不可找回
5. 页面下方是台账：备注 / 铸造时间 / 状态（未用 或 被谁兑换）

#### 生成路径②：服务器 CLI（批量/自动化用）

```bash
ssh -p 22222 root@82.29.72.221
cd /opt/interview-drill
pnpm exec tsx --env-file-if-exists=.env.production.local tools/invite-new.ts 3 备注名
# 参数：数量 + 备注；明文码打印在终端，同样仅此一次
# 注意：pnpm invite:new 脚本只读 .env.local（本地开发用）；生产必须像上面显式指 env 文件
```

> 管理员名单调整：改 `/opt/interview-drill/.env.production.local` 里的 `ADMIN_GITHUB_IDS`
> （GitHub 数字 id，逗号分隔）→ `systemctl restart interview-drill` 生效。
> 兑换记录/台账数据都在 PG 的 invite_codes + users 表里，`sudo -u postgres psql drill` 可查。

## 生产环境文件（不在 git 里，人工保管）

`/opt/interview-drill/.env.production.local`（chmod 600）：

```
DATABASE_URL=postgresql://drill:<密码>@127.0.0.1:5432/drill
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://xibaojun.com/drill/api/auth   # path 部分就是 NextAuth 基路径（v4 机制）
GITHUB_ID=          # 生产 GitHub OAuth App（见下）——填好后 restart 生效
GITHUB_SECRET=
ADMIN_GITHUB_IDS=1187815
```

**GitHub OAuth**：github.com → Settings → Developer settings → OAuth Apps 新建，
Homepage `https://xibaojun.com/drill`，回调 `https://xibaojun.com/drill/api/auth/callback/github`，
把 Client ID/Secret 填进上面 env 并 `systemctl restart interview-drill`。
（未配置时站点匿名可正常浏览，仅 GitHub 登录不可用。）

systemd unit：`/etc/systemd/system/interview-drill.service`（Restart=always，开机自启）。

## 首次部署记录（2026-09-30，回溯用）

1. `dnf install -y nodejs postgresql-server postgresql`（node 22 / pg 16）；`npm i -g pnpm@11.7.0`。
2. swap 只有 512M → 加 2G `/swapfile`（已写 fstab），防 next build OOM。
3. PG：`postgresql-setup --initdb`；建角色/库（drill/drill，owner drill）；
   **坑①** pg_hba 默认 127.0.0.1 用 ident（node 进程过不了）→ 改 `scram-sha-256`；
   **坑②** `listen_addresses='localhost'` 在该机只解析到 ::1（连接 127.0.0.1 被拒）
   → 显式 `listen_addresses = '127.0.0.1,::1'` 后 restart。
4. rsync 全量源码 → `pnpm install --frozen-lockfile && pnpm build`。
5. 写 `.env.production.local` → `pnpm exec drizzle-kit migrate`（0000→0004 全量）
   → `pnpm content:upsert`（81 块 / 404 卡 / 1769 要点 / 3 岗位包）。
6. systemd unit + `systemctl enable --now interview-drill`。
7. nginx：见上方分流规则与三个坑；中间经历「共域根路径+正则分流 → /api/auth 撞车收窄 →
   最终全站 /drill 独占前缀」三轮（commit 41a175e 为基路径迁移）。
8. 验证全绿：/drill 200 与落地页库量统计、/drill/api/health ok、登录跳转链
   302 → /drill/signin（callbackUrl 绝对化回 /drill）、settings 匿名跳登录无双前缀、
   老站根路径 302 /admin/、Spring /api/** 与登录接口原样、/drill/ 308 → /drill 无循环。

## 回滚

- 应用层：升级出问题 → 本地 git 回退 → 重走升级步骤；或 `systemctl stop interview-drill`
  （老站不受影响，/drill 全 502）。
- nginx：`cp /etc/nginx/conf.d/xibaojun.com.conf.bak-<时间戳> /etc/nginx/conf.d/xibaojun.com.conf && nginx -t && systemctl reload nginx`。
- DB：迁移不可自动回滚；重大变更前先 `sudo -u postgres pg_dump drill > /root/drill-$(date +%F).dump`。

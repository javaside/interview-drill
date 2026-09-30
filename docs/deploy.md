# 生产部署（xibaojun.com）

interview-drill 与老 xibaojun 项目**共享域名** xibaojun.com，同机不同端口，nginx 按路径分流。
本文档 = 首次部署的完整记录 + **日常升级只需看「升级步骤」一节**。

## 服务器与架构总览

| 项 | 值 |
|---|---|
| 服务器 | `ssh -p 22222 root@82.29.72.221`（免密）AlmaLinux 10.2 x86_64，2.9G 内存 / 30G 盘 |
| 域名 | https://xibaojun.com（证书 certbot 管，续期自动，两应用共用） |
| 应用目录 | `/opt/interview-drill`（rsync 全量源码，服务器上构建） |
| 进程 | systemd `interview-drill.service` → `next start -H 127.0.0.1 -p 8300` |
| 数据库 | PostgreSQL 16.15（dnf 装），库 `drill` / 用户 `drill`，仅监听 `127.0.0.1,::1` |
| Node | v22.23.2（dnf nodejs）；pnpm 11.7.0（`npm i -g pnpm@11.7.0`，与本地大版本对齐） |

### nginx 分流规则（/etc/nginx/conf.d/xibaojun.com.conf）

- `location ~ ^/api/(auth|backstage|billing|blocks|cram|health|map|queue|review|settings|sync)(/|$)` → **interview-drill**（127.0.0.1:8300）
  ——正则 location 优先于前缀，新增 drill API 路由时**要把子路径加进这个正则**；
- `location /` → **interview-drill**（所有页面：/、/map、/settings、/signin、/learn、/practice、/backstage、/upgrade、/q/...）；
- `location /api/`（其余）→ 老 xibaojun Spring（127.0.0.1:8081）；
- `location /admin/`、`/apk/` → 老 xibaojun 静态文件，原样保留。

改 nginx 前先备份：`cp xibaojun.com.conf xibaojun.com.conf.bak-$(date +%Y%m%d-%H%M%S)`，改完 `nginx -t && systemctl reload nginx`。

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
curl -s https://xibaojun.com/api/health        # 期望 {"ok":true}
curl -s -o /dev/null -w "%{http_code}\n" https://xibaojun.com/   # 期望 200
```

日志：`journalctl -u interview-drill -f`。

### 铸邀请码（解锁码）

```bash
cd /opt/interview-drill
pnpm exec tsx --env-file-if-exists=.env.production.local tools/invite-new.ts 3 备注名
# 注意：pnpm invite:new 脚本只读 .env.local（本地用）；生产必须像上面这样显式指 env 文件
```

## 生产环境文件（不在 git 里，人工保管）

`/opt/interview-drill/.env.production.local`（chmod 600）：

```
DATABASE_URL=postgresql://drill:<密码>@127.0.0.1:5432/drill
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://xibaojun.com
GITHUB_ID=          # 生产 GitHub OAuth App（见下）——填好后 restart 生效
GITHUB_SECRET=
ADMIN_GITHUB_IDS=1187815
```

**GitHub OAuth**：github.com → Settings → Developer settings → OAuth Apps 新建，
Homepage `https://xibaojun.com`，回调 `https://xibaojun.com/api/auth/callback/github`，
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
4. rsync 全量源码（见升级步骤第 1 步命令，排除清单一致）→ `pnpm install --frozen-lockfile && pnpm build`。
5. 写 `.env.production.local` → `pnpm exec drizzle-kit migrate`（0000→0004 全量）
   → `pnpm content:upsert`（81 块 / 404 卡 / 1769 要点 / 3 岗位包）。
6. systemd unit + `systemctl enable --now interview-drill`。
7. nginx：备份后改 conf——删 `location = / { return 302 /admin/; }`，加 drill 的 API 正则
   location 与 `location /` 反代 8300（见上表），`nginx -t && systemctl reload nginx`。
8. 验证全绿：落地页出真实库量统计、/api/health ok、/map /signin 200、
   /admin/ 200（老站无恙）、Spring /api/xxx 仍回 Spring（401 为其鉴权响应）、http→https 301。

## 回滚

- 应用层：升级出问题 → 本地 git 回退 → 重走升级步骤；或 `systemctl stop interview-drill`（老站不受影响，drill 全站 502）。
- nginx：`cp /etc/nginx/conf.d/xibaojun.com.conf.bak-<时间戳> /etc/nginx/conf.d/xibaojun.com.conf && nginx -t && systemctl reload nginx`。
- DB：迁移不可自动回滚；重大变更前先 `sudo -u postgres pg_dump drill > /root/drill-$(date +%F).dump`。

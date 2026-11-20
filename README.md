# nginx

Learning nginx as a **fullstack engineer**: how to put a React frontend and a backend (Node / Python / Spring Boot) behind nginx, and fix the errors you meet in real projects. Each step lives in its own folder (`01-static/`, `02-spa/`, …).

## Roadmap

| # | What you'll build | What you'll learn |
|---|-------------------|-------------------|
| 1 | ✅ Serve a static page | `server`, `root`, `index`, `nginx -t` |
| 2 | Serve a React build and fix **404 on page refresh** | SPA fallback with `try_files` |
| 3 | Route `/api` to a backend, so **no CORS** is needed | Reverse proxy, `proxy_pass`, why **502** happens |
| 4 | A file upload that fails with **413**, then fix it | `client_max_body_size`, timeouts (**504**) |
| 5 | Fast-loading assets | Cache headers for hashed files, gzip |
| 6 | A hammer-it-with-requests test that starts returning **429s** | Rate limiting |
| 7 | A tiny chat app working through the proxy | WebSocket proxy |
| 8 | Two copies of the backend behind nginx | Load balancing (basic) |
| 9 | HTTPS locally | TLS basics, redirecting HTTP to HTTPS |

Examples use **React (Vite)** for the frontend and **Node/Express** for the backend, with notes where Python or Spring Boot differ.

## Requirements

- Docker (with Docker Compose)

---

# Step 1: Serve a static site — notes

## 1.1 Run nginx with its default setup

```bash
docker run --rm -p 8080:80 nginx:1.27-alpine   # terminal 1
curl -i http://localhost:8080/                 # terminal 2
```

| Part | Meaning |
|------|---------|
| `docker run` | Start a container from an image |
| `--rm` | Delete the container when it stops |
| `-p 8080:80` | Port 8080 on my machine → port 80 inside the container (where nginx listens) |
| `nginx:1.27-alpine` | Official nginx image, version 1.27, built on small Alpine Linux |
| `curl -i` | Make an HTTP request and show the response **headers** too |

**What I saw:**
- Status line `HTTP/1.1 200 OK`
- `Server: nginx/1.27.x` — nginx announces its version by default
- `Content-Type: text/html` — nginx picks this from the file extension
- Terminal 1 printed an **access log** line for every request

Stop with `Ctrl+C`.

## 1.2 Look inside the container

```bash
docker run -d --rm --name nginx-explore -p 8080:80 nginx:1.27-alpine

docker exec nginx-explore cat /etc/nginx/nginx.conf
docker exec nginx-explore ls /etc/nginx/conf.d/
docker exec nginx-explore cat /etc/nginx/conf.d/default.conf
docker exec nginx-explore ls /usr/share/nginx/html/

docker stop nginx-explore
```

| Part | Meaning |
|------|---------|
| `-d` | Run in the background ("detached") |
| `--name nginx-explore` | Give the container a name so I can refer to it |
| `docker exec <name> <cmd>` | Run a command **inside** a running container |

**Where things live in the official image:**

| Path | What it is |
|------|------------|
| `/etc/nginx/nginx.conf` | Main config. Its `http { }` block ends with `include /etc/nginx/conf.d/*.conf;` |
| `/etc/nginx/conf.d/default.conf` | The default `server { }` block, pulled in by that `include` |
| `/usr/share/nginx/html/` | The files that get served (`index.html`, `50x.html`) |

**How a request finds a file:** in `default.conf`:

```nginx
location / {
    root   /usr/share/nginx/html;
    index  index.html index.htm;
}
```

- `root` + request path = file on disk → `/foo.css` becomes `/usr/share/nginx/html/foo.css`
- For a directory (like `/`), nginx tries each `index` file in order → `/usr/share/nginx/html/index.html`

**Key idea:** nginx config is split into files and glued together with `include`. To serve my own site, I can replace the files in `/usr/share/nginx/html/`, the config files, or both.

## 1.3 Serve my own page (bind mount)

```bash
cd ~/Projects/learn/nginx
mkdir -p 01-static/site
cd 01-static
echo "<h1>My first nginx page</h1>" > site/index.html

docker run -d --rm --name step1 -p 8080:80 \
  -v "$(pwd)/site:/usr/share/nginx/html:ro" nginx:1.27-alpine
curl -i http://localhost:8080/

docker stop step1
```

| Part | Meaning |
|------|---------|
| `-v <host-path>:<container-path>` | **Bind mount**: my local folder appears inside the container and *hides* whatever was there |
| `$(pwd)` | Current directory. Docker needs an absolute path |
| `:ro` | Read-only, so nginx can read my files but not change them |

**What I learned:**
- Editing `site/index.html` shows up on the next request **without restarting nginx**.
- Why: nginx reads content files from disk **on every request**. It reads its **config** only at startup or reload, so config changes need `nginx -s reload`.

## 1.4 Write my own server config

`01-static/default.conf`:

```nginx
server {
    listen      80;                  # port nginx listens on inside the container
    server_name localhost;           # which Host header this block answers to

    root  /usr/share/nginx/html;     # folder to serve files from
    index index.html;                # file to serve when a directory (like /) is requested
}
```

Run it **from inside `01-static/`**:

```bash
cd ~/Projects/learn/nginx/01-static
docker run -d --rm --name step1 -p 8080:80 \
  -v "$(pwd)/site:/usr/share/nginx/html:ro" \
  -v "$(pwd)/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine

curl -i http://localhost:8080/
docker exec step1 nginx -t    # test config: "syntax is ok" or file + line of the error
docker exec step1 nginx -T    # test AND print the full combined config nginx is using
```

| Part | Meaning |
|------|---------|
| `server { }` | One website ("virtual host"). nginx can have many and picks one per request |
| 2nd `-v` | Replaces a single file. My `default.conf` sits where the default was and is pulled in by `include /etc/nginx/conf.d/*.conf;` |
| `nginx -t` | Test the config without applying it |
| `nginx -T` | Test and print the whole merged config |

**Config is a tree, and settings are inherited downward:**

```
http { }
 └── server { }        ← root + index set here
      └── location { } ← none yet; would inherit root + index
```

- `root` and `index` are allowed in `http`, `server` and `location`.
- A setting in an outer block applies to everything inside it, unless an inner block sets its own value.
- The default config put `root` inside `location / { }`. Mine puts it at the `server` level, so it applies to every request, and future `location` blocks inherit it. Repeating `root` in every location is a common beginner mistake.

### ⚠️ Gotcha: a wrong bind-mount path creates an empty directory

I first ran the command from the project root instead of `01-static/`, and got:

```
error mounting ".../nginx/default.conf" to rootfs at "/etc/nginx/conf.d/default.conf":
... not a directory: Are you trying to mount a directory onto a file (or vice-versa)?
```

- If the host path in `-v` **doesn't exist**, Docker **silently creates an empty directory** (owned by root) instead of reporting an error.
- A directory can't be mounted over a file, so the container failed to start.
- Cleanup: `sudo rmdir default.conf site` in the wrong folder (`rmdir` only removes empty directories, so it's safe).
- **Lesson:** when a mount behaves strangely, check `pwd` first. `docker-compose.yml` avoids this because its paths are relative to the compose file.

---

# Step 2: Serve a React build — notes

## 2.1 Serve the production build

**Key idea:** in production, nginx doesn't run React. It serves the **built files** from `npm run build` (`dist/`), which are plain HTML, JS and CSS. The Vite dev server (port 5173) is only for development.

```bash
cd ~/Projects/learn/nginx
mkdir 02-spa && cd 02-spa
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm run build          # outputs dist/

docker run -d --rm --name step2 -p 8080:80 \
  -v "$(pwd)/dist:/usr/share/nginx/html:ro" \
  nginx:1.27-alpine
```

- After changing code, run `npm run build` again and refresh. No container restart is needed, because `dist/` is mounted and nginx reads files on every request.
- Files in `dist/assets/` have a **content hash** in their names (`index-a1b2c3.js`). When the code changes, the name changes too. That means browsers can cache these files "forever" and still get new code after a deploy (this is cache busting, used in step 5). `index.html` has no hash, so it must **not** be cached for long.

## 2.2 The "404 on refresh" bug

Added React Router (`npm install react-router`) with `/` and `/about` routes, then rebuilt.

| Action | What actually happens | Result |
|--------|-----------------------|--------|
| Click the **About** link | **No request to nginx.** React Router changes the URL with JS (`history.pushState`) and renders `<About />` | ✅ Works |
| **Refresh** on `/about` (or open the link directly) | Browser sends `GET /about` to nginx. nginx looks for `/usr/share/nginx/html/about`, and that file doesn't exist | ❌ 404 |

**Key idea:** React routes exist only in the browser. nginx only knows about files. The fix: *"if no file matches the URL, return `index.html` and let React pick the page."*

## 2.3 Fix it with `try_files`

`02-spa/default.conf`:

```nginx
server {
    listen      80;
    server_name localhost;

    root  /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`try_files` tries each option from left to right and uses the **first one that exists**:

| Option | Meaning | For `/about` |
|--------|---------|--------------|
| `$uri` | A file at this path? | no |
| `$uri/` | A directory at this path (serve its `index`)? | no |
| `/index.html` | Fallback | ✅ returns `index.html` → React renders `<About />` |

- `location / { }` matches every request, because every URL starts with `/`.
- `try_files` must go inside a `location`. `root` and `index` stay at the `server` level and are inherited.
- You can't add a mount to a running container, so stop it and run it again:

```bash
docker stop step2
cd ~/Projects/learn/nginx/02-spa
docker run -d --rm --name step2 -p 8080:80 \
  -v "$(pwd)/frontend/dist:/usr/share/nginx/html:ro" \
  -v "$(pwd)/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine
```

### ⚠️ The catch: missing assets return 200 + HTML

```bash
curl -i http://localhost:8080/assets/does-not-exist.js   # → 200 OK, body is index.html!
```

The fallback applies to **every** missing path, including JS, CSS and images. A real-world failure:

1. A user has the app open. Its `index.html` refers to `assets/About-OLD123.js`.
2. A new deploy replaces that file with `About-NEW456.js`.
3. The user navigates, the browser requests the old file, and nginx returns `index.html` with **200**.
4. The browser runs the HTML as JS: `Uncaught SyntaxError: Unexpected token '<'`.

This is confusing because the network tab shows 200 and nothing looks broken. A real 404 would make the problem obvious.

## 2.4 Missing assets → real 404

```nginx
server {
    listen      80;
    server_name localhost;

    root  /usr/share/nginx/html;
    index index.html;

    # Built files: serve the file, or a real 404. Never fall back to index.html.
    location /assets/ {
        try_files $uri =404;
    }

    # Everything else is a React route, so fall back to index.html.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- **Prefix matching:** `/assets/x.js` matches both `/assets/` and `/`. nginx picks the **longest matching prefix**, so the order of the blocks doesn't matter.
- **`=404`** as the last `try_files` option means: if nothing is found, return status 404.
- Apply config changes:

```bash
docker exec step2 nginx -t          # always test first
docker exec step2 nginx -s reload   # apply without downtime
```

- If a reload doesn't pick up the change, the editor may have replaced the file, and a single-file mount keeps the old one. Use `docker restart step2`.

---

# Step 3: Route `/api` to a backend — notes

## 3.1 A small backend

```bash
cd ~/Projects/learn/nginx
mkdir -p 03-api/backend && cd 03-api/backend
npm init -y
npm install express
```

`03-api/backend/server.js`:

```js
const express = require('express')
const app = express()

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend', time: new Date().toISOString() })
})

app.listen(3000, () => console.log('API running on http://localhost:3000'))
```

```bash
node server.js                              # terminal 1 (stays in the foreground)
curl -i http://localhost:3000/api/hello     # terminal 2
```

**Default ports for other backends:** FastAPI/Flask use **8000**/**5000**. Spring Boot uses **8080**, which clashes with nginx on 8080, so change one (e.g. `server.port=3000` in `application.properties`).

**Restarting after closing terminals:** `node server.js` stops when its terminal closes. A container started with `-d` keeps running, so check it with `docker ps`.

## 3.2 Calling the API directly → CORS error

React (`02-spa/frontend/src/App.jsx`) called `fetch('http://localhost:3000/api/hello')`, rebuilt with `npm run build`, served on `localhost:8080`.

**Result:**
- Page: `Error: Failed to fetch`
- Console: `blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`
- Network tab: **CORS error**. The request **did reach** the backend, which answered 200, but the **browser** refused to let JS read the response.

**Why:**
- **Origin = scheme + host + port.** `http://localhost:8080` and `http://localhost:3000` are **different origins**.
- Browsers block JS from reading cross-origin responses unless the server sends `Access-Control-Allow-Origin`.
- CORS is enforced by **browsers only**. curl, Postman and server-to-server calls ignore it, which is why `curl` worked.

**Two ways to fix it:**

| Approach | How |
|----------|-----|
| Add CORS headers in the backend | `app.use(cors())` (Express), `@CrossOrigin` (Spring), `CORSMiddleware` (FastAPI) |
| **Serve frontend + API from one origin via nginx** ✅ | Browser only talks to `localhost:8080`; nginx forwards `/api/*` to the backend. No CORS needed |

## 3.3 Proxy `/api` through nginx → 502

React now calls a **relative URL**: `fetch('/api/hello')`, which goes to the same origin the page came from (nginx on `:8080`).

Added to `02-spa/default.conf`:

```nginx
    # API requests: forward to the backend
    location /api/ {
        proxy_pass http://localhost:3000;
    }
```

- **`proxy_pass`**: don't look for a file. Forward the request to another server and pass its response back. The browser never knows the backend exists. This is a **reverse proxy**.
- Added a request logger to `server.js` to see whether requests arrive.

**Result:** `curl -i http://localhost:8080/api/hello` → **`502 Bad Gateway`**, and **no log line** in the node terminal.

**Why:** inside a container, **`localhost` is the container itself**, not my machine:

```
My machine
├── node server.js  ← listening on port 3000
└── container "step2"
     └── nginx → proxy_pass http://localhost:3000
                  └── looks for port 3000 *inside the container* → nothing there
```

**502 = nginx is fine, but it can't reach the server behind it ("upstream").**

**How to debug a 502:**

```bash
docker logs step2 2>&1 | grep upstream
# connect() failed (111: Connection refused) while connecting to upstream,
# ... upstream: "http://127.0.0.1:3000/api/hello"
```

1. Read the `upstream:` address nginx actually tried.
2. Is the backend running?
3. Can it be reached **from where nginx runs** (container vs host)?

## 3.4 Reach the backend on my machine → ✅ works

`host.docker.internal` is Docker's special hostname for "the machine running Docker". On Linux it must be enabled with `--add-host`.

```nginx
    location /api/ {
        proxy_pass http://host.docker.internal:3000;
    }
```

```bash
docker stop step2
cd ~/Projects/learn/nginx/02-spa
docker run -d --rm --name step2 -p 8080:80 \
  --add-host=host.docker.internal:host-gateway \
  -v "$(pwd)/frontend/dist:/usr/share/nginx/html:ro" \
  -v "$(pwd)/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine

curl -i http://localhost:8080/api/hello    # → 200 + JSON, log line appears in node terminal
```

- `--add-host=host.docker.internal:host-gateway` adds an `/etc/hosts` entry inside the container that points at my machine.
- The browser shows the message with **no CORS error**, even though the backend has **no CORS headers**. The browser only ever talks to `localhost:8080`.

**Mistake I made:** I got a 502 again, because I hadn't actually saved the `proxy_pass` change.

**Debugging habit:** check the config nginx is **actually running**, not what's in the editor:

```bash
docker exec step2 nginx -T | grep proxy_pass
```

If it's still 502:

```bash
docker logs step2 2>&1 | grep upstream               # which address did nginx try?
docker exec step2 getent hosts host.docker.internal  # what does the name resolve to inside the container?
```

## 3.5 Backend in a container too (Docker Compose) → ✅ works

Compose starts several containers together on a shared network where **each service name is a hostname**.

`03-api/default.conf`: same as `02-spa/default.conf`, except:

```nginx
    location /api/ {
        proxy_pass http://backend:3000;    # "backend" = the Compose service name
    }
```

`03-api/docker-compose.yml`:

```yaml
services:
  backend:
    image: node:22-alpine
    working_dir: /app
    volumes:
      - ./backend:/app
    command: node server.js

  web:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    volumes:
      - ../02-spa/frontend/dist:/usr/share/nginx/html:ro
      - ./default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
```

```bash
cd ~/Projects/learn/nginx/03-api
docker compose up -d
docker compose ps          # add -a to also see stopped containers
docker compose logs web    # nginx logs
docker compose logs backend
docker compose down        # stop and remove everything
```

| Part | Meaning |
|------|---------|
| `services:` | Each one becomes a container. The name is also its hostname on the shared network |
| `backend` has **no `ports:`** | Not reachable from my machine, only from other containers (nginx) |
| Relative paths | Relative to the compose file, not the current directory, so no `$(pwd)` gotcha |
| `depends_on` | Start `backend` before `web` |

**Results:**
- `curl -i localhost:8080/api/hello` → **200**. Headers show both layers: `Server: nginx` and `X-Powered-By: Express`.
- `curl localhost:3000/api/hello` → **can't connect**. ✅ Good: nginx is the **single front door**, so anything configured there (rate limits, upload limits, HTTPS) can't be bypassed.
- Backend log still says `running on http://localhost:3000`. "localhost" depends on where you're standing.

### ⚠️ Gotcha: unknown hostname → nginx won't start

I forgot to change `proxy_pass` from `host.docker.internal` (which only existed because of `--add-host`) and got `curl: (7) Couldn't connect to server`.

- nginx **resolves `proxy_pass` hostnames at startup**. If a name doesn't exist, nginx **refuses to start**: the container shows `Exited (1)`.
- `docker compose logs web` → `[emerg] host not found in upstream "host.docker.internal:3000" in /etc/nginx/conf.d/default.conf:15`

| Symptom | Meaning | First thing to check |
|---------|---------|----------------------|
| `502 Bad Gateway` | nginx runs but can't reach the backend | `logs web` → `upstream:` address; is the backend up? |
| `Couldn't connect to server` | **nginx itself isn't running** | `docker compose ps -a`, then `logs web` for `[emerg]` |

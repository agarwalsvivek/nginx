# nginx

A learn-by-building project. Each step lives in its own folder (`01-static/`, `02-locations/`, …) with a `docker-compose.yml`, a commented nginx config, and a short README of things to try.

## Roadmap

| # | What you'll build | Concept |
|---|-------------------|---------|
| 1 | A static site served from a container | `server`, `listen`, `root`, `index` |
| 2 | A site with several routes and custom error pages | `location` matching, `try_files`, `error_page` |
| 3 | nginx in front of a small backend app | Reverse proxy, `proxy_pass`, forwarded headers |
| 4 | Several backend copies sharing the traffic | Load balancing, `upstream`, `least_conn`, `ip_hash` |
| 5 | Faster responses from cached, compressed content | `proxy_cache`, `expires`, gzip |
| 6 | A hammer-it-with-requests test that starts returning 429s | Rate limiting, `limit_req`, `limit_conn` |
| 7 | The site served over HTTPS | TLS, HTTP→HTTPS redirect, HTTP/2 |
| 8 | A tiny chat app working through the proxy | WebSocket proxy, `Upgrade`/`Connection` headers |
| 9 | Custom logs and a debugging workflow | `log_format`, `nginx -t`, reading error logs |

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

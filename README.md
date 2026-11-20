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

# Enable MongoDB replica set on Railway (required for `livedemo-backend`)

The backend uses MongoDB **change streams**, which need a **replica set**.

## Option A — Custom start command (quickest)

1. Open the Railway project **DK-LiveDemo** → service **livedemo-mongo** → **Settings** → **Deploy**.
2. Set **Custom Start Command** to:
   ```text
   mongod --replSet rs0 --bind_ip_all
   ```
3. **Redeploy** the service.
4. One-time init (after the container is up), from a machine with `railway` CLI:
   ```bash
   railway connect livedemo-mongo
   # In mongosh:
   rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "localhost:27017" } ] })
   exit
   ```
   If `localhost` is wrong, use the internal hostname shown in the Railway UI for the mongo pod.

5. **Redeploy** `livedemo-backend` so it connects after `rs0` is primary.

## Option B — Use `mongo/Dockerfile` in this repo

Point the `livedemo-mongo` service at the `mongo/` directory of `Matty-1337/DK-LiveDemo` (GitHub) so it builds from `mongo/Dockerfile` (includes the same `CMD` as Option A). Add the same `rs.initiate` step once.

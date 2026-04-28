# DK-LiveDemo Backend Patch

A one-line fork of `livedemo/livedemo-backend:latest` that replaces the
hardcoded S3 bucket name `livedemo-cdn` (globally taken in S3) with
`dk-livedemo-cdn` (Delta Kinetics-owned).

## Why this exists

The upstream backend hardcodes the S3 bucket in 5 places in
`src/helpers/livedemoHelpers.js` and 5 places in
`src/helpers/flixHelpers.js` (even though credentials are env-driven).
Since `livedemo-cdn` is already taken in the global S3 namespace, DK
can't create that bucket — we must fork the image.

## How to rebuild

```bash
cd backend-patch
docker pull livedemo/livedemo-backend:latest     # refresh upstream
docker build -t dk-livedemo-backend:patched .
./verify.sh dk-livedemo-backend:patched

# Push
echo "$GHCR_TOKEN" | docker login ghcr.io -u Matty-1337 --password-stdin
docker tag dk-livedemo-backend:patched ghcr.io/matty-1337/dk-livedemo-backend:v1
docker tag dk-livedemo-backend:patched ghcr.io/matty-1337/dk-livedemo-backend:latest
docker push ghcr.io/matty-1337/dk-livedemo-backend:v1
docker push ghcr.io/matty-1337/dk-livedemo-backend:latest
```

## When to rebuild

Any time the upstream `livedemo/livedemo-backend:latest` tag moves.
Bump the `v1` tag to `v2` etc. — do **not** push only `:latest`.
Tag `:latest` is for convenience; Railway should pin to a specific
version tag for deploy stability.

## AWS requirements — hand this to Matty when provisioning

### Bucket
- **Name:** `dk-livedemo-cdn`
- **Region:** `us-east-1` (hardcoded in source, cannot be changed without a second patch)
- **Object Ownership:** ACLs enabled (the backend uses `ACL: 'public-read'` per upload)
- **Block Public Access:** uncheck "Block all public access". The image URLs are served at `https://dk-livedemo-cdn.s3.amazonaws.com/story-images/*` and must be publicly GET-able.

### Bucket policy (apply after creation)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadStoryImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::dk-livedemo-cdn/*"
    }
  ]
}
```

### IAM user + policy
Create IAM user `dk-livedemo-backend`. Attach the following policy
(inline or managed):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BackendS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::dk-livedemo-cdn/*"
    }
  ]
}
```

Generate an access key pair for the user. Provide to ops to set in:

- Infisical (project `dk-livedemo`, env `prod`):
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- Railway (service `livedemo-backend`) — same two keys. If the service
  has an Infisical integration that auto-syncs, the Infisical write is
  sufficient; otherwise mirror manually with
  `railway variables --service livedemo-backend --set AWS_ACCESS_KEY_ID=... --set AWS_SECRET_ACCESS_KEY=...`.

### Final sanity

After deploy with the new image + creds:

```bash
railway ssh --service livedemo-backend
grep -c "'dk-livedemo-cdn'" /home/app/src/helpers/livedemoHelpers.js
# expect: 5

# Then run the schema probe to verify screen upload works:
bash scripts/probe-v2.js     # (or via the railway ssh base64 trick)
```

## What the patch does NOT fix

- The CDN hostname in the **frontend** image (`livedemo/livedemo-web-app`)
  may also hardcode `livedemo-cdn.s3.amazonaws.com`. The patched backend
  will write screens to `dk-livedemo-cdn.s3.amazonaws.com`, so if the
  frontend reads `screens.imageUrl` and renders it verbatim we're fine
  — but if it substitutes a hardcoded CDN host, we need a second
  frontend patch. **Verify after first real screen renders.**
- The source repo reference in `package-lock.json` / `pnpm-lock.yaml`
  still contains `livedemo-cdn` in dependency URLs (upstream monorepo
  artifacts). These are not production-critical.

## Tagged image location

`ghcr.io/matty-1337/dk-livedemo-backend:latest` and versioned tags.
Visibility: **public** after first push (set via the GHCR package
settings). If kept private, Railway must be configured with GHCR
registry auth.

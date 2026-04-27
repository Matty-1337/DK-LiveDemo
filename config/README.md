# Catalog source of truth

`products.json` here is the canonical catalog used by `livedemo-mcp`.

It is copied to `mcp/config/products.json` at build time via
`mcp/scripts/copy-catalog.cjs` because Railway's `livedemo-mcp` service
has `rootDirectory = "mcp"`, which excludes repo-root files from the
Docker build context.

When updating the catalog, edit `config/products.json` at the repo root
and run `node mcp/scripts/copy-catalog.cjs` or `cd mcp; npm run build`
to update the MCP copy. Commit both files together.

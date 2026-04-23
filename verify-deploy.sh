#!/usr/bin/env bash
# Verify DK-LiveDemo deployment health.
# Usage: ./verify-deploy.sh [PUBLIC_URL] [MCP_URL]

set -u

PUBLIC_URL="${1:-https://livedemo-proxy-production.up.railway.app}"
MCP_URL="${2:-https://livedemo-mcp-production.up.railway.app}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC}  $1"; }
fail() { echo -e "${RED}FAIL${NC}  $1"; FAILED=1; }
info() { echo -e "${YELLOW}INFO${NC}  $1"; }

FAILED=0

echo "==> Checking public site: $PUBLIC_URL"
HTTP_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_URL" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  pass "public site returned HTTP 200"
else
  fail "public site returned HTTP $HTTP_CODE (expected 200)"
fi

echo "==> Checking MCP health: $MCP_URL/health"
MCP_BODY=$(curl -sk --max-time 10 "$MCP_URL/health" || echo "")
if echo "$MCP_BODY" | grep -q '"status":"ok"'; then
  TOOL_COUNT=$(echo "$MCP_BODY" | sed -n 's/.*"tools":\([0-9]*\).*/\1/p')
  pass "MCP health ok (tools: ${TOOL_COUNT:-?})"
else
  fail "MCP /health did not return status:ok (body: $MCP_BODY)"
fi

echo "==> Backend internal health (run inside Railway shell)"
info "railway run --service livedemo-backend curl -s http://livedemo-backend.railway.internal:3005/health"

echo
if [ "$FAILED" = "0" ]; then
  echo -e "${GREEN}All public checks passed.${NC}"
else
  echo -e "${RED}One or more checks failed.${NC}"
fi

echo
echo "==> Claude Desktop MCP config snippet:"
cat <<EOF
{
  "mcpServers": {
    "livedemo-dk": {
      "url": "$MCP_URL/sse",
      "transport": "sse"
    }
  }
}
EOF

exit $FAILED

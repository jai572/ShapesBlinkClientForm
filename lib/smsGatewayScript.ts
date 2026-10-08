// The script that runs on the salon's Android phone (inside Termux). It is
// served, without any secret in it, from /api/sms/script so setup on the phone
// is one command. The secret key stays in ~/.shapes-sms-key on the phone.
export const GATEWAY_SCRIPT = `#!/data/data/com.termux/files/usr/bin/bash
# Shape Blink & Brow - text-message gateway.
# Asks the portal for the next text, sends it from this phone's SIM, reports
# back, waits a little, repeats. Stop it any time with Ctrl+C.
#
# Needs: pkg install curl jq termux-api   (and SMS permission for Termux:API)

BASE="\${SMS_BASE_URL:-__BASE_URL__}"
KEY="$(tr -d '[:space:]' < "$HOME/.shapes-sms-key" 2>/dev/null)"
DELAY_MIN="\${DELAY_MIN:-10}"
DELAY_MAX="\${DELAY_MAX:-20}"

if [ -z "$KEY" ]; then
  echo "No key found. Save the key from the portal first:"
  echo "  printf '%s' 'PASTE-KEY-HERE' > ~/.shapes-sms-key"
  exit 1
fi

command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
echo "Shape Blink & Brow text gateway started. Leave this open. Ctrl+C to stop."

while true; do
  if ! resp="$(curl -fsS -m 25 -H "Authorization: Bearer $KEY" "$BASE/api/sms/next" 2>/dev/null)"; then
    echo "$(date +%T) cannot reach the portal or the key was rejected; trying again in 30s"
    sleep 30
    continue
  fi

  id="$(jq -r '.message.id // empty' <<<"$resp")"
  if [ -z "$id" ]; then
    wait="$(jq -r '.wait // empty' <<<"$resp")"
    [ "$wait" = "hourly_limit" ] && echo "$(date +%T) hourly limit reached; waiting"
    sleep 15
    continue
  fi

  to="$(jq -r '.message.to' <<<"$resp")"
  body="$(jq -r '.message.body' <<<"$resp")"

  if err="$(termux-sms-send -n "$to" "$body" 2>&1)"; then
    ok=true; err=""
    echo "$(date +%T) sent to \${to:0:7}******"
  else
    ok=false
    echo "$(date +%T) FAILED to send to \${to:0:7}******: $err"
  fi

  payload="$(jq -n --arg id "$id" --argjson ok "$ok" --arg error "$err" '{id:$id, ok:$ok, error:$error}')"
  for attempt in 1 2 3 4 5; do
    curl -fsS -m 25 -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$payload" "$BASE/api/sms/result" >/dev/null 2>&1 && break
    sleep 5
  done

  sleep $(( DELAY_MIN + RANDOM % (DELAY_MAX - DELAY_MIN + 1) ))
done
`;

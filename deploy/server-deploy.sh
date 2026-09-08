#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
revision="${1:?revision required}"
[[ "$revision" =~ ^[a-f0-9]{12,40}(-working-[0-9]+)?$ ]] || exit 2
base=/srv/projects/blog-to-post
data=/srv/data/blog-to-post
release="$base/releases/$revision"
mkdir -p "$base/shared" /srv/backups/blog-to-post "$data"
exec 9>"$base/deploy.lock"
flock -w 1800 9
[[ -s "$base/shared/runtime.env" ]] || { echo 'Provision shared/runtime.env first'; exit 1; }
if [[ -f "$base/shared/deploy.env" ]]; then
  set -a
  source "$base/shared/deploy.env"
  set +a
fi
export BLOG_BIND_IP="${BLOG_BIND_IP:-127.0.0.1}"
export BLOG_PORT="${BLOG_PORT:-18473}"
export BLOG_ENV_FILE="$base/shared/runtime.env" BLOG_DATA_DIR="$data"
export BLOG_IMAGE="blog-to-post:$revision"
export DEPLOY_REVISION="$revision"
previous=$(readlink -f "$base/current" || true)
previous_image=$(cat "$base/shared/current-image" 2>/dev/null || true)
cd "$release"
docker build --label "org.opencontainers.image.revision=$revision" -t "$BLOG_IMAGE" .
backup="/srv/backups/blog-to-post/$(date -u +%Y%m%dT%H%M%SZ)-$revision.tar.gz"
snapshot_ready=false
restore_previous() {
  trap - ERR
  echo 'Deployment failed; restoring the previous data snapshot and image'
  docker compose -f "$release/compose.yaml" down --timeout 300 || true
  if [[ "$snapshot_ready" == true ]]; then
    # Retain failed state for diagnosis; never delete user data on rollback.
    mv "$data" "$data.failed-$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p "$data"
    tar -xzf "$backup" -C "$data"
  fi
  if [[ -n "$previous_image" && -f "$previous/compose.yaml" ]]; then
    export BLOG_IMAGE="$previous_image"
    export DEPLOY_REVISION="$(basename "$previous")"
    docker compose -f "$previous/compose.yaml" up -d --no-build --wait --wait-timeout 120 || true
  fi
  exit 1
}
if [[ -n "$previous_image" && -f "$previous/compose.yaml" ]]; then
  BLOG_IMAGE="$previous_image" docker compose -f "$previous/compose.yaml" stop --timeout 300
fi
trap restore_previous ERR
tar -czf "$backup.partial" -C "$data" .
mv "$backup.partial" "$backup"
snapshot_ready=true
docker compose -f "$release/compose.yaml" up -d --no-build --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 15 "http://${BLOG_BIND_IP:-127.0.0.1}:${BLOG_PORT:-18473}/__health"
ln -sfn "$release" "$base/current"
printf '%s\n' "$BLOG_IMAGE" > "$base/shared/current-image"
printf '%s\n' "$revision" > "$base/shared/current-revision"
trap - ERR
echo "Deployment healthy: $revision"

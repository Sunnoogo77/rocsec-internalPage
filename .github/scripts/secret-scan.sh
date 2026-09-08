#!/usr/bin/env bash
set -euo pipefail
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT
curl --fail --silent --show-error --location https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz -o "$scan_dir/gitleaks.tar.gz"
( cd "$scan_dir"; echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  gitleaks.tar.gz" | sha256sum --check --status; tar -xzf gitleaks.tar.gz gitleaks )
"$scan_dir/gitleaks" git --redact --no-banner --log-opts="--all"

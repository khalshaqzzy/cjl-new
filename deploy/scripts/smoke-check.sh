#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 1 ]]; then
  echo "Provide one or more URLs to smoke-check." >&2
  exit 1
fi

for url in "$@"; do
  echo "Checking ${url}"
  curl --fail --silent --show-error --location --retry 12 --retry-delay 5 --retry-connrefused "${url}" > /dev/null
done

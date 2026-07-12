#!/bin/sh
set -eu

cd /opt/lingban

exec node app/run-worker/dist/daemon.js

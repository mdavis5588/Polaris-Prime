#!/bin/sh
# Runs on every container start (not just image build) so a fresh deploy
# always migrates first and rebuilds the WhiteNoise static manifest
# against whatever code is actually running — no separate "release" step
# to remember for a simple single-VM setup.
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3

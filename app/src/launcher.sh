#!/usr/bin/env bash
BASEDIR=$(dirname $0)
PATH=/usr/local/bin:$PATH
AVAHI_COMPAT_NOWARN=1 node $BASEDIR/app.js

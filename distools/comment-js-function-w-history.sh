#!/bin/bash

# note: this should be called after the non-history version.
#cgpt -b googleai -m gemini-2.0-pro-exp-02-05 -I .h-comment-js-fns -O .h-comment-js-fns
cgpt -b googleai -m gemini-2.0-flash -I .h-comment-js-fns -O .h-comment-js-fns

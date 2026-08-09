#!/bin/sh
# 커피 내기 연출 검증. 실제 소스(CoffeeSpin.swift)를 그대로 링크해 돌린다.
set -e
cd "$(dirname "$0")"
out=$(mktemp -d)
swiftc -O ../Sources/SKonnection/Features/Coffee/CoffeeSpin.swift main.swift -o "$out/spincheck"
"$out/spincheck"
rm -rf "$out"

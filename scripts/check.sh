#!/usr/bin/env bash
# 検証の門。人もAIもCIも、この1コマンドを通す。
# 技術スタック未確定のため、リポジトリ直下のファイルを検出して該当するチェックだけ実行する。
# スタック確定後は、この中身を実際の lint・型チェック・テストに書き換える。
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

step() { printf '\n==> %s\n' "$1"; }

step "機密情報がコミットされていないか"
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'; then
  echo "エラー: .env がコミットされています。削除して、中のAPIキーは再発行してください。" >&2
  exit 1
fi
if git ls-files | grep -E '(-key\.json|^service-account.*\.json|^credentials.*\.json)$'; then
  echo "エラー: 認証情報のファイルがコミットされています。" >&2
  exit 1
fi

if [ -f package.json ]; then
  step "Node.js"
  if [ ! -d node_modules ]; then
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
  fi
  npm run lint --if-present
  npm run typecheck --if-present
  npm run build --if-present
  npm test --if-present
fi

if [ -f requirements.txt ] || [ -f pyproject.toml ]; then
  step "Python"
  if command -v ruff >/dev/null 2>&1; then
    ruff check .
  else
    echo "ruff が未インストールのためスキップ（pip install ruff）"
  fi
  if command -v pytest >/dev/null 2>&1; then
    # テストが1つもない場合（終了コード5）は成功扱い
    pytest || [ $? -eq 5 ]
  else
    echo "pytest が未インストールのためスキップ（pip install pytest）"
  fi
fi

if [ -f go.mod ]; then
  step "Go"
  go vet ./...
  go build ./...
  go test ./...
fi

if [ -f pubspec.yaml ]; then
  step "Flutter"
  if command -v flutter >/dev/null 2>&1; then
    flutter pub get
    flutter analyze
    if [ -d test ]; then flutter test; fi
  else
    echo "flutter が未インストールのためスキップ"
  fi
fi

printf '\n==> check: すべて通りました\n'

# STATUS — プロジェクトの今の真実

このファイルは Mac 側の worker（Claude Code / Codex CLI）が書く。
「今どうなっているか」が一目で分かるように、常に最新に保つ。
チャット側の Claude はこれを読んで、ゆらに報告する。

- 最終更新: 2026-09-24 08:03
- 見張り状態: 配線作業中（bridge-watch.sh を bridge/bin/ に設置。常駐化は launchd 登録待ち）

## 直近の指示への実行結果
- [2026-09-24-003] 実行中 — 対象=company-os / 内容: 疎通テスト3回目（ログイン完了後）。`bridge/PING.md` を作成し、`pong <実行日時>` を 1 行書いてコミットする。他のファイルには触らない。
- [2026-09-24-002] 要承認 — 自動実行が途中で止まりました（rc=1）。人の確認が必要です。Failed to authenticate: OAuth session expired and could not be refreshed
- [2026-09-24-002] 実行中 — 対象=company-os / 内容: 疎通テスト2回目（再ログイン後）。`bridge/PING.md` を作成し、`pong <実行日時>` を 1 行書いてコミットする。他のファイルには触らない。
- [2026-09-24-001] 要承認 — 自動実行が途中で止まりました（rc=1）。人の確認が必要です。Failed to authenticate: OAuth session expired and could not be refreshed
- [2026-09-24-001] 実行中 — 対象=company-os / 内容: 疎通テスト。`bridge/PING.md` を作成し、`pong <実行日時>` を 1 行書いてコミットする。他のファイルには触らない。

## 完成済み機能
- bridge/ 書式一式の移植（claude-bridge 実証版と互換）
- 書式セルフテスト（tools/test_bridge_format.py）

## 進行中
- なし

## 未着手
- Mac 側 watcher の company-os への配線（bridge-watch.sh の対象リポジトリ設定 or launchd 登録）
- 最初の実指示（2026-09-24-001 PING）の worker 実行

## 直近の変更
- 2026-09-24 bridge/ を company-os に新設（Windows 脳セッションから）

## 既知の問題
- 特になし

## 数値ステータス
- 処理した指示: 0 件
- 要承認になった指示: 0 件

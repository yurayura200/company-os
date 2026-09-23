# STATUS — プロジェクトの今の真実

このファイルは Mac 側の worker（Claude Code / Codex CLI）が書く。
「今どうなっているか」が一目で分かるように、常に最新に保つ。
チャット側の Claude はこれを読んで、ゆらに報告する。

- 最終更新: 2026-09-24 (Windows 脳側で初期化)
- 見張り状態: 未接続（watcher 未配線。SSH 直結ルートのみ稼働中）

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

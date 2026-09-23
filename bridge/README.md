# bridge/ — Windows 脳 ↔ Mac 手足 の指示リレー

company-os を「脳の記憶」とし、Windows 側のチャット（Claude）と Mac 側の worker（Claude Code / Codex CLI）が
このフォルダを介して仕事を受け渡す。書式は 2026-06-11 に動作実証済みの `Projects/claude-bridge`
（テスト 3/3 成功、文字化け・誤実行対策済み）をそのまま移植したもの。

## 構成

| ファイル | 書き手 | 役割 |
|---|---|---|
| `INSTRUCTIONS.md` | 脳（チャット側 Claude） | 指示を末尾に追記する。上は消さない |
| `STATUS.md` | Mac 側 worker | 今の真実。実行結果・稼働状態を常に最新化 |
| `tools/test_bridge_format.py` | - | 書式のセルフテスト（unittest） |

## 運用ルート

1. **ファイルリレー（非同期・監査可能）**: 脳が INSTRUCTIONS.md に追記 → push → Mac 側 worker が pull して未処理の指示を上から実行 → STATUS.md 更新 → commit & push。
2. **SSH 直結（即時）**: Windows から `ssh -i ~/.ssh/id_isekai_mac yura@<MacのIP>` で直接コマンド実行。IP は DHCP で変動するため、接続不能時は LAN スキャンで再特定する（手順は Windows 側ローカルの `.claude/app-dev-decisions.md` に記録。このファイルはリポジトリには含まれない）。

## 安全ゲート（claude-bridge から継承）

- 削除・本番公開・課金・認証に触れる指示は自動実行せず `要承認` に止めて人の許可を待つ。
- ひな形（コードブロック内）の指示は実行対象にしない。
- 秘密（鍵・トークン・口座識別子）はこのリポジトリに書かない。

## 現在の配線状態

- SSH 直結: 稼働中（2026-09-24 実測）
- Mac 側 watcher 常駐: 未接続（`Projects/claude-bridge/bin/bridge-watch.sh` を company-os 向けに設定するか、launchd 登録が必要）

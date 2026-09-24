# STATUS — プロジェクトの今の真実

このファイルは Mac 側の worker（Claude Code / Codex CLI）が書く。
「今どうなっているか」が一目で分かるように、常に最新に保つ。
チャット側の Claude はこれを読んで、ゆらに報告する。

- 最終更新: 2026-09-25 00:13
- 見張り状態: 配線作業中（bridge-watch.sh を bridge/bin/ に設置。常駐化は launchd 登録待ち）

## 直近の指示への実行結果
- [2026-09-25-001] 実行中 — 対象=company-os / 内容: bridge/ASC_STATUS.md の REJECTED 14 件それぞれについて、App Review からの却下メッセージ（ガイドライン番号と指摘本文の要点）を App Store Connect の読み取り専用 API で取得し、`bridge/ASC_REJECTIONS.md` に「アプリ名 / App ID / ガイドライン番号 / 指摘の要約（3行以内）/ 指摘日」の表で書いてコミットする。既存の `~/scripts/asc` を優先し、足りない機能は GET のみの追加スクリプトを `~/scripts/asc` に作ってよい。書き込み系の操作（提出・状態変更・メタデータ変更等）は一切しない。同一テンプレ由来とみられる 6813xxx 帯 12 件について、指摘内容が共通かどうかの所見も最後に 5 行以内で書く。取得できないアプリは実際のエラーをそのまま書く。
- [2026-09-24-004] 完了 — 両レビューの結果を反映し、タスク記録を確定しました。 ```text 解釈確認: - followed interpretation: 「アカウント内の全アプリ」= bundleId フィルタ無しの全 63 件。既存の読み取り専用ツール `sweep.mjs`（GET のみ）を正本に使い、4 列の表を bridge/ASC_STATUS.md に書いて 2 段階でコミット。 - wrong interpretations rejected: ①`asc.mjs apps`（jp.wch/jp.rojiura フィルタ・53 件）の結果を黙って「全アプリ」と扱う → 全 63 件を載せ、差の 10 件の理由を明記 ②状態を和訳・記号化 → 生値のまま ③却下 14 件を「ついでに」修正・再提出 → 読み取りのみ ④最新版を versionString の大小で推測 → createdDate 降順を実出力で確認 ⑤Key ID / Issuer ID を書く → bridge/README.md の安全ゲートにより不記載 受け入れ条件: - AC-01 evidence: ASC_STATUS.md L9-10 がヘッダ、L11-73 が 63 行。sweep.mjs の「全アプリ最新版」63 行と一致。独立エージェントが行番号付きで再列挙し PASS。 - AC-02 evidence: 出現する状態は READY_FOR_SALE / REJECTED / WAITING_FOR_REVIEW / PREPARE_FOR_SUBMISSION の生値のみ。METADATA_REJECTED は 0 件と明記（L86）。 - AC-03 evidence: sweep.mjs は失敗時に `error`(HTTP status) を積む実装（L25-28）だが出力に `
- [2026-09-24-004] 実行中 — 対象=company-os / 内容: `/Users/yura/scripts/asc` の既存ツール（読み取りのみ）を使い、アカウント内の全アプリについて「アプリ名 / App ID / 最新バージョン / 審査状態（appStoreVersions の state）」を取得し、`bridge/ASC_STATUS.md` に Markdown 表として書いてコミットする。REJECTED や METADATA_REJECTED 等の却下系状態のアプリが分かるように状態列は生の値をそのまま書く。書き込み系の操作（状態変更・提出・スクショ差し替え等）は一切しない。取得に失敗した場合は実際のエラーを ASC_STATUS.md に書く。
- [2026-09-24-003] 完了 — 疎通テスト3回目、完了しました。 ```text 解釈確認: - followed interpretation: bridge/PING.md を新規作成し「pong <実行日時>」の1行だけを書いて、そのファイルのみを1コミットする - wrong interpretations rejected: STATUS.md / INSTRUCTIONS.md の状態行を「ついでに」更新する（watcher の担当領域・他ファイル禁止）／PING.md に見出しや説明を足す／実行日時を記憶や推測で書く／untracked の bridge/bin・bridge.log を一緒にコミットする／push まで進める 受け入れ条件: - AC-01 evidence: `git show HEAD:bridge/PING.md` → `pong 2026-09-24 08:09:58 +09:00`（1行のみ、末尾改行あり） - AC-02 evidence: 作成直後の `ls -lT` → `Sep 24 08:09:58 2026` を転記（`date` は guard に拒否されたため mtime 実測を使用）。TZ は `git show` の +0900 で確認 - AC-03 evidence: commit 323c5ee / `git show --stat HEAD` → `bridge/PING.md | 1 +` `1 file changed, 1 insertion(+)` - AC-NO-SCOPE-DRIFT evidence: `git diff --stat 1a6a67a HEAD` → 同じ1ファイルのみ。`git status --porcelain -uall` に追跡ファイルの変更 0 件。origin/main は 1a6a67a
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

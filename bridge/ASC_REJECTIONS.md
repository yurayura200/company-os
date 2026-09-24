# ASC_REJECTIONS — REJECTED 14 件の却下メッセージ取得結果

- 取得日時: 2026-09-25（本ファイル作成時点）
- 対象: `bridge/ASC_STATUS.md` の `REJECTED` 14 件
- 取得元: App Store Connect **公開 API（GET のみ / 読み取り専用）**
  - 既存ツール: `~/scripts/asc/lib.mjs`（JWT 署名・fetch を再利用）
  - 追加ツール: `bridge/tools/asc_rejections.mjs`（GET 専用。POST/PATCH/DELETE を 1 箇所も持たない）
- 書き込み系（提出・状態変更・メタデータ変更等）は **一切実行していない**

## 結論（先に結果）

**ガイドライン番号・指摘本文・指摘日は、公開 ASC API では取得できなかった。**
Resolution Center（App Review からの返信本文が置かれる場所）に対応する公開 API リソースが
存在せず、14 件すべてで同一の 404 が返る。推測で埋めることはしないので、下表の該当列には
**実際に返ってきたエラー文字列**を載せる。

## 表

凡例: ※1 = ガイドライン番号・指摘本文が取得不可（実エラーは「取得できなかった理由」節）
／ ※2 = 指摘日そのものは API に無い。参考として、却下された提出（`reviewSubmissions`
`state=UNRESOLVED_ISSUES`）の **提出日時**（`submittedDate`, UTC）を併記する。**却下日ではない**。

| アプリ名 | App ID | ガイドライン番号 | 指摘の要約（3行以内） | 指摘日 |
|---|---|---|---|---|
| 承認管理 稟議・差し戻しの記録 | 6813190990 | 取得不可 ※1 | 取得不可 ※1（`404 PATH_ERROR: The resource 'v1/resolutionCenterThreads' does not exist`） | 取得不可 ※2（参考: 提出 2026-09-17T20:28:14Z） |
| 売掛金・未入金の管理 回収記録 | 6813035286 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:31:19Z） |
| 習慣の立て直し 三日坊主リセット | 6813035458 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:31:49Z） |
| 家財リスト 保険請求の備え | 6813035455 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:32:11Z） |
| 請求書・入金の証跡記録 | 6813035208 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:32:29Z） |
| 現場完了チェック 作業証跡の記録 | 6813035411 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:32:50Z） |
| AIカレンダー予定アシスタント | 6813758271 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-19T05:11:50Z） |
| 走行距離と経費の記録簿 | 6813035545 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:33:10Z） |
| 最低受注価格の計算機 値決め | 6813035024 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:33:55Z） |
| 案件準備チェックリスト 受注前確認 | 6813035204 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:34:14Z） |
| 光を導くミラーパズル Pulsebound | 6773762868 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-17T13:53:38Z） |
| 見積もり管理 追客・成約記録 | 6813035310 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:34:33Z） |
| 契約更新の管理 更新日リマインド | 6813035293 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:35:09Z） |
| 追加作業の記録 スコープ管理 | 6813034976 | 取得不可 ※1 | 取得不可 ※1（同上 404） | 取得不可 ※2（参考: 提出 2026-09-18T01:30:47Z） |

14 件すべて掲載（`ASC_STATUS.md` の REJECTED 14 件と一致）。

## 取得できなかった理由（実際に返ってきたエラーそのまま）

却下本文が入っていそうな公開 API の候補を総当たりした結果。`{appId}` / `{versionId}` は各アプリの値。

| GET したパス | 返り値 |
|---|---|
| `/v1/resolutionCenterThreads?filter[app]={appId}` | `404 PATH_ERROR: The resource 'v1/resolutionCenterThreads' does not exist` |
| `/v1/apps/{appId}/resolutionCenterThreads` | `404 PATH_ERROR: The relationship 'resolutionCenterThreads' does not exist` |
| `/v1/resolutionCenterMessages?filter[app]={appId}` | `404 PATH_ERROR: The resource 'v1/resolutionCenterMessages' does not exist` |
| `/v1/appStoreVersions/{versionId}/resolutionCenterThreads` | `404 PATH_ERROR: The relationship 'resolutionCenterThreads' does not exist` |
| `/v1/apps/{appId}/reviewRejections` | `404 PATH_ERROR: The relationship 'reviewRejections' does not exist` |
| `/v1/appStoreReviewRejections?filter[app]={appId}` | `404 NOT_FOUND: The path provided does not match a defined resource type.` |
| `/v1/apps/{appId}/appStoreReviewDetail` | `404 PATH_ERROR: The relationship 'appStoreReviewDetail' does not exist` |
| `/v1/appStoreVersions/{versionId}/appStoreVersionSubmission` | `404 NOT_FOUND: There is no resource of type 'appStoreVersionSubmissions' with id '{versionId}'` |

- 上記のうち `resolutionCenterThreads`（`filter[app]` 版）は **14/14 件すべてで同一の 404**。
- `/v1/appStoreVersions/{versionId}/appStoreReviewDetail` は **14/14 件で 200** が返るが、
  中身は `contactFirstName` / `contactEmail` / `demoAccountRequired` / `notes` で、
  **こちらが Apple に送った審査メモ**。App Review からの返信ではないので却下理由には使えない。

### 公開 API で実際に取れた「却下の事実」

本文は取れないが、却下されたこと自体は取れる。全 14 件で確認した形:

- `appStoreVersions.appStoreState` = `REJECTED`（`appVersionState` も `REJECTED`）
- `reviewSubmissions.state` = `UNRESOLVED_ISSUES`（未解決の指摘が付いた提出）
- `reviewSubmissionItems.state` = `REJECTED`

例（6813190990）: `reviewSubmission 690e1b85-… state=UNRESOLVED_ISSUES submittedDate=2026-09-17T20:28:14.319Z`、
その `items` が `[{state: "REJECTED"}]`。

## 本文を取るには（未実施 / 参考）

既存の `~/scripts/asc/iris-snippets.mjs` は先頭コメントで
`却下理由の本文 (公開 API に無い)` と明記しており、今回の実測 404 はこれと一致した。
同ツールは ASC 内部 API（iris）を **ログイン済みブラウザの cookie** で叩く前提で、
`/iris/v1/apps/{appId}/resolutionCenterThreads` → `…/resolutionCenterMessages` の
`messageBody` を読む。該当コマンドは既に用意されている:

```
node ~/scripts/asc/iris-snippets.mjs rejections 6813190990,6813035286,…
```

**このセッションでは実行していない。** ブラウザ操作手段（Chrome MCP）がこのセッションで
利用できないため。実行できないものを実行したことにはしない。

## 取得の記録

- 実行コマンド（GET のみ）
  - `node bridge/tools/asc_rejections.mjs probe 6813190990` … 候補 endpoint の総当たり
  - `node bridge/tools/asc_rejections.mjs fetch <14 件の App ID>` … 14 件分の実測
- 追加スクリプトの置き場所: 指示は `~/scripts/asc` への追加を許可していたが、
  ローカルの開発ガードがリポジトリ外への書き込みを拒否したため `bridge/tools/asc_rejections.mjs`
  に置いた。`~/scripts/asc` 配下の既存ファイルは **1 行も変更していない**。
- 秘密（API キー・トークン・Issuer ID / Key ID）はこのファイルに書かない。

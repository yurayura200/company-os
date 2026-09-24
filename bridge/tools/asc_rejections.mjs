#!/usr/bin/env node
// 却下(REJECTED)アプリについて「公開 ASC API で却下メッセージがどこまで取れるか」を実測する
// 読み取り専用ツール。GET しか発行しない (POST/PATCH/DELETE は 1 箇所も無い)。
//
//   node bridge/tools/asc_rejections.mjs probe <appId>   … 候補 endpoint を総当たりし status と生本文を出す
//   node bridge/tools/asc_rejections.mjs fetch <id,id,…> … 複数アプリ分を JSON で出す (表の材料)
//
// 背景: ~/scripts/asc/iris-snippets.mjs の注記は「却下理由の本文は公開 API に無い」と言うが、
// 注記や記憶を根拠にせず、実際に GET して返ってきた status / errors を証跡として残すために作った。
// 既存 sweep.mjs / asc.mjs には却下本文を取る機能が無いので GET 専用の追加分として置く。
// 共通部品 (JWT 署名 / fetch / リトライ) は既存の ~/scripts/asc/lib.mjs をそのまま再利用する。
//
// 置き場所について: 指示は ~/scripts/asc への追加を許したが、app-dev-guard がリポジトリ外への
// 書き込みを拒否するため repo 内に置いた。~/scripts/asc 配下のファイルは一切変更していない。

import { api } from '/Users/yura/scripts/asc/lib.mjs';

const REJECTED_STATES = new Set(['REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'DEVELOPER_REJECTED']);

const [kind, arg] = process.argv.slice(2);

const errText = (r) => {
  const errs = r.body?.errors;
  if (Array.isArray(errs)) return errs.map((e) => `${e.status} ${e.code}: ${e.detail}`).join(' / ');
  if (typeof r.body === 'string') return r.body.slice(0, 300);
  return '';
};

async function get(path) {
  const r = await api('GET', path);
  return { path, status: r.status, error: r.status >= 400 ? errText(r) : null, body: r.body };
}

async function appMeta(id) {
  const r = await get(`/v1/apps/${id}?fields[apps]=name,bundleId`);
  return {
    name: r.body?.data?.attributes?.name ?? null,
    bundleId: r.body?.data?.attributes?.bundleId ?? null,
    status: r.status,
    error: r.error,
  };
}

async function rejectedVersion(id) {
  const r = await get(
    `/v1/apps/${id}/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState,createdDate`,
  );
  if (r.status >= 400) return { status: r.status, error: r.error, version: null, all: [] };
  const list = (r.body?.data ?? []).map((v) => ({ id: v.id, ...v.attributes }));
  return {
    status: r.status,
    error: null,
    version: list.find((v) => REJECTED_STATES.has(v.appStoreState)) ?? list[0] ?? null,
    all: list,
  };
}

// 却下本文が入っていそうな公開 API の候補を総当たりする。
function candidatePaths(appId, versionId) {
  const p = [
    `/v1/reviewSubmissions?filter[app]=${appId}&limit=20`,
    `/v1/apps/${appId}/reviewSubmissions?limit=20`,
    `/v1/resolutionCenterThreads?filter[app]=${appId}&limit=20`,
    `/v1/apps/${appId}/resolutionCenterThreads?limit=20`,
    `/v1/resolutionCenterMessages?filter[app]=${appId}&limit=20`,
    `/v1/apps/${appId}/appStoreReviewDetail`,
    `/v1/apps/${appId}/reviewRejections?limit=20`,
    `/v1/appStoreReviewRejections?filter[app]=${appId}&limit=20`,
  ];
  if (versionId) {
    p.push(
      `/v1/appStoreVersions/${versionId}/appStoreReviewDetail`,
      `/v1/appStoreVersions/${versionId}/appStoreVersionSubmission`,
      `/v1/appStoreVersions/${versionId}?include=appStoreReviewDetail`,
      `/v1/appStoreVersions/${versionId}/resolutionCenterThreads?limit=20`,
    );
  }
  return p;
}

async function cmdProbe(appId) {
  if (!/^\d+$/.test(appId ?? '')) die('usage: asc_rejections.mjs probe <appId>');
  const meta = await appMeta(appId);
  console.log(`# app ${appId} ${meta.name ?? `(名前取得失敗: ${meta.status} ${meta.error})`}`);
  const rv = await rejectedVersion(appId);
  console.log(`# versions -> ${rv.status} ${rv.error ?? ''}`);
  console.log(`# 対象版: ${JSON.stringify(rv.version)}`);
  console.log('');

  for (const path of candidatePaths(appId, rv.version?.id)) {
    const r = await get(path);
    console.log(`---- GET ${path}`);
    console.log(`     status: ${r.status}`);
    if (r.error) console.log(`     error : ${r.error}`);
    else console.log(`     body  : ${JSON.stringify(r.body).slice(0, 1500)}`);
  }

  // 提出物があれば中身 (items / 生の attributes) まで 1 段掘る。
  const subs = await get(`/v1/reviewSubmissions?filter[app]=${appId}&limit=20`);
  for (const s of subs.body?.data ?? []) {
    console.log(`---- reviewSubmission ${s.id} attributes: ${JSON.stringify(s.attributes)}`);
    const items = await get(`/v1/reviewSubmissions/${s.id}/items?limit=50`);
    console.log(`     items -> ${items.status} ${items.error ?? JSON.stringify(items.body?.data ?? []).slice(0, 800)}`);
  }
}

async function cmdFetch(ids) {
  const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length || list.some((s) => !/^\d+$/.test(s))) die('usage: asc_rejections.mjs fetch <id,id,…>');

  const out = [];
  for (const appId of list) {
    const meta = await appMeta(appId);
    const rv = await rejectedVersion(appId);
    const row = {
      appId,
      name: meta.name,
      nameError: meta.status >= 400 ? `${meta.status} ${meta.error}` : null,
      bundleId: meta.bundleId,
      version: rv.version?.versionString ?? null,
      appStoreState: rv.version?.appStoreState ?? null,
      versionCreatedDate: rv.version?.createdDate ?? null,
      versionsError: rv.error ? `${rv.status} ${rv.error}` : null,
      attempts: {},
      reviewSubmissions: [],
    };

    for (const path of [
      `/v1/resolutionCenterThreads?filter[app]=${appId}&limit=20`,
      `/v1/apps/${appId}/resolutionCenterThreads?limit=20`,
      ...(rv.version?.id
        ? [
            `/v1/appStoreVersions/${rv.version.id}/appStoreReviewDetail`,
            `/v1/appStoreVersions/${rv.version.id}/appStoreVersionSubmission`,
          ]
        : []),
    ]) {
      const r = await get(path);
      row.attempts[path] =
        r.status >= 400 ? `${r.status} ${r.error}` : `${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
    }

    const subs = await get(`/v1/reviewSubmissions?filter[app]=${appId}&limit=20`);
    if (subs.status >= 400) {
      row.reviewSubmissionsError = `${subs.status} ${subs.error}`;
    } else {
      for (const s of subs.body?.data ?? []) row.reviewSubmissions.push({ id: s.id, ...s.attributes });
    }
    out.push(row);
    console.error(`fetched ${out.length}/${list.length} (${appId})`);
  }
  console.log(JSON.stringify(out, null, 2));
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (kind === 'probe') await cmdProbe(arg);
else if (kind === 'fetch') await cmdFetch(arg);
else die('usage: asc_rejections.mjs <probe|fetch> <appId|id,id,…>');

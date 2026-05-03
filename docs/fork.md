# Fork の変更点 (`Soli0222/summaly` vs `misskey-dev/summaly`)

このドキュメントは、本フォーク (`origin: Soli0222/summaly`) が upstream
(`misskey-dev/summaly`) に対してどのような変更を加えているかをまとめたものです。

## 比較基準

upstream の最新 `master` ではなく、本フォークが現在取り込んでいる upstream の
最終時点を基準にしています。

- 比較ベース: `fce03eb` (`Release 5.2.3 (#51)`) — `git merge-base HEAD upstream/master` の結果
- まだ取り込んでいない upstream 側の差分 (`a7330a0..99b5ac2`) は本ドキュメントの
  対象外。これらの未取り込み分の概要は最後の章「未取り込みの upstream 変更」を参照。

したがって以下に挙げる差分は、本フォークが独自に加えた変更そのものです。

---

## 1. 配布形態・パッケージング

### 自前 Docker イメージ配布へ移行
- `.github/workflows/npm-publish.yml` を削除し、npm への公開を廃止。
- 代わりに `.github/workflows/docker.yml` を追加。`release: published` および
  `workflow_dispatch` をトリガに、`ghcr.io/<owner>/<repo>` に対して
  `linux/amd64` (`ubuntu-latest`) / `linux/arm64` (`ubuntu-24.04-arm`) の
  マルチプラットフォームイメージを digest 分散ビルド + manifest マージ方式で push する。
  キャッシュは `type=gha`。
- ルートに `Dockerfile` を追加。`node:24.15.0-alpine3.22` ベース、
  `pnpm install --frozen-lockfile` → `pnpm run build` → `pnpm run serve`、`EXPOSE 3000`。

### バージョン系列
- `package.json` の `version` を `5.2.3` から `5.2.3-psr.4.0` というフォーク独自系列に変更。
  `name` は `@misskey-dev/summaly` のまま (npm publish しない前提なので衝突しない)。
- `packageManager` を `pnpm@9.12.3` → `pnpm@10.33.2`。

### 依存追加
- `dependencies` に `pino` (`^10.3.1`) を追加。
- `devDependencies` に `pino-pretty` (`^13.1.3`) を追加。
- `iconv-lite` を `0.6.3` → `0.7.2`、`got` を `^14.4.7` → `^14.6.6`、
  `cheerio` を `1.1.0` → `1.2.0` などに更新 (Renovate 経由)。

---

## 2. アプリケーションサーバー機能の拡張

`src/index.ts` の Fastify プラグインに以下を追加。

### リクエスト/レスポンスロギング (pino)
- `src/utils/logger.ts` を新規追加。`pino` を使い、`LOG_LEVEL` (デフォルト `info`)、
  `NODE_ENV !== 'production'` 時は `pino-pretty` で整形出力。
- `FastifyRequest` を module augmentation で拡張し、`requestId: string`,
  `startTime: number` を追加。
- Fastify に `preHandler` / `onSend` フックを追加し、リクエストごとに
  `crypto.randomUUID()` で `requestId` を採番。受信したリクエスト
  (method, url, query, userAgent, ip) と送信レスポンス (statusCode, responseTime)
  を構造化ログで出力。
- `SummalyOptions` および `GeneralScrapingOptions` に `requestId?: string` を追加。
- `summary` 関数本体および `src/general.ts` の `general` 関数に try/catch を入れ、
  - OGP 取得開始 / 成功 (`statusCode`, `content-type`, `content-length`) / 失敗
  - サマリ生成失敗 / 例外送出
  
  をすべて `requestId` 付きで `logger.info` / `logger.error` する。
- README に Logging セクションを追加 (`LOG_LEVEL` / `NODE_ENV` の説明とログ出力例)。

### `/health` エンドポイント
- `GET /health` を追加。`{ status: 'ok', timestamp: ISO8601 }` を 200 で返す。

### エラーレスポンスの整形
- `GET /` で 500 を返す際のボディを `{ error: e }` から
  `{ error: { message, name } }` へ変更。スタックトレースは
  サーバ側ログにのみ出力するように切り分け。

### `followRedirects` デフォルトの取り扱い変更
- upstream は `GET /` のハンドラ内で `followRedirects: false` を
  options より前に強制していたが、本フォークでは
  ```ts
  await summaly(url, { lang, ...options, requestId });
  ```
  の形に変更し、呼び出し側 `options` で挙動を制御できるようにした。

---

## 3. プラグイン

### ニコニコ動画プラグインの追加
- `src/plugins/niconico.ts` を新規追加し、`src/plugins/index.ts` に登録。
- `nicovideo.jp` / `www.nicovideo.jp` を対象とする。
- 通常の取得が `StatusError` (例えば年齢確認やログイン要求などで取得不可) を
  返した場合、`www.nicozon.net` に hostname を差し替えて再取得を試みる。
- 再取得が成功した場合は、結果を `parseGeneral` に通したうえで
  - `icon`: `https://resource.video.nimg.jp/web/images/favicon/favicon.ico` (公式)
  - `player.url`: `https://embed.nicovideo.jp/watch/<videoId>?autoplay=1` (640x360)
  - `sitename`: `ニコニコ動画`
  
  に上書きして返す。再取得も失敗した場合は `null`。

---

## 4. 取得層 (`src/utils/got.ts`) の拡張

- `DEFAULT_RESPONSE_TIMEOUT` / `DEFAULT_OPERATION_TIMEOUT` を環境変数
  `SUMMALY_RESPONSE_TIMEOUT` / `SUMMALY_OPERATION_TIMEOUT` (ms / 整数) で
  上書きできるように変更。未設定時は従来通り 20s / 60s。

その他 `got.ts` の挙動 (`got@14` 系利用、`PrivateIp` ベースのプライベート IP 拒否、
`req.cancel` ベースのストリーム中断、`package.json` 実行時読み込みでの
`DEFAULT_BOT_UA` 構成、など) は upstream 5.2.3 時点で既に同一で、フォークの
独自変更ではない。

---

## 5. CI / リポジトリ運用

### GitHub Actions
- `lint.yml` / `test.yml`:
  - Node を `22.20.0` → `24.15.0`。
  - `actions/checkout` を `v4` → `v6.0.2`。
  - `pnpm/action-setup` を `v2` → `v6.0.5` (`version: 10.33.2` を明示)。
  - `actions/setup-node` を `v4` → `v6.4.0`。
- `.github/workflows/lint-gha-workflows.yaml` を新規追加し、
  [actionlint](https://github.com/rhysd/actionlint) でワークフローファイル自体を lint。

### Renovate
`renovate.json5` を新規追加。`config:recommended` + `:dependencyDashboard` をベースに、
- timezone Asia/Tokyo、`rangeStrategy: bump`、PR 同時 20 / 時間 10、
  `prCreation: immediate`、`rebaseWhen: auto`。
- reviewer に `Soli0222`、`semanticCommits: enabled`。
- `vulnerabilityAlerts` は `security` ラベル付きで有効化。
- automerge ルール:
  - `github-actions` マネージャ → automerge (commit topic: `GitHub Action <name>`)。
  - `docker-compose` / `dockerfile` (`node` を除く) → automerge。
  - `npm` マネージャ → automerge。
- `node` だけは特別扱いで、`customManagers` の regex
  (`.github/workflows/*.yml` 内の `node-version: ['x.y.z']` 行) を
  datasource=`docker`、depName=`node` として拾い、`groupName: node` で集約 → automerge。

### その他
- `.gitignore` に `.DS_Store` を追加。

---

## 6. テスト

- `test/index.test.ts` の YouTube テストで `icon` の参照先を
  `.../78bc1359/img/logos/favicon.ico` から `.../2f190eaf/img/favicon.ico` に
  追従修正 (commit `bdd5200`)。新しい YouTube ページ構造に合わせるためだけの
  ピンポイント修正で、テスト構造そのものは upstream と同じ。
- 独自プラグインである `niconico` の専用テストは現状追加されていない。

---

## 7. 未取り込みの upstream 変更

`fce03eb..upstream/master` には以下が含まれており、本フォークでは
まだ取り込んでいない。

| upstream commit | 概要 |
| --- | --- |
| `a7330a0` `update deps (#52)` | 依存更新 |
| `878c6ef` `Release 5.2.4 (#53)` | リリースバンプ |
| `9595734` `update deps (#56)` | 依存更新 |
| `ee5491d` `fix(gh): trusted publishingに移行 (#55)` | npm の Trusted Publishing 対応 (本フォークは npm 公開を廃止しているため、取り込みは事実上不要) |
| `4280a41` `Release 5.2.5 (#57)` | リリースバンプ |
| `4070859` `update deps` | 依存更新 |
| `a73f875` `update deps (#61)` | 依存更新 |
| `b017827` `fix` | 5.3.0 関連の小修正 |
| `cf9da00` `enhance: tsdownでビルドするように (#62)` | ビルドを `tsc + tsc-alias` から `tsdown` (esbuild ベースのバンドラ) に切り替え。`tsdown.config.ts` 追加、`_VERSION_` グローバル define、`SummalyResult` の export 形を `export type SummalyResult = _SummalyResult;` に変更、`pnpm-workspace.yaml` 追加、`.npmrc` 削除など。 |
| `99b5ac2` `Release 5.3.0 (#63)` | リリースバンプ |

特に `cf9da00` (tsdown 移行) は本フォークの構成 (`tsc + tsc-alias` でファイル単位
出力、Docker イメージとして配布) との整合を要するため、取り込み時は
`Dockerfile` の `pnpm run build` 出力構造、および pino を含む実行時依存の
バンドル方針を再確認する必要がある。

---

## まとめ: 本フォークが目的としていること

1. **自前環境向けの Docker デプロイ**:
   npm パッケージとしてではなく、`ghcr.io` 上のコンテナイメージとして
   summaly を運用する。
2. **運用観測性の向上**:
   pino による構造化ロギング、`requestId` での横断トレース、`/health` エンドポイント、
   500 レスポンスからのスタックトレース漏出の抑止。
3. **国内サービスへの対応強化**:
   ニコニコ動画 (Nicozon フォールバック) プラグインの追加。
4. **タイムアウトの環境変数による外部制御**:
   `SUMMALY_RESPONSE_TIMEOUT` / `SUMMALY_OPERATION_TIMEOUT` でデプロイ環境に
   合わせて挙動を切り替えられるようにする。
5. **依存・CI の継続的更新**:
   actionlint と Renovate (Asia/Tokyo・automerge ルール・Node を Docker
   datasource として扱う customManager) で日常的な更新を自動化する。

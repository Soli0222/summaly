# Fork の変更点 (`Soli0222/summaly` vs `misskey-dev/summaly`)

このドキュメントは、本フォーク (`origin: Soli0222/summaly`) が upstream
(`misskey-dev/summaly`) に対してどのような変更を加えているかをまとめたものです。

## 比較基準

- 比較ベース: `upstream/master` (= `99b5ac2` / Release 5.3.0)
- 本フォークは upstream の 5.3.0 系列まで取り込み済みで、本ドキュメント時点での
  `git merge-base HEAD upstream/master` は upstream の最新 master と一致する。
- したがって以下に挙げる差分は、すべてフォークが独自に加えた変更である。

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
- `package.json` の `version` を upstream の `5.3.0` に対して `5.3.0-psr.4.1` という
  フォーク独自系列で運用 (`5.2.3-psr.4.0` から、5.3.0 取り込みに合わせて系列を進めた)。
- `name` は `@misskey-dev/summaly` のまま (npm publish しない前提なので衝突しない)。

### 依存追加・削除
- `dependencies` に `pino` を追加。
- `devDependencies` に `pino-pretty` を追加。
- `devDependencies` から `@types/debug` を削除 (upstream で wikipedia の debug ログが
  消えたため不要)。

ビルドツールチェーン (`tsdown`) や `chardet` / `ipaddr.js` といった依存・
ビルド構成は upstream に揃えており、フォーク独自の差分はない。

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

その他の `got.ts` の挙動 (`got@15`、`ipaddr.js` ベースのプライベート IP 拒否、
`AbortController` ベースのストリーム中断、`_VERSION_` define による
`DEFAULT_BOT_UA` 構成、など) は upstream と同一。

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

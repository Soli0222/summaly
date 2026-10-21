import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';
import { TagName } from 'release-please/build/src/util/tag-name.js';
import { parseConventionalCommits } from 'release-please/build/src/commit.js';
import { ForkNode } from './fork-node.mjs';
import { ForkVersioningStrategy } from './fork-version.mjs';

const packageContent = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
const latest = { tag: TagName.parse('5.5.1-psr.4.3'), sha: 'a'.repeat(40), notes: '' };
const strategy = () => new ForkNode({
	github: {
		repository: { owner: 'Soli0222', repo: 'summaly', defaultBranch: 'master' },
		getFileContentsOnBranch: async () => ({ parsedContent: packageContent }),
	},
	targetBranch: 'master',
	includeComponentInTag: false,
	includeVInTag: false,
	versioningStrategy: new ForkVersioningStrategy(),
	extraFiles: [{ type: 'yaml', path: 'charts/summaly/Chart.yaml', jsonpath: '$.appVersion' }],
});
const commits = message => parseConventionalCommits([{ sha: 'b'.repeat(40), message, files: ['Dockerfile'] }]);

test('real release strategy updates package/chart and round-trips the no-v fork tag', async () => {
	const node = strategy();
	const pr = await node.buildReleasePullRequest(commits('fix: update Node.js'), latest);
	assert.equal(pr.version.toString(), '5.5.1-psr.4.3.1');
	assert.equal(pr.headRefName, 'release-please--branches--master--components--summaly');
	const packageUpdate = pr.updates.find(update => update.path === 'package.json');
	assert.equal(JSON.parse(packageUpdate.updater.updateContent(packageContent)).version, '5.5.1-psr.4.3.1');
	const chartUpdate = pr.updates.find(update => update.path === 'charts/summaly/Chart.yaml');
	assert.match(chartUpdate.updater.updateContent('version: 0.2.0\nappVersion: 5.5.1-psr.4.3\n'), /appVersion: 5\.5\.1-psr\.4\.3\.1/);
	const release = await node.buildRelease({
		title: pr.title.toString(), body: pr.body.toString(), headBranchName: pr.headRefName,
		sha: 'c'.repeat(40),
	});
	assert.equal(release.tag.toString(), '5.5.1-psr.4.3.1');
});
test('Release-As cannot bypass the fork version constraints', async () => {
	for (const version of ['5.6.0', '5.5.1-psr.4.2.0', '5.5.1-psr.4.4']) {
		await assert.rejects(strategy().buildReleasePullRequest(
			commits(`feat: import upstream\n\nRelease-As: ${version}`), latest,
		));
	}
	const pr = await strategy().buildReleasePullRequest(
		commits('feat: import upstream\n\nRelease-As: 5.6.0-psr.4.4.0'), latest,
	);
	assert.equal(pr.version.toString(), '5.6.0-psr.4.4.0');
});
test('non-releasing commits do not create an empty release', async () => {
	assert.equal(await strategy().buildReleasePullRequest(commits('docs: explain releases'), latest), undefined);
});

import { appendFileSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import { GitHub, Manifest, registerVersioningStrategy } from 'release-please';
import { ForkVersioningStrategy } from './fork-version.mjs';

registerVersioningStrategy('psr', () => new ForkVersioningStrategy());
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const branch = process.env.RELEASE_BRANCH ?? 'master';
const github = await GitHub.create({ owner, repo, token: process.env.GH_TOKEN, defaultBranch: branch });
const loadManifest = () => Manifest.fromManifest(github, branch);

if (process.argv.includes('--dry-run')) {
	const candidates = await (await loadManifest()).buildPullRequests();
	for (const candidate of candidates) {
		console.log(JSON.stringify({
			version: candidate.pullRequest.version?.toString(),
			title: candidate.pullRequest.title.toString(),
			files: candidate.pullRequest.updates.map(update => update.path),
		}));
	}
} else {
	const releases = (await (await loadManifest()).createReleases()).filter(Boolean);
	const release = releases.find(item => item.path === '.');
	const outputs = release
		? { release_created: true, version: release.version, sha: release.sha }
		: { release_created: false };
	for (const [key, value] of Object.entries(outputs)) {
		appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
	}
	await (await loadManifest()).createPullRequests();
}

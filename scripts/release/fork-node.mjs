// Initialize the public entrypoint before importing strategy internals (CJS cycles).
import 'release-please';
import { Node } from 'release-please/build/src/strategies/node.js';
import { parseForkVersion } from './fork-version.mjs';

export class ForkNode extends Node {
	async buildNewVersion(commits, latestRelease) {
		// Node's Release-As handling runs before the versioning strategy.
		// Validate the final value so that neither config nor commit footers bypass it.
		const version = await super.buildNewVersion(commits, latestRelease);
		parseForkVersion(version.toString());
		if (!/^psr\.\d+\.\d+\.\d+$/.test(version.preRelease)) {
			throw new Error('New fork releases require all three psr version components');
		}
		if (latestRelease && version.compare(latestRelease.tag.version) <= 0) {
			throw new Error('Release-As must increase the version');
		}
		return version;
	}
}

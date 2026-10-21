import { Version } from 'release-please/build/src/version.js';
import { DefaultVersioningStrategy } from 'release-please/build/src/versioning-strategies/default.js';

// The upstream base and fork version are independent release lines.
export function parseForkVersion(value) {
	const match = /^(\d+\.\d+\.\d+)-psr\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec(value);
	if (!match) throw new Error(`Expected <upstream>-psr.<major>.<minor>.<patch>: ${value}`);
	return {
		base: match[1],
		fork: Version.parse(`${match[2]}.${match[3]}.${match[4] ?? '0'}`),
	};
}

export class ForkVersioningStrategy {
	bump(version, commits) {
		const { base, fork } = parseForkVersion(version.toString());
		const override = commits.flatMap(commit => commit.notes ?? [])
			.find(note => note.title === 'RELEASE AS');
		if (override) {
			parseForkVersion(override.text);
			const next = Version.parse(override.text);
			if (next.compare(version) <= 0) throw new Error('Release-As must increase the version');
			return next;
		}
		const nextFork = new DefaultVersioningStrategy().bump(fork, commits);
		return Version.parse(`${base}-psr.${nextFork}`);
	}

	determineReleaseType(_version, commits) {
		return { bump: version => this.bump(version, commits) };
	}
}

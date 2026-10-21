import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Version } from 'release-please/build/src/version.js';
import { ForkVersioningStrategy } from './fork-version.mjs';

const strategy = new ForkVersioningStrategy();
const commit = (type, breaking = false, notes = []) => ({ type, breaking, notes });
const bump = (version, commits) => strategy.bump(Version.parse(version), commits).toString();

test('inherits the legacy two-component fork version as 4.3.0', () => {
	assert.equal(bump('5.5.1-psr.4.3', [commit('fix')]), '5.5.1-psr.4.3.1');
});
test('features and breaking changes only advance the fork version', () => {
	assert.equal(bump('5.5.1-psr.4.3.1', [commit('fix'), commit('feat')]), '5.5.1-psr.4.4.0');
	assert.equal(bump('5.5.1-psr.4.3.1', [commit('feat'), commit('fix', true)]), '5.5.1-psr.5.0.0');
	assert.equal(bump('5.5.1-psr.4.3.9', [commit('fix')]), '5.5.1-psr.4.3.10');
});
test('explicit upstream import requires a valid increasing fork version', () => {
	const override = text => [commit('feat', false, [{ title: 'RELEASE AS', text }])];
	assert.equal(bump('5.5.1-psr.4.3.1', override('5.6.0-psr.4.4.0')), '5.6.0-psr.4.4.0');
	assert.throws(() => bump('5.5.1-psr.4.3.1', override('5.6.0')), /Expected/);
	assert.throws(() => bump('5.5.1-psr.4.3.1', override('5.5.1-psr.4.3.0')), /increase/);
});
test('rejects an unknown base format instead of silently bumping upstream', () => {
	assert.throws(() => bump('5.5.1', [commit('fix')]), /Expected/);
	assert.equal(strategy.determineReleaseType(null, [commit('fix')])
		.bump(Version.parse('5.5.1-psr.4.3')).toString(), '5.5.1-psr.4.3.1');
});

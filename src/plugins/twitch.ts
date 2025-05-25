import { scpaping } from '@/utils/got.js';
import summary from '@/summary.js';

export function test(url: URL): boolean {
	return url.hostname === 'twitch.tv' || url.hostname.endsWith('.twitch.tv');
}

export async function summarize(url: URL): Promise<summary> {
	const res = await scpaping(url.href);
	const $ = res.$;

	const title =
		$('meta[property="og:title"]').attr('content') ||
		$('meta[name="twitter:title"]').attr('content') ||
		$('meta[name="title"]').attr('content');

	const description =
		$('meta[property="og:description"]').attr('content') ||
		$('meta[name="twitter:description"]').attr('content') ||
		$('meta[name="description"]').attr('content');

	const thumbnail: string | undefined =
		$('meta[property="og:image"]').attr('content') ||
		$('meta[name="twitter:image"]').attr('content');

	let playerUrl =
		$('meta[property="og:video"]').attr('content') ||
		$('meta[property="og:video:secure_url"]').attr('content') ||
		$('meta[property="twitter:player"]').attr('content');

	if (playerUrl) {
		const host = process.env.HOST || 'example.com';
		const playerUrlObj = new URL(playerUrl);
		playerUrlObj.searchParams.set('parent', host);
		playerUrl = playerUrlObj.toString();
	}

	const playerWidth = $('meta[property="twitter:player:width"]').attr('content');

	const playerHeight = $('meta[property="twitter:player:height"]').attr('content');

	return {
		title: title ? title.trim() : null,
		icon: 'https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png',
		description: description ? description.trim() : null,
		thumbnail: thumbnail ? thumbnail.trim() : null,
		player: {
			url: playerUrl || null,
			width: playerWidth ? parseInt(playerWidth) : null,
			height: playerHeight ? parseInt(playerHeight) : null,
			allow: playerUrl ? [
				'autoplay',
				'encrypted-media',
				'fullscreen',
			] : [],
		},
		sitename: 'Twitch',
		activityPub: null,
		fediverseCreator: null,
	};
}

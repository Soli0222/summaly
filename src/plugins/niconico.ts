import * as cheerio from 'cheerio';
import type Summary from '@/summary.js';
import { getResponse, getGotOptions } from '@/utils/got.js';
import { parseGeneral, type GeneralScrapingOptions } from '@/general.js';
import { StatusError } from '@/utils/status-error.js';

export function test(url: URL): boolean {
	return url.hostname === 'nicovideo.jp' || url.hostname === 'www.nicovideo.jp';
}

export async function summarize(url: URL, opts?: GeneralScrapingOptions): Promise<Summary | null> {
	const args = getGotOptions(url.href, opts);

	try {
		const res = await getResponse({
			...args,
			method: 'GET',
		});
		const body = res.body;
		const $ = cheerio.load(body);

		const result = await parseGeneral(url, {
			body,
			$,
			response: res,
		});
		return result;
	} catch (error) {
		if (error instanceof StatusError) {
			try {
				const nicozonUrl = new URL(url.href);
				nicozonUrl.hostname = 'www.nicozon.net';

				const retryArgs = getGotOptions(nicozonUrl.href, opts);
				const retryRes = await getResponse({
					...retryArgs,
					method: 'GET',
				});
				const retryBody = retryRes.body;
				const retry$ = cheerio.load(retryBody);

				const retryResult = await parseGeneral(nicozonUrl, {
					body: retryBody,
					$: retry$,
					response: retryRes,
				});

				if (retryResult) {
					const videoId = url.pathname.replace(/^\/watch\//, '');
					return {
						...retryResult,
						icon: 'https://resource.video.nimg.jp/web/images/favicon/favicon.ico',
						description: videoId,
						player: {
							...retryResult.player,
							url: `https://embed.nicovideo.jp/watch/${videoId}?autoplay=1`,
							width: 640,
							height: 360,
						},
						sitename: 'ニコニコ動画',
					};
				}
				return retryResult;
			} catch (retryError) {
				console.log('[niconico] Nicozon retry failed:', retryError);
				return null;
			}
		} else {
			throw error;
		}
	}
}

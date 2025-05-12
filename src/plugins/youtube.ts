import * as cheerio from 'cheerio';
import type Summary from '@/summary.js';
import { getResponse, getGotOptions } from '@/utils/got.js';
import { parseGeneral, type GeneralScrapingOptions } from '@/general.js';

export function test(url: URL): boolean {
	return url.hostname === 'youtube.com'
	|| url.hostname === 'youtu.be';
}

export async function summarize(url: URL, opts?: GeneralScrapingOptions): Promise<Summary | null> {
	let modifiedUrl = url.href;
	if (url.hostname === 'youtu.be') {
		const videoId = url.pathname.slice(1);
		modifiedUrl = `https://www.youtube.com/watch?v=${videoId}`;
	} else if (url.hostname === 'youtube.com') {
		modifiedUrl = `https://www.youtube.com${url.pathname}${url.search}`;
	}

	const args = getGotOptions(modifiedUrl, opts);
	const res = await getResponse({
		...args,
		method: 'GET',
	});
	const body = res.body;
	const $ = cheerio.load(body);

	return await parseGeneral(url, {
		body,
		$,
		response: res,
	});
}

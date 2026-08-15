import axios from 'axios';

/**
 * CloudStream iOS Media Streaming Proxy
 * Bypasses CORS, spoofing Referer / User-Agent headers, and handles HTTP 206 Partial Content range requests.
 */

export async function proxyStreamHandler(req, res) {
  const targetUrl = req.query.url;
  const referer = req.query.referer || '';
  const customHeaders = req.query.headers ? JSON.parse(req.query.headers) : {};

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      ...customHeaders
    };

    if (referer) {
      headers['Referer'] = referer;
      headers['Origin'] = new URL(referer).origin;
    }

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      headers,
      responseType: 'stream',
      validateStatus: (status) => status < 400
    });

    // Forward response status and headers
    res.status(response.status);

    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'cache-control'
    ];

    headersToForward.forEach((h) => {
      if (response.headers[h]) {
        res.setHeader(h, response.headers[h]);
      }
    });

    // Ensure CORS headers are enabled for iOS Safari
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Origin, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    response.data.pipe(res);
  } catch (err) {
    console.error('Media proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Stream proxy error', message: err.message });
    }
  }
}

/**
 * Subtitle Converter and Proxy Handler
 * Converts SRT format to WebVTT format on the fly for native iOS player support
 */
export async function proxySubtitlesHandler(req, res) {
  const { lang, id, s, e, url } = req.query;

  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // If a direct URL is given, fetch and convert
  if (url) {
    try {
      const response = await axios.get(url, { responseType: 'text', timeout: 5000 });
      let text = response.data;

      // If it's SRT, convert to WebVTT
      if (!text.startsWith('WEBVTT')) {
        text = convertSrtToVtt(text);
      }
      return res.send(text);
    } catch (err) {
      console.warn('Direct subtitle fetch failed, generating fallback WebVTT:', err.message);
    }
  }

  // Generate clean WebVTT structure
  const vtt = `WEBVTT - CloudStream Subtitles (${lang || 'en'})\n\nNOTE\nSubtitles active for ${id || 'stream'}\n\n`;
  return res.send(vtt);
}

function convertSrtToVtt(srt) {
  let vtt = 'WEBVTT\n\n';
  // Replace comma in timestamps with period
  let converted = srt
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt + converted;
}

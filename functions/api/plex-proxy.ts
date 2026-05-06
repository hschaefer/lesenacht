export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const isPlexDirect = parsedUrl.hostname.endsWith('.plex.direct');
    const isPlexTv = parsedUrl.hostname === 'plex.tv' || parsedUrl.hostname.endsWith('.plex.tv');

    if (!isPlexDirect && !isPlexTv) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only Plex domains are allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const plexHeaders = new Headers();
  plexHeaders.set('Accept', 'application/json');
  
  // Forward client IP if available (useful for Tautulli/Dash reporting)
  const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For');
  if (clientIP) {
    plexHeaders.set('X-Forwarded-For', clientIP);
    plexHeaders.set('X-Real-IP', clientIP);
  }
  
  // Forward all X-Plex headers
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase().startsWith('x-plex-')) {
      plexHeaders.set(key, value);
    }
  }

  try {
    const plexResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: plexHeaders
    });

    const data = await plexResponse.text();
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
    });

    // Simple CORS hardening: reflect origin if it exists
    const origin = request.headers.get('Origin');
    if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin);
    }

    return new Response(data, {
      status: plexResponse.status,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

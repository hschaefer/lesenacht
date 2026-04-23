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

  const plexHeaders = new Headers();
  plexHeaders.set('Accept', 'application/json');
  
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
    
    return new Response(data, {
      status: plexResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default async ({ req, res, log, error }) => {
  try {
    if (req.method !== 'POST') {
      return res.json({ success: false, message: 'Method not allowed' }, 405);
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { endpoint, payload } = body || {};

    if (!endpoint || !payload) {
      return res.json({ success: false, message: 'Missing endpoint or payload in request body' }, 400);
    }

    log(`Proxying request to IRD API: ${endpoint}`);

    // Make the request to IRD CBMS API
    const irdResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Parse the response
    let responseData;
    const responseText = await irdResponse.text();
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    log(`Received response from IRD API: status ${irdResponse.status}`);

    return res.json({
      success: true,
      status: irdResponse.status,
      data: responseData
    });

  } catch (err) {
    error(`Failed to proxy to IRD: ${err.message}`);
    return res.json({
      success: false,
      message: 'Failed to proxy request',
      error: err.message
    }, 500);
  }
};

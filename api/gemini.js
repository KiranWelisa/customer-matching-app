export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body.' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  try {
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error('Gemini API Error:', errorBody);
      return res.status(apiResponse.status).json({ error: `Gemini API request failed: ${errorBody}` });
    }

    const data = await apiResponse.json();
    const responseText = data.candidates[0].content.parts[0].text;
    const jsonResponse = JSON.parse(responseText);

    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

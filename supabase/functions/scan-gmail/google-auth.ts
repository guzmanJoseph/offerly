export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET"
    );
  }

  if (!refreshToken) {
    throw new Error("No Google refresh token was stored");
  }

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    console.error("GOOGLE_TOKEN_REFRESH_FAILED", {
      status: response.status,
      response: responseText,
    });

    throw new Error(
      `Google token refresh failed (${response.status}): ${responseText}`
    );
  }

  const data = JSON.parse(responseText);

  if (!data.access_token) {
    throw new Error(
      "Google refresh response did not contain an access token"
    );
  }

  return data.access_token;
}
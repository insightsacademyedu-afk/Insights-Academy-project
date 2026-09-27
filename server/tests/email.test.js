import { jest } from "@jest/globals";
import { config } from "../config/env.js";
import { sendPasswordResetCode } from "../services/email.js";

describe("password reset email delivery", () => {
  const originalFetch = global.fetch;
  const originalApiKey = config.resend.apiKey;
  const originalFrom = config.resend.from;

  afterEach(() => {
    global.fetch = originalFetch;
    config.resend.apiKey = originalApiKey;
    config.resend.from = originalFrom;
  });

  test("uses Resend's HTTPS API when a key is configured", async () => {
    config.resend.apiKey = "re_test_key";
    config.resend.from = "Academy Management <no-reply@example.com>";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await sendPasswordResetCode({ recipient: "user@example.com", code: "123456" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
      })
    );
    const request = global.fetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({
      from: "Academy Management <no-reply@example.com>",
      to: ["user@example.com"],
      text: expect.stringContaining("123456"),
    }));
  });

  test("reports Resend API failures without exposing the API key", async () => {
    config.resend.apiKey = "re_private_value";
    config.resend.from = "Academy Management <no-reply@example.com>";
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '{"message":"domain is not verified"}',
    });

    let error;
    try {
      await sendPasswordResetCode({ recipient: "user@example.com", code: "123456" });
    } catch (caught) {
      error = caught;
    }
    expect(error?.message).toMatch(/403.*domain is not verified/i);
    expect(error?.message).not.toContain("re_private_value");
  });
});

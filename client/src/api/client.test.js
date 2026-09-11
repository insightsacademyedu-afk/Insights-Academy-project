import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import api from "./client";

// These interceptors are the entire reason a hand-rolled axios instance
// exists instead of calling axios directly (see client.js's own comments):
// double-submit CSRF on mutating requests, and normalizing the backend's
// { message } error shape so every caller can read err.message the same way.
// Both are exercised here against a fake adapter rather than a real server,
// since this project has no other frontend test infra to build on yet.

function setCookie(value) {
  document.cookie = `ams_csrf=${value}`;
}

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
}

describe("api client interceptors", () => {
  let originalAdapter;

  beforeEach(() => {
    clearCookies();
    originalAdapter = api.defaults.adapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    clearCookies();
  });

  it("attaches the x-csrf-token header on a mutating request when the cookie is present", async () => {
    setCookie("abc123");
    let capturedHeaders;
    api.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.post("/whatever", { a: 1 });
    expect(capturedHeaders["x-csrf-token"]).toBe("abc123");
  });

  it("does not attach the CSRF header on a GET request", async () => {
    setCookie("abc123");
    let capturedHeaders;
    api.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/whatever");
    expect(capturedHeaders["x-csrf-token"]).toBeUndefined();
  });

  it("omits the header on a mutating request when there is no CSRF cookie", async () => {
    let capturedHeaders;
    api.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.post("/whatever", {});
    expect(capturedHeaders["x-csrf-token"]).toBeUndefined();
  });

  it("normalizes a backend { message } error onto the rejected error object", async () => {
    api.defaults.adapter = async (config) => {
      const err = new Error("Request failed with status code 409");
      err.response = { status: 409, data: { message: "Roll number already in use" } };
      err.config = config;
      throw err;
    };

    await expect(api.post("/students", {})).rejects.toMatchObject({
      message: "Roll number already in use",
      status: 409,
    });
  });

  it("falls back to a generic message when the backend gives no { message }", async () => {
    api.defaults.adapter = async (config) => {
      const err = new Error("Network Error");
      err.config = config;
      throw err;
    };

    await expect(api.get("/whatever")).rejects.toMatchObject({
      message: "Network Error",
    });
  });
});

it('signals an expired session on protected API 401s, but not on failed login',async()=>{
 const expired=vi.fn();window.addEventListener('ams:session-expired',expired);
 try {
  api.defaults.adapter=async config=>{throw Object.assign(new Error('Unauthorized'),{config,response:{status:401,data:{message:'Session expired'}}});};
  await expect(api.get('/auth/me')).rejects.toMatchObject({status:401});
  expect(expired).toHaveBeenCalledTimes(1);
  await expect(api.post('/auth/login',{})).rejects.toMatchObject({status:401});
  expect(expired).toHaveBeenCalledTimes(1);
 } finally {window.removeEventListener('ams:session-expired',expired);}
});


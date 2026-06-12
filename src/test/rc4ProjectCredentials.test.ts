import { describe, it, expect } from "vitest";
import {
  credentialsFromLegacyFields,
  hasAnyCredentials,
  parseAccessCredentials,
  resolveProjectCredentials,
  syncLegacyCredentialColumns,
} from "@/lib/projectCredentials";

describe("projectCredentials", () => {
  it("migrates legacy single fields", () => {
    const creds = credentialsFromLegacyFields({
      url: "https://example.sk",
      username: "admin",
      password: "secret",
    });
    expect(creds).toHaveLength(1);
    expect(creds[0].label).toBe("Hlavný prístup");
    expect(creds[0].login).toBe("admin");
  });

  it("prefers JSON array over legacy columns", () => {
    const creds = resolveProjectCredentials({
      url: "legacy-url",
      username: "legacy",
      password: "legacy-pw",
      access_credentials: [
        { id: "c1", label: "FTP", url: "ftp://x", login: "ftpuser", password: "x" },
      ],
    });
    expect(creds).toHaveLength(1);
    expect(creds[0].label).toBe("FTP");
  });

  it("syncs first credential back to legacy columns", () => {
    const synced = syncLegacyCredentialColumns([
      { id: "1", label: "Admin", url: "https://a.sk", login: "admin@a.sk", password: "pw" },
      { id: "2", label: "FTP", url: "", login: "ftp", password: "ftp-pw" },
    ]);
    expect(synced.url).toBe("https://a.sk");
    expect(synced.username).toBe("admin@a.sk");
    expect(synced.password).toBe("pw");
    expect(synced.access_credentials).toHaveLength(2);
  });

  it("detects credentials in JSON or legacy fields", () => {
    expect(hasAnyCredentials({ url: null, username: null, password: null, access_credentials: [] })).toBe(false);
    expect(
      hasAnyCredentials({
        url: null,
        username: null,
        password: null,
        access_credentials: [{ id: "1", label: "X", login: "a", password: "" }],
      }),
    ).toBe(true);
  });

  it("parses access_credentials array safely", () => {
    const parsed = parseAccessCredentials([
      { id: "1", label: "WP", url: "https://x", login: "u", password: "p" },
      null,
      "bad",
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe("WP");
  });
});

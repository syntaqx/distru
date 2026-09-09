/**
 * Delivery providers - the outbound side of integrations: getting an artifact
 * OUT of Distru to where the operator wants it (an inbox, a Drive folder). Same
 * seam as the sync providers: env-selected (`EMAIL_PROVIDER` / `DRIVE_PROVIDER`,
 * default "mock"), "none" = unconnected (returns null, so the tools report "not
 * connected"). The mock returns API-accurately shaped results (a Gmail-style
 * message id, a Drive file id + webViewLink) so the whole loop works in a demo;
 * a real adapter is one file swap with no change to the tools that call it.
 */
import { env } from "@/lib/env";
import { hashHex } from "./util";

export type EmailResult = { id: string; to: string };
export type DriveResult = { fileId: string; url: string; name: string };

export interface EmailProvider {
  readonly id: string;
  /** True when a message can actually be sent (a real or mock account is wired). */
  isConnected(): boolean;
  /** Send an email; null when unconnected. */
  send(input: { to: string; subject: string; body: string }): EmailResult | null;
}

export interface DriveProvider {
  readonly id: string;
  isConnected(): boolean;
  /** Upload a file; null when unconnected. Returns a shareable web link. */
  upload(input: { filename: string; content: string; mimeType?: string; folder?: string }): DriveResult | null;
}

// ---------------- Email (mock = a transactional-email account) ----------------

const mockEmail: EmailProvider = {
  id: "email-mock",
  isConnected: () => true,
  send: ({ to }) => ({ id: `<${hashHex(`email:${to}:${Date.now()}`, 20)}@distru.mock>`, to }),
};

const noneEmail: EmailProvider = {
  id: "none",
  isConnected: () => false,
  send: () => null,
};

export function getEmailProvider(): EmailProvider {
  return env.emailProvider === "none" ? noneEmail : mockEmail;
}

// ---------------- Google Drive ----------------

const mockDrive: DriveProvider = {
  id: "google-drive-mock",
  isConnected: () => true,
  upload: ({ filename }) => {
    const fileId = hashHex(`drive:${filename}:${Date.now()}`, 28);
    return {
      fileId,
      name: filename,
      url: `https://drive.google.com/file/d/${fileId}/view`,
    };
  },
};

const noneDrive: DriveProvider = {
  id: "none",
  isConnected: () => false,
  upload: () => null,
};

export function getDriveProvider(): DriveProvider {
  return env.driveProvider === "none" ? noneDrive : mockDrive;
}

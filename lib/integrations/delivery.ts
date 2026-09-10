/**
 * Delivery providers - the outbound side of integrations: getting an artifact
 * OUT of Distru to where the operator wants it (an inbox, a Drive folder).
 *
 * Config-aware, like the sync seam: pass a connection's stored config and, when
 * it holds real (non-`__demo`) credentials, a LIVE adapter is returned that
 * actually sends - Email over SMTP via nodemailer using the tenant's host/user/
 * pass. With no config (or demo creds) it falls back to the env-selected mock
 * ("mock" simulates a connected account so the produce -> deliver -> notify loop
 * works in a demo; "none" = unconnected). So "configure Email and it works" is
 * literally true.
 */
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { hashHex } from "./util";

export type EmailResult = { id: string; to: string };
export type DriveResult = { fileId: string; url: string; name: string };

export interface EmailProvider {
  readonly id: string;
  /** True when a message can actually be sent (a real or mock account is wired). */
  isConnected(): boolean;
  /** Send an email; null when unconnected. Async (a live SMTP send is async). */
  send(input: { to: string; subject: string; body: string }): Promise<EmailResult | null>;
}

export interface DriveProvider {
  readonly id: string;
  isConnected(): boolean;
  /** Upload a file; null when unconnected. Returns a shareable web link. */
  upload(input: { filename: string; content: string; mimeType?: string; folder?: string }): DriveResult | null;
}

const str = (c: Record<string, unknown>, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");

// ---------------- Email ----------------

const mockEmail: EmailProvider = {
  id: "email-mock",
  isConnected: () => true,
  send: async ({ to }) => ({ id: `<${hashHex(`email:${to}:${Date.now()}`, 20)}@distru.mock>`, to }),
};

const noneEmail: EmailProvider = {
  id: "none",
  isConnected: () => false,
  send: async () => null,
};

/** A real SMTP sender using the tenant's stored credentials (nodemailer). */
function liveEmail(config: Record<string, unknown>): EmailProvider {
  const host = str(config, "host");
  const port = Number(str(config, "port") || "587");
  const user = str(config, "username");
  const pass = str(config, "password");
  const from = str(config, "fromAddress") || user;
  return {
    id: "email-smtp",
    isConnected: () => !!(host && user && pass),
    send: async ({ to, subject, body }) => {
      const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
      const info = await transport.sendMail({ from, to, subject, text: body });
      return { id: info.messageId, to };
    },
  };
}

/**
 * The email provider. A real, non-demo SMTP config -> live send; otherwise the
 * env-selected mock/none. Pass the org's Email connection config to go live.
 */
export function getEmailProvider(config?: Record<string, unknown>): EmailProvider {
  if (config && config.__demo !== true && str(config, "host") && str(config, "username") && str(config, "password")) {
    return liveEmail(config);
  }
  return env.emailProvider === "none" ? noneEmail : mockEmail;
}

// ---------------- Google Drive ----------------

const mockDrive: DriveProvider = {
  id: "google-drive-mock",
  isConnected: () => true,
  upload: ({ filename }) => {
    const fileId = hashHex(`drive:${filename}:${Date.now()}`, 28);
    return { fileId, name: filename, url: `https://drive.google.com/file/d/${fileId}/view` };
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

// SERVER-ONLY. Transactional email. Call sendEmail() inside server function handlers.
// Provider order: Resend (RESEND_API_KEY, the default on Netlify) -> MonstarX mail (MONSTARX_MAIL_URL) -> dev console log.
// Resend: set RESEND_FROM to an address on a domain verified in Resend. Without a verified domain, Resend only
// delivers to the email of the Resend account owner (use onboarding@resend.dev while testing).
export interface EmailMessage {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  /** Where replies should go (for example the signed-in user's address). */
  replyTo?: string
  /** Display name for the sender; defaults to the app's name. */
  fromName?: string
}

export interface SentEmail {
  id: string
  from: string
  /**
   * Recipients on test domains that can never receive mail (example.com, example.org, example.net and names ending in
   * .test, .example, .invalid or .localhost). They are left out and listed here instead of failing the call.
   */
  skipped?: string[]
}

export type OtpPurpose = 'sign-in' | 'email-verification' | 'forget-password'

const OTP_COPY: Record<OtpPurpose, { subject: string; lead: string }> = {
  'sign-in': { subject: 'Your FitRoom sign-in code', lead: 'Use this code to finish signing in to FitRoom.' },
  'email-verification': { subject: 'Verify your email for FitRoom', lead: 'Use this code to verify your email and finish creating your FitRoom account.' },
  'forget-password': { subject: 'Reset your FitRoom password', lead: 'Use this code to choose a new FitRoom password.' },
}

/** Subject and body of a one-time-code email. The code is digits only, so it needs no escaping. */
export function otpEmail(otp: string, purpose: OtpPurpose): Pick<EmailMessage, 'subject' | 'text' | 'html'> {
  const copy = OTP_COPY[purpose] ?? OTP_COPY['sign-in']
  return {
    subject: copy.subject,
    text: `${copy.lead}\n\nYour code: ${otp}\n\nIt expires in 5 minutes. If you did not ask for it, ignore this email and nobody can use it without your password.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#111"><h2 style="margin:0 0 12px">FitRoom</h2><p>${copy.lead}</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:20px 0">${otp}</p><p style="color:#555;font-size:13px">It expires in 5 minutes. If you did not ask for it, ignore this email.</p></div>`,
  }
}

async function sendWithResend(message: EmailMessage, apiKey: string): Promise<SentEmail> {
  const from = process.env.RESEND_FROM || 'FitRoom <onboarding@resend.dev>'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'user-agent': 'fitroom/1.0' },
    body: JSON.stringify({
      from: message.fromName ? from.replace(/^[^<]*</, `${message.fromName} <`) : from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string }
  // Never include the request body (it carries the code) in the error.
  if (!response.ok) throw new Error(`Resend rejected the email (${response.status}): ${data.message ?? 'no detail'}`)
  return { id: data.id ?? '', from }
}

export async function sendEmail(message: EmailMessage): Promise<SentEmail> {
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) return sendWithResend(message, resendKey)
  if (!process.env.MONSTARX_MAIL_URL && process.env.NODE_ENV !== 'production') {
    // Local development without any provider: print the message so the flow can be tested. Never runs in production.
    console.info('[fitroom] DEV EMAIL (no provider configured)\nto:', message.to, '\n', message.text)
    return { id: 'dev', from: 'dev' }
  }
  const url = process.env.MONSTARX_MAIL_URL
  const token = process.env.MONSTARX_DATA_TOKEN
  if (!url || !token) {
    throw new Error('Email is only available while this app runs inside MonstarX (previews and published apps); set MONSTARX_MAIL_URL and MONSTARX_DATA_TOKEN elsewhere.')
  }
  const response = await fetch(`${url}/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(message),
  })
  const data = (await response.json().catch(() => ({}))) as { id?: string; from?: string; skipped?: string[]; error?: string }
  if (!response.ok) throw new Error(data.error ?? `Email request failed (${response.status})`)
  return { id: data.id ?? '', from: data.from ?? '', ...(data.skipped?.length ? { skipped: data.skipped } : {}) }
}

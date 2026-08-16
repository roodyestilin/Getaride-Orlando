"""SendGrid transactional email helper for Getaride Orlando."""
import os
import asyncio
import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email

log = logging.getLogger("getaride.email")

_BRAND = "#9333ea"


def _wrap(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;">
      <div style="background:{_BRAND};padding:20px 24px;border-radius:12px 12px 0 0;">
        <span style="color:#fff;font-size:20px;font-weight:bold;">Getaride <span style="color:#e9d5ff;">Orlando</span></span>
      </div>
      <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;color:#18181b;">
        <h2 style="margin:0 0 12px;font-size:20px;">{title}</h2>
        {body_html}
        <p style="color:#71717a;font-size:12px;margin-top:24px;">Orlando's airport-transfer ride marketplace.</p>
      </div>
    </div>
    """


def _send_sync(to: str, subject: str, html: str) -> bool:
    api_key = os.environ.get("SENDGRID_API_KEY")
    sender = os.environ.get("SENDER_EMAIL", "no-reply@getaride.com")
    name = os.environ.get("SENDER_NAME", "Getaride Orlando")
    if not api_key or not to:
        log.warning("SendGrid not configured or missing recipient; skipping email to %s", to)
        return False
    try:
        message = Mail(from_email=Email(sender, name), to_emails=to, subject=subject, html_content=html)
        resp = SendGridAPIClient(api_key).send(message)
        ok = 200 <= resp.status_code < 300
        if not ok:
            body = getattr(resp, "body", b"")
            log.warning("SendGrid non-2xx (%s) sending to %s: %s", resp.status_code, to, body)
        return ok
    except Exception as e:  # never break the request path because of email
        log.warning("SendGrid send failed to %s: %s", to, e)
        return False


def send_email_bg(to: str, subject: str, title: str, body_html: str) -> None:
    """Fire-and-forget email; never blocks or raises into the request."""
    if not to:
        return
    html = _wrap(title, body_html)
    try:
        asyncio.get_event_loop().run_in_executor(None, _send_sync, to, subject, html)
    except RuntimeError:
        _send_sync(to, subject, html)


# ---- Templated events -------------------------------------------------------

def email_verification(to: str, name: str, code: str):
    body = (f"<p>Hi {name or 'there'}, welcome to Getaride!</p>"
            f"<p>Your email verification code is:</p>"
            f"<p style='font-size:30px;font-weight:bold;letter-spacing:6px;color:{_BRAND};'>{code}</p>"
            "<p>Enter this code in the app to verify your email.</p>")
    send_email_bg(to, "Verify your email · Getaride", "Verify your email", body)


def email_driver_application(to: str, name: str):
    body = (f"<p>Hi {name or 'there'}, thanks for applying to drive with Getaride!</p>"
            "<p>Your application has been received and is under review. "
            "We'll email you as soon as you're approved to go online.</p>")
    send_email_bg(to, "Application received · Getaride", "Application received", body)


def email_driver_approved(to: str, name: str):
    body = (f"<p>Great news {name or 'there'} — your driver application is approved!</p>"
            "<p>You can now go online and start accepting airport-transfer rides.</p>")
    send_email_bg(to, "You're approved to drive · Getaride", "You're approved!", body)


def email_ride_scheduled(to: str, name: str, pickup: str, dest: str, when: str, fare: float):
    body = (f"<p>Hi {name or 'there'}, your ride is booked.</p>"
            f"<p><b>When:</b> {when}<br><b>From:</b> {pickup}<br><b>To:</b> {dest}<br>"
            f"<b>Estimated fare:</b> ${fare:.2f}</p>"
            "<p>Open the app to compare driver offers and track your ride.</p>")
    send_email_bg(to, "Your ride is booked · Getaride", "Ride confirmed", body)


def email_driver_selected(to: str, name: str, driver: str, vehicle: str, fare: float):
    body = (f"<p>Hi {name or 'there'}, your driver is confirmed!</p>"
            f"<p><b>Driver:</b> {driver}<br><b>Vehicle:</b> {vehicle}<br><b>Fare:</b> ${fare:.2f}</p>"
            "<p>Track your driver live in the app.</p>")
    send_email_bg(to, "Your driver is confirmed · Getaride", "Driver confirmed", body)


def email_ride_cancelled(to: str, name: str, fee: float):
    fee_line = (f"<p>A ${fee:.2f} cancellation fee was applied.</p>" if fee and fee > 0
                else "<p>No cancellation fee was charged.</p>")
    body = f"<p>Hi {name or 'there'}, your ride has been cancelled.</p>{fee_line}"
    send_email_bg(to, "Ride cancelled · Getaride", "Ride cancelled", body)

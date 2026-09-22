# Safetynet listener chat pilot

Status: preparation only. No chat provider is connected and no visitor data is sent to a new service.

## Candidate

Evaluate tawk.to for a small human-listener pilot. Its privacy settings include disabling visitor IP recording. This must be configured and tested rather than assumed. The provider may still process technical data.

Owner account: safetynetorgng@gmail.com. Do not store account passwords, API secrets, or recovery codes in this repository.

## Setup before integration

- Use named listener accounts with individual logins, not a shared password. Enable available multifactor authentication.
- Disable visitor IP recording. Confirm the result from a non-admin listener account.
- Remove name, email, phone, and location fields from online and offline intake. Do not populate identity from feedback forms, helping IDs, or WhatsApp.
- Disable AI replies and unnecessary integrations. The pilot is human support.
- Keep paid therapy outside the pilot. Department routing must not be treated as access isolation: tawk.to documents that other logged-in agents can see department chats.
- Confirm authorised staff visibility with the founder and state it in the visitor notice. If access controls cannot meet the intended boundary, stop before launch.
- Configure honest staffed hours and offline status. Do not advertise 24/7 service or emergency response.
- Agree a transcript retention and deletion process, including who is responsible. Do not claim automatic deletion unless tested.
- Start with text only; disable file uploads where supported. Confirm spam controls and blocking/reporting tools.
- Return the public widget embed code, configuration summary, and any remaining setup limitations. Do not send login credentials.

## Website integration

Load the widget only after the visitor chooses to open chat and sees a short privacy notice. No tracker should load on unrelated pages. Do not pass a visitor's name or phone number. Keep current WhatsApp links explicitly separate and labelled as non-anonymous.

## Acceptance checks

Use fictional test conversations with two browser sessions and a non-admin listener account. Verify no identity fields are required, technical identifiers are not visible to the listener, visitors cannot read one another's conversations, actual staff access matches the notice, offline behaviour is honest, deletion works as described, and mobile keyboard/navigation work. Do not enable the public pilot until checks pass.

## Phone-number exposure

Visible phone-number text has been removed, but WhatsApp URLs still contain destination numbers. The QR code and public Git history also expose previously published numbers. Redirects, encoding, or hiding links do not make a publicly reachable WhatsApp destination secret. Use organisation-owned support numbers or remove WhatsApp destinations when the web-chat replacement is ready.

## Sources

- https://www.tawk.to/data-protection/gdpr/
- https://help.tawk.to/article/disabling-visitor-ip-tracking-on-ios
- https://help.tawk.to/article/set-up-a-pre-chat-form-with-the-option-to-select-a-department
- https://www.tawk.to/privacy-policy/

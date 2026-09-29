const form = document.querySelector('#verification-form');
const input = document.querySelector('#verification-code');
const result = document.querySelector('#verification-result');
const button = form.querySelector('button');
let requestId = 0;

function message(title, detail, state) {
  result.replaceChildren();
  result.className = `verification-result ${state}`;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = detail;
  result.append(heading, paragraph);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const code = input.value.trim();
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(code)) {
    message('Check your verification code', 'Use the full verification code supplied with your certificate, or scan its QR code. A certificate number alone is not enough.', 'notice');
    return;
  }
  const current = ++requestId;
  button.disabled = true;
  result.setAttribute('aria-busy', 'true');
  message('Checking certificate…', 'Please wait while we check the register.', 'notice');
  try {
    const response = await fetch('/api/verify-certificate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }), cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 429) {
      message('Please wait before trying again', 'Too many verification attempts. Wait one minute, then retry.', 'notice');
      return;
    }
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    if (current !== requestId) return;
    const prefix = data.demo === true ? 'Test result: ' : '';
    if (data.status === 'not_found') {
      message(`${prefix}Certificate not found`, 'Check the code or contact Safetynet. A missing record does not by itself establish that a certificate is fraudulent.', 'notice');
    } else if (data.status === 'revoked') {
      message(`${prefix}Certificate revoked`, 'This record is no longer valid. Contact Safetynet for clarification.', 'notice');
    } else if (data.status === 'valid' && data.certificate && ['number', 'name', 'course', 'date'].every(key => typeof data.certificate[key] === 'string' && data.certificate[key].trim())) {
      message(`${prefix}Valid certificate`, data.demo ? 'Fictional local test only. This is not an issued certificate.' : 'Compare these registered details with the certificate presented to you. A matching record does not verify the identity of the person presenting it.', 'success');
      const details = document.createElement('dl');
      for (const [key, label] of [['number','Certificate number'], ['name','Awarded to'], ['course','Course'], ['date','Completion date']]) {
        const term = document.createElement('dt');
        const value = document.createElement('dd');
        term.textContent = label;
        value.textContent = data.certificate[key];
        details.append(term, value);
      }
      result.append(details);
    } else throw new Error('Invalid response');
  } catch {
    if (current === requestId) message('Verification temporarily unavailable', 'We could not check the register. Please try again later or contact Safetynet. This is not a “not found” result.', 'notice');
  } finally {
    if (current === requestId) {
      button.disabled = false;
      result.setAttribute('aria-busy', 'false');
    }
  }
});

// Keep QR tokens out of the query string and remove them from the visible URL.
const token = new URLSearchParams(location.hash.slice(1)).get('code');
if (token) {
  history.replaceState(null, '', location.pathname);
  input.value = token;
  form.requestSubmit();
} else if (new URLSearchParams(location.search).has('cert')) {
  message('Verification code needed', 'This older link contains only a certificate number. Ask Safetynet for the complete verification link.', 'notice');
}

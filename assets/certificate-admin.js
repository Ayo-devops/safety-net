(() => {
  const API = '/api/certificate-admin';
  const SESSION_KEY = 'safetynetCertificateAdminSession';
  const VERIFY_BASE = 'https://safetyneto.netlify.app/verify.html#code=';
  const $ = id => document.getElementById(id);
  let privateRecord = null;
  let records = [];

  const setStatus = (element, message, type = '') => {
    element.textContent = message;
    element.className = `status${type ? ` ${type}` : ''}`;
  };
  const loadSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  };
  const saveSession = session => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  async function rawRequest(body, token = '') {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
    let data;
    try { data = await response.json(); }
    catch { data = { status: 'error', message: 'Unexpected server response.' }; }
    return { response, data };
  }

  async function refreshSession() {
    const session = loadSession();
    if (!session?.refresh_token) throw new Error('Please sign in again.');
    const { response, data } = await rawRequest({ action: 'refresh-session', refresh_token: session.refresh_token });
    if (!response.ok || data.status !== 'authenticated') {
      clearSession();
      throw new Error('Your session has ended. Please sign in again.');
    }
    const updated = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000
    };
    saveSession(updated);
    return updated.access_token;
  }

  async function accessToken() {
    const session = loadSession();
    if (!session?.access_token) throw new Error('Please sign in again.');
    if (Number(session.expires_at) > Date.now() + 120000) return session.access_token;
    return refreshSession();
  }

  async function adminRequest(body) {
    let token = await accessToken();
    let result = await rawRequest(body, token);
    if (result.response.status === 401) {
      token = await refreshSession();
      result = await rawRequest(body, token);
    }
    if (result.response.status === 401 || result.response.status === 403) {
      clearSession();
      showLogin('Your session has ended. Please request a new sign-in link.', 'error');
      throw new Error('Your session has ended.');
    }
    return result;
  }

  function acceptMagicLink() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('error_description')) {
      history.replaceState(null, '', location.pathname);
      return params.get('error_description');
    }
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (!access || !refresh) return '';
    saveSession({
      access_token: access,
      refresh_token: refresh,
      expires_at: Date.now() + (Number(params.get('expires_in')) || 3600) * 1000
    });
    history.replaceState(null, '', location.pathname);
    return '';
  }

  function showLogin(message = '', type = '') {
    $('loginView').hidden = false;
    $('adminView').hidden = true;
    $('signOut').hidden = true;
    if (message) setStatus($('loginStatus'), message, type);
  }

  function showAdmin() {
    $('loginView').hidden = true;
    $('adminView').hidden = false;
    $('signOut').hidden = false;
  }

  const bytesToBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function createVerificationCredentials() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const code = bytesToBase64Url(bytes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const tokenHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { code, tokenHash, verificationUrl: VERIFY_BASE + code };
  }

  function renderCertificate(record) {
    $('outputNumber').textContent = record.number;
    $('outputName').textContent = record.name;
    $('outputCourse').textContent = record.course;
    $('outputDetails').textContent = [record.duration, record.skills].filter(Boolean).join(' • ');
    const date = new Date(`${record.completion_date}T12:00:00`);
    $('outputDate').textContent = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const qr = qrcode(0, 'M');
    qr.addData(record.verification_url);
    qr.make();
    $('qrBox').innerHTML = qr.createSvgTag(4, 16);
    $('certificateSection').hidden = false;
    $('certificateSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function suggestNextNumber() {
    if ($('certificateNumber').value) return;
    const year = new Date().getFullYear();
    const prefix = `SN-${year}-`;
    const highest = records
      .map(record => record.number)
      .filter(number => number.startsWith(prefix))
      .map(number => Number(number.slice(prefix.length)))
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0);
    $('certificateNumber').value = `${prefix}${String(highest + 1).padStart(6, '0')}`;
  }

  function renderRecords() {
    const body = $('recordsBody');
    body.replaceChildren();
    if (!records.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.textContent = 'No certificates have been registered yet.';
      return;
    }
    for (const record of records) {
      const row = body.insertRow();
      for (const value of [record.number, record.name, record.course, record.date]) row.insertCell().textContent = value;
      const statusCell = row.insertCell();
      const pill = document.createElement('span');
      pill.className = `status-pill ${record.status}`;
      pill.textContent = record.status;
      statusCell.append(pill);
      const actionCell = row.insertCell();
      if (record.status === 'valid') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'revoke-button';
        button.textContent = 'Revoke';
        button.addEventListener('click', () => revokeCertificate(record.number, button));
        actionCell.append(button);
      } else actionCell.textContent = '—';
    }
  }

  async function loadRecords() {
    $('refreshRecords').disabled = true;
    setStatus($('recordsStatus'), 'Loading certificate register…');
    try {
      const { response, data } = await adminRequest({ action: 'list' });
      if (!response.ok || data.status !== 'ok' || !Array.isArray(data.certificates)) throw new Error(data.message || 'Could not load records.');
      records = data.certificates;
      renderRecords();
      suggestNextNumber();
      setStatus($('recordsStatus'), `${records.length} certificate record${records.length === 1 ? '' : 's'} loaded.`, 'success');
    } catch (error) {
      setStatus($('recordsStatus'), error.message, 'error');
    } finally { $('refreshRecords').disabled = false; }
  }

  async function revokeCertificate(number, button) {
    if (!confirm(`Revoke ${number}? Its QR code will stop showing a valid certificate.`)) return;
    button.disabled = true;
    try {
      const { response, data } = await adminRequest({ action: 'revoke', number, confirm: true });
      if (!response.ok || data.status !== 'revoked') throw new Error(data.message || 'Could not revoke this certificate.');
      await loadRecords();
    } catch (error) {
      setStatus($('recordsStatus'), error.message, 'error');
      button.disabled = false;
    }
  }

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    setStatus($('loginStatus'), 'Sending a secure sign-in link…');
    try {
      const { response, data } = await rawRequest({ action: 'request-login', email: $('adminEmail').value.trim() });
      if (!response.ok) throw new Error(data.message || 'Could not send the sign-in link.');
      setStatus($('loginStatus'), 'Check the founder’s inbox. The link expires and can be used only once.', 'success');
    } catch (error) {
      setStatus($('loginStatus'), error.message, 'error');
    } finally { button.disabled = false; }
  });

  $('certificateForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('createCertificate');
    button.disabled = true;
    setStatus($('formStatus'), 'Generating a secure verification code and registering the certificate…');
    try {
      const credentials = await createVerificationCredentials();
      const record = {
        number: $('certificateNumber').value.trim().toUpperCase(),
        name: $('recipientName').value.trim(),
        course: $('courseName').value.trim(),
        completion_date: $('completionDate').value,
        duration: $('courseDuration').value.trim(),
        skills: $('skillsSummary').value.trim(),
        verification_code: credentials.code,
        token_hash: credentials.tokenHash,
        verification_url: credentials.verificationUrl
      };
      const { response, data } = await adminRequest({ action: 'create', approved: $('approval').checked, ...record });
      if (!response.ok || data.status !== 'created') throw new Error(data.message || 'Could not register the certificate.');
      privateRecord = record;
      renderCertificate(record);
      setStatus($('formStatus'), 'Certificate registered successfully. Download the private backup, verify the QR, and then print.', 'success');
      await loadRecords();
    } catch (error) {
      privateRecord = null;
      $('certificateSection').hidden = true;
      setStatus($('formStatus'), error.message, 'error');
    } finally { button.disabled = false; }
  });

  $('downloadRecord').addEventListener('click', () => {
    if (!privateRecord) return;
    const blob = new Blob([`${JSON.stringify(privateRecord, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${privateRecord.number}-private-record.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  $('printCertificate').addEventListener('click', () => { if (privateRecord) window.print(); });
  $('refreshRecords').addEventListener('click', loadRecords);
  $('signOut').addEventListener('click', () => { clearSession(); privateRecord = null; showLogin('Signed out successfully.', 'success'); });

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('completionDate').value = localToday;
  const magicLinkError = acceptMagicLink();
  if (loadSession()) {
    showAdmin();
    loadRecords();
  } else showLogin(magicLinkError, magicLinkError ? 'error' : '');
})();

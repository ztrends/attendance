/* ZTREND cloud authentication bridge.
   This bridge authenticates against Supabase; it does not migrate legacy passwords. */
(() => {
  'use strict';
  const client = window.ZTrendBackend?.client;
  if (!client) {
    console.error('ZTREND: Cloud authentication unavailable; Supabase client missing.');
    return;
  }

  const KEY = 'ztrend_workforce_v3';
  const portal = document.body.dataset.portal;

  let signingIn = false;
  async function signIn() {
    if (signingIn) return;
    signingIn = true;
    const button = document.querySelector('#signin');
    const errorBox = document.querySelector('#err');
    const identifier = document.querySelector('#email')?.value.trim();
    const password = document.querySelector('#password')?.value || '';
    if (!identifier || !password) {
      errorBox.textContent = 'Enter your login ID and password.';
      signingIn = false;
      return;
    }

    button.disabled = true;
    button.textContent = 'Signing in…';
    errorBox.textContent = '';

    try {
      // Email sign-in goes straight to Supabase Auth in the browser.
      // Employee ID/mobile sign-in still uses the lookup Edge Function.
      let loginData, loginError;
      // Never leave the login button spinning forever if the network/Auth request stalls.
      const authRequest = identifier.includes('@')
        ? client.auth.signInWithPassword({ email: identifier, password })
        : client.functions.invoke('employee-login', { body: { identifier, password } });
      const timeout = new Promise((_, reject) =>
        window.setTimeout(() => reject(new Error('Login request timed out. Check your internet connection and try again.')), 15000)
      );
      const result = await Promise.race([authRequest, timeout]);
      if (identifier.includes('@')) {
        loginError = result.error;
        if (result.data?.session) loginData = {
          access_token: result.data.session.access_token,
          refresh_token: result.data.session.refresh_token
        };
      } else {
        loginData = result.data;
        loginError = result.error;
      }
      if (loginError || !loginData?.access_token || !loginData?.refresh_token) {
        // Supabase Functions returns non-2xx responses as FunctionsHttpError;
        // the useful JSON error is in error.context, not error.message.
        let serverMessage = loginData?.error;
        if (!serverMessage && loginError?.context) {
          try {
            const response = loginError.context;
            const payload = typeof response.clone === 'function'
              ? await response.clone().json()
              : null;
            serverMessage = payload?.error || payload?.message;
          } catch (_) { /* Keep the safe fallback below. */ }
        }
        const status = loginError?.context?.status;
        if (!serverMessage && status === 401) serverMessage = 'Email/login ID ya password galat hai, ya account inactive hai.';
        if (!serverMessage && status === 404) serverMessage = 'Login service nahi mili. Supabase Edge Function deployment check karein.';
        if (!serverMessage && status >= 500) serverMessage = 'Login service mein server error hai. Thodi der baad retry karein.';
        throw new Error(serverMessage || loginError?.message || 'Login complete nahi hua.');
      }

      const { data: sessionData, error: sessionError } = await client.auth.setSession({
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token
      });
      if (sessionError || !sessionData?.user) throw new Error('Could not establish secure session.');

      const { data: profile, error: profileError } = await client
        .from('profiles').select('*').eq('id', sessionData.user.id).maybeSingle();
      if (profileError || !profile) throw new Error('Your employee profile is not configured.');

      if (profile.role !== portal) {
        await client.auth.signOut();
        throw new Error('This account does not have access to this portal.');
      }
      if (profile.status !== 'Active') {
        await client.auth.signOut();
        throw new Error('This account is inactive. Contact your administrator.');
      }

      const { data: companies, error: companyError } = await client.from('companies').select('*');
      if (companyError) throw companyError;
      const { data: projects, error: projectError } = await client.from('projects').select('*');
      if (projectError) throw projectError;
      const { data: shifts, error: shiftError } = await client.from('shifts').select('*');
      if (shiftError) throw shiftError;
      const { data: attendance, error: attendanceError } = await client.from('attendance').select('*');
      if (attendanceError) throw attendanceError;
      const { data: leaves, error: leavesError } = await client.from('leaves').select('*');
      if (leavesError) throw leavesError;

      const { data: profiles, error: profilesError } = await client.from('profiles').select('*');
      if (profilesError) throw profilesError;
      const users = (profiles || []).map(p => ({
        id:p.id, employeeId:p.employee_id, name:p.full_name, email:p.email, mobile:p.mobile_number,
        role:p.role, status:p.status, companyId:p.company_id, projectId:p.project_id,
        designation:p.designation, post:p.post, permissions:p.permissions || []
      }));
      const user = users.find(u => u.id === profile.id);
      if (!user) throw new Error('Your employee profile could not be loaded.');

      const db = {
        users,
        companies: (companies || []).map(c => ({
          id:c.id, name:c.name, code:c.code, phone:c.phone, email:c.email,
          address:c.address, logo:c.logo_url, status:c.status, created:c.created_at
        })),
        projects: (projects || []).map(p => ({
          id:p.id, companyId:p.company_id, name:p.name, address:p.address,
          lat:p.lat, lng:p.lng, radius:p.radius, status:p.status, description:p.description
        })),
        shifts: (shifts || []).map(s => ({
          id:s.id, companyId:s.company_id, name:s.name, start:s.start_time,
          end:s.end_time, break:s.break_minutes, grace:s.grace_minutes, status:s.status
        })),
        attendance: (attendance || []).map(a => ({
          id:a.id, userId:a.user_id, companyId:a.company_id, projectId:a.project_id,
          date:a.date, checkInAt:a.check_in_at, checkOutAt:a.check_out_at,
          checkInGPS:a.check_in_gps, checkOutGPS:a.check_out_gps
        })),
        leaves: (leaves || []).map(l => ({
          id:l.id, userId:l.user_id, companyId:l.company_id, type:l.leave_type,
          start:l.from_date, end:l.to_date, reason:l.reason, status:l.status
        }))
      };

      localStorage.setItem(KEY, JSON.stringify(db));
      sessionStorage.setItem('ztrend_session_' + portal, user.id);
      if (portal === 'user') localStorage.setItem('ztrend_user_device_session', user.id);
      window.location.reload();
    } catch (error) {
      console.error('ZTREND cloud sign-in failed:', error);
      if (errorBox) {
        errorBox.textContent = error?.message || 'Sign in failed. Please try again.';
        errorBox.style.display = 'block';
      }
      if (button) {
        button.disabled = false;
        button.innerHTML = 'Sign in <span>→</span>';
      }
      signingIn = false;
    }
  }


  // Let the account owner request a Supabase-hosted recovery email from the login page.
  function installForgotPassword() {
  const form = document.querySelector('#signinForm');
    const email = document.querySelector('#email');
    const errorBox = document.querySelector('#err');
    if (!form || document.getElementById('ztrendForgotPassword')) return;
    const link = document.createElement('button');
    link.type = 'button';
    link.id = 'ztrendForgotPassword';
    link.textContent = 'Forgot password?';
    link.style.cssText = 'display:block;margin:14px 0 0 auto;padding:6px 0;border:0;background:transparent;color:#168d91;font:inherit;font-size:14px;font-weight:600;cursor:pointer;';
    form.appendChild(link);
    link.addEventListener('click', async () => {
      const address = (email?.value || '').trim();
      if (!address || !address.includes('@')) {
        if (errorBox) errorBox.textContent = 'Pehle apna registered email address enter karo.';
        email?.focus();
        return;
      }
      link.disabled = true;
      link.textContent = 'Sending recovery email…';
      if (errorBox) errorBox.textContent = '';
      try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await client.auth.resetPasswordForEmail(address, { redirectTo });
        if (error) throw error;
        if (errorBox) errorBox.textContent = 'Recovery email request bhej di gayi hai. Inbox/spam check karo; link se naya password set karo.';
      } catch (error) {
        if (errorBox) errorBox.textContent = error?.message || 'Recovery email send nahi ho saki.';
      } finally {
        link.disabled = false;
        link.textContent = 'Forgot password?';
      }
    });
  }

  installForgotPassword();

  // Password recovery: render a focused reset form when Supabase returns a recovery session.
  function showPasswordRecovery() {
    const app = document.querySelector('#app');
    if (!app || document.getElementById('ztrendRecoveryPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'ztrendRecoveryPanel';
    panel.style.cssText = 'min-height:100vh;display:grid;place-items:center;padding:24px;background:#101d32;color:#f7f9fc;font-family:inherit;';
    panel.innerHTML = `
      <div style="width:min(100%,430px);box-sizing:border-box;padding:32px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#172740;box-shadow:0 24px 70px rgba(0,0,0,.28)">
        <div style="font-size:12px;letter-spacing:2px;color:#9db2cc;margin-bottom:12px">ZTREND WORKFORCE</div>
        <h1 style="font-size:25px;margin:0 0 8px">Set a new password</h1>
        <p style="color:#aebed2;margin:0 0 24px;line-height:1.5">Choose a new password for your Developer account.</p>
        <form id="ztrendRecoveryForm">
          <label for="ztrendNewPassword" style="display:block;margin:0 0 8px">New password</label>
          <input id="ztrendNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters" style="box-sizing:border-box;width:100%;padding:14px;border-radius:10px;border:1px solid #52657d;background:#0e1a2b;color:white;margin-bottom:16px">
          <label for="ztrendConfirmPassword" style="display:block;margin:0 0 8px">Confirm new password</label>
          <input id="ztrendConfirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Enter password again" style="box-sizing:border-box;width:100%;padding:14px;border-radius:10px;border:1px solid #52657d;background:#0e1a2b;color:white;margin-bottom:18px">
          <button id="ztrendSavePassword" type="submit" style="width:100%;padding:14px;border:0;border-radius:10px;background:#38bdf8;color:#071525;font-weight:700;font-size:15px">Update password</button>
          <p id="ztrendRecoveryMessage" role="alert" style="margin:14px 0 0;line-height:1.5;color:#fca5a5"></p>
        </form>
      </div>`;
    app.replaceChildren(panel);
    const form = panel.querySelector('#ztrendRecoveryForm');
    const msg = panel.querySelector('#ztrendRecoveryMessage');
    const save = panel.querySelector('#ztrendSavePassword');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = panel.querySelector('#ztrendNewPassword').value;
      const confirm = panel.querySelector('#ztrendConfirmPassword').value;
      msg.style.color = '#fca5a5';
      if (password.length < 8) { msg.textContent = 'Password must be at least 8 characters.'; return; }
      if (password !== confirm) { msg.textContent = 'Passwords do not match.'; return; }
      save.disabled = true;
      save.textContent = 'Updating…';
      msg.textContent = '';
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        msg.style.color = '#86efac';
        msg.textContent = 'Password updated successfully. You can now sign in with your new password.';
        form.querySelectorAll('input').forEach(input => input.disabled = true);
        save.textContent = 'Password updated';
        const back = document.createElement('a');
        back.href = window.location.pathname;
        back.textContent = 'Return to Developer login';
        back.style.cssText = 'display:block;text-align:center;margin-top:18px;color:#7dd3fc;text-decoration:none';
        form.appendChild(back);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        msg.textContent = error?.message || 'Password update failed. Request a new recovery email.';
        save.disabled = false;
        save.textContent = 'Update password';
      }
    });
  }

  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showPasswordRecovery();
  });
  if (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
    client.auth.getSession().then(({ data }) => {
      if (data?.session) showPasswordRecovery();
      else {
        const errorBox = document.querySelector('#err');
        if (errorBox) errorBox.textContent = 'Recovery link is invalid or expired. Request a new password recovery email.';
      }
    });
  }

  const form = document.querySelector('#signinForm');
  const button = document.querySelector('#signin');
  if (form && button) {
    // Use one submission path for mouse, touch, and Enter.
    // app.js installs a legacy onclick handler; clear it so only cloud auth runs.
    button.onclick = null;
    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      signIn();
    }, true);
  }
})();
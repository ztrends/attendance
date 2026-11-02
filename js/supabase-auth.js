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

  async function signIn() {
    const button = document.querySelector('#signin');
    const errorBox = document.querySelector('#err');
    const identifier = document.querySelector('#email')?.value.trim();
    const password = document.querySelector('#password')?.value || '';
    if (!identifier || !password) {
      errorBox.textContent = 'Enter your login ID and password.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Signing in…';
    errorBox.textContent = '';

    try {
      const { data: loginData, error: loginError } = await client.functions.invoke(
        'employee-login',
        { body: { identifier, password } }
      );
      if (loginError || !loginData?.access_token || !loginData?.refresh_token) {
        throw new Error(loginData?.error || loginError?.message || 'Invalid login details.');
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
      if (errorBox) errorBox.textContent = error?.message || 'Sign in failed. Please try again.';
      button.disabled = false;
      button.innerHTML = 'Sign in <span>→</span>';
    }
  }

  const form = document.querySelector('#signinForm');
  const button = document.querySelector('#signin');
  if (form && button) {
    // Use one handler for click and Enter; bypass the legacy local-only handler.
    button.onclick = null;
    form.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      signIn();
    });
  }
})();
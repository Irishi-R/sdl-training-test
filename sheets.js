// All API communication with Google Apps Script

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('secret', CONFIG.SECRET_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('Server error ' + res.status);
  return res.json();
}

async function apiPost(data) {
  // Content-Type: text/plain avoids CORS preflight — required for Apps Script
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ ...data, secret: CONFIG.SECRET_KEY })
  });
  if (!res.ok) throw new Error('Server error ' + res.status);
  return res.json();
}

const SheetsAPI = {
  verifyStudent:      (studentId) => apiGet('verifyStudent', { studentId }),
  getCourse:          (courseId)  => apiGet('getCourse', { courseId }),
  getCompletedCourses:(studentId) => apiGet('getCompletedCourses', { studentId }),
  saveResponse:       (data)      => apiPost({ action: 'saveResponse', ...data })
};

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  courseId:      null,
  student:       null,
  course:        null,
  preAnswers:    [],
  postAnswers:   [],
  ytPlayer:      null,
  pollInterval:  null,
  fallbackTimer: null,
  playStarted:   false,
  videoWatched:  false,
  videoPercent:  0
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(window.location.search);
  state.courseId = params.get('course');

  if (!state.courseId) {
    showError('No course link detected. Please use the full link sent to you on WhatsApp.');
    return;
  }

  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.includes('YOUR_')) {
    showError('Platform not yet configured. Please contact your administrator.');
    return;
  }

  try {
    const result = await SheetsAPI.getCourse(state.courseId);
    if (!result.success) {
      showError('Course not found. Please check your WhatsApp link and try again.');
      return;
    }
    state.course = result.course;
    document.getElementById('course-name-title').textContent   = state.course.name;
    document.getElementById('course-category-badge').textContent = state.course.category;
    showScreen('id-entry');
  } catch (e) {
    showError('Could not connect to the server. Please check your internet and try again.');
  }
}

// ─── Screen management ────────────────────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-' + name).classList.remove('hidden');
  window.scrollTo(0, 0);
}

function showError(msg) {
  document.getElementById('error-message').textContent = msg;
  showScreen('error');
}

// ─── Student ID verification ──────────────────────────────────────────────────

async function verifyStudentId() {
  const input   = document.getElementById('student-id-input');
  const errorEl = document.getElementById('id-field-error');
  const btn     = document.getElementById('verify-btn');
  const studentId = input.value.trim().toUpperCase();

  if (!studentId) {
    setFieldError(errorEl, 'Please enter your Student ID.');
    return;
  }

  btn.disabled     = true;
  btn.textContent  = 'Verifying...';
  clearFieldError(errorEl);

  try {
    const result = await SheetsAPI.verifyStudent(studentId);
    if (result.success) {
      state.student = result.student;
      showPreQuestions();
    } else {
      setFieldError(errorEl, 'Student ID not found. Please check and try again.');
      btn.disabled    = false;
      btn.textContent = 'Verify & Continue';
      input.focus();
    }
  } catch (e) {
    setFieldError(errorEl, 'Connection error. Please check your internet and try again.');
    btn.disabled    = false;
    btn.textContent = 'Verify & Continue';
  }
}

// ─── Question rendering ───────────────────────────────────────────────────────

function renderQuestions(questions, container, prefix) {
  container.innerHTML = '';

  questions.forEach((q, i) => {
    const fieldName = `${prefix}_q${i + 1}`;
    const div = document.createElement('div');
    div.className      = 'question-block';
    div.dataset.index  = i;
    div.dataset.type   = q.type;

    let inputsHtml = '';

    if (q.type === 'mcq') {
      inputsHtml = q.options.map(opt => `
        <label class="option-label">
          <input type="radio" name="${fieldName}" value="${esc(opt)}">
          <span class="option-text">${esc(opt)}</span>
        </label>`).join('');

    } else if (q.type === 'multiselect') {
      inputsHtml = q.options.map(opt => `
        <label class="option-label">
          <input type="checkbox" name="${fieldName}" value="${esc(opt)}">
          <span class="option-text">${esc(opt)}</span>
        </label>`).join('');

    } else if (q.type === 'text') {
      inputsHtml = `<textarea class="text-input" name="${fieldName}" rows="3" placeholder="Type your answer here..."></textarea>`;

    } else if (q.type === 'rating') {
      inputsHtml = `
        <div class="rating-row" data-field="${fieldName}">
          ${[1,2,3,4,5].map(v => `<button type="button" class="rating-btn" data-value="${v}">${v}</button>`).join('')}
        </div>
        <div class="rating-labels"><span>Not at all</span><span>Very much</span></div>
        <input type="hidden" name="${fieldName}" id="hidden_${fieldName}">`;
    }

    div.innerHTML = `
      <div class="q-header">
        <span class="q-num">Q${i + 1}</span>
        <p class="q-text">${esc(q.text)}</p>
      </div>
      <div class="q-inputs">${inputsHtml}</div>
      <p class="field-error hidden" id="err_${fieldName}">Please answer this question.</p>`;

    container.appendChild(div);
  });

  // Visual feedback: highlight selected options
  container.querySelectorAll('.option-label input').forEach(input => {
    input.addEventListener('change', function () {
      if (this.type === 'radio') {
        container.querySelectorAll(`input[name="${this.name}"]`)
          .forEach(s => s.closest('.option-label').classList.remove('selected'));
      }
      this.closest('.option-label').classList.toggle('selected', this.checked);
    });
  });

  // Rating buttons
  container.querySelectorAll('.rating-row').forEach(row => {
    row.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        row.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('hidden_' + row.dataset.field).value = this.dataset.value;
      });
    });
  });
}

function collectAnswers(container, questions, prefix) {
  return questions.map((q, i) => {
    const fieldName = `${prefix}_q${i + 1}`;

    if (q.type === 'mcq') {
      const el = container.querySelector(`input[name="${fieldName}"]:checked`);
      return el ? el.value : '';
    }
    if (q.type === 'multiselect') {
      return Array.from(container.querySelectorAll(`input[name="${fieldName}"]:checked`))
        .map(e => e.value).join(' | ');
    }
    if (q.type === 'text') {
      const el = container.querySelector(`textarea[name="${fieldName}"]`);
      return el ? el.value.trim() : '';
    }
    if (q.type === 'rating') {
      const el = document.getElementById(`hidden_${fieldName}`);
      return el ? el.value : '';
    }
    return '';
  });
}

function validateAnswers(container, questions, prefix) {
  let valid        = true;
  let firstInvalid = null;

  questions.forEach((q, i) => {
    const fieldName = `${prefix}_q${i + 1}`;
    const errorEl   = document.getElementById(`err_${fieldName}`);
    let answered    = false;

    if (q.type === 'mcq') {
      answered = !!container.querySelector(`input[name="${fieldName}"]:checked`);
    } else if (q.type === 'multiselect') {
      answered = container.querySelectorAll(`input[name="${fieldName}"]:checked`).length > 0;
    } else if (q.type === 'text') {
      const el = container.querySelector(`textarea[name="${fieldName}"]`);
      answered = el && el.value.trim().length > 0;
    } else if (q.type === 'rating') {
      const el = document.getElementById(`hidden_${fieldName}`);
      answered = el && el.value !== '';
    }

    if (!answered) {
      errorEl.classList.remove('hidden');
      if (!firstInvalid) firstInvalid = container.querySelector(`[data-index="${i}"]`);
      valid = false;
    } else {
      errorEl.classList.add('hidden');
    }
  });

  if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return valid;
}

// ─── Pre-course questions ─────────────────────────────────────────────────────

function showPreQuestions() {
  renderQuestions(
    state.course.preQuestions,
    document.getElementById('pre-questions-container'),
    'pre'
  );
  showScreen('pre-questions');
}

function submitPreQuestions() {
  const container = document.getElementById('pre-questions-container');
  if (!validateAnswers(container, state.course.preQuestions, 'pre')) return;
  state.preAnswers = collectAnswers(container, state.course.preQuestions, 'pre');
  showVideoScreen();
}

// ─── Video screen ─────────────────────────────────────────────────────────────

async function showVideoScreen() {
  showScreen('video');
  document.getElementById('video-course-name').textContent = state.course.name;

  try {
    await loadYouTubeAPI();
    initYouTubePlayer(state.course.videoUrl);
  } catch (e) {
    document.getElementById('yt-player-wrap').innerHTML =
      '<p class="video-error">Video could not be loaded. Please check your internet and reload the page.</p>';
    setWatchStatus('Video failed to load — please reload the page.');
  }
}

function loadYouTubeAPI() {
  return new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) { resolve(); return; }

    let settled = false;

    window.onYouTubeIframeAPIReady = () => {
      settled = true;
      resolve();
    };

    const tag  = document.createElement('script');
    tag.src    = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => { if (!settled) { settled = true; reject(new Error('YouTube API failed to load')); } };
    document.head.appendChild(tag);

    setTimeout(() => { if (!settled) { settled = true; reject(new Error('YouTube API timed out')); } }, 12000);
  });
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function initYouTubePlayer(videoUrl) {
  const videoId = extractYouTubeId(videoUrl);

  if (!videoId) {
    document.getElementById('yt-player-wrap').innerHTML =
      '<p class="video-error">Video URL is not configured yet. Please contact your administrator.</p>';
    return;
  }

  state.ytPlayer = new YT.Player('yt-player', {
    videoId,
    playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onStateChange: onPlayerStateChange,
      onError:       onPlayerError
    }
  });
}

function onPlayerStateChange(event) {
  // 1 = PLAYING, 0 = ENDED
  if (event.data === 1 && !state.playStarted) {
    state.playStarted = true;
    setWatchStatus('0% watched — please finish the video');
    startVideoPolling();
  }
  if (event.data === 0) {
    // ENDED event fired (works reliably on Android + desktop)
    onVideoComplete();
  }
}

function onPlayerError() {
  setWatchStatus('Video error — please reload the page.');
}

function startVideoPolling() {
  // Poll every 2 seconds — primary completion detection for all platforms.
  // Falls back to a timer if getDuration() never returns a valid value (rare iOS edge case).
  let apiFails = 0;

  state.pollInterval = setInterval(() => {
    if (!state.ytPlayer || state.videoWatched) {
      clearInterval(state.pollInterval);
      return;
    }

    try {
      const current  = state.ytPlayer.getCurrentTime();
      const duration = state.ytPlayer.getDuration();
      const pState   = state.ytPlayer.getPlayerState();

      if (pState === 0) { onVideoComplete(); return; } // ENDED via poll

      if (duration > 0) {
        apiFails = 0;
        const pct = Math.min(99, Math.floor((current / duration) * 100));
        state.videoPercent = pct;
        setWatchStatus(pct < 95
          ? `${pct}% watched — please finish the video`
          : 'Almost done...'
        );
        if (current / duration >= 0.95) onVideoComplete();
      } else {
        apiFails++;
        // After 30 s of no duration data, start a 3-min fallback timer.
        // This only triggers when the YouTube API is completely non-responsive (rare on iOS).
        if (apiFails === 15) {
          setWatchStatus('Watching...');
          state.fallbackTimer = setTimeout(onVideoComplete, 180000);
          clearInterval(state.pollInterval);
        }
      }
    } catch (e) {
      // Player not ready yet — ignore
    }
  }, 2000);
}

function onVideoComplete() {
  if (state.videoWatched) return;
  state.videoWatched = true;
  if (state.videoPercent >= 95) state.videoPercent = 100;
  clearInterval(state.pollInterval);
  clearTimeout(state.fallbackTimer);

  const btn = document.getElementById('video-done-btn');
  btn.disabled    = false;
  btn.textContent = "I've Finished Watching — Continue →";
  btn.classList.add('unlocked');
  setWatchStatus('Video complete! Tap the button above to continue.');
}

function setWatchStatus(msg) {
  document.getElementById('video-watch-status').textContent = msg;
}

// ─── Post-course questions ────────────────────────────────────────────────────

function showPostQuestions() {
  renderQuestions(
    state.course.postQuestions,
    document.getElementById('post-questions-container'),
    'post'
  );
  showScreen('post-questions');
}

// ─── Submission ───────────────────────────────────────────────────────────────

async function submitResponse() {
  const container = document.getElementById('post-questions-container');
  if (!validateAnswers(container, state.course.postQuestions, 'post')) return;

  state.postAnswers = collectAnswers(container, state.course.postQuestions, 'post');

  const btn       = document.getElementById('post-submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Submitting...';
  showScreen('submitting');

  const payload = {
    studentId:    state.student.id,
    studentName:  state.student.name,
    studentSchool:state.student.school,
    courseId:     state.course.id,
    courseName:   state.course.name,
    category:     state.course.category,
    preAnswers:   state.preAnswers,
    postAnswers:  state.postAnswers,
    videoPercent: state.videoPercent
  };

  // Cache answers locally so they survive a network blip
  localStorage.setItem('sdl_pending', JSON.stringify(payload));

  try {
    const result = await SheetsAPI.saveResponse(payload);
    if (!result.success) throw new Error(result.error || 'Save failed');
    localStorage.removeItem('sdl_pending');
    await showCompletionScreen();
  } catch (e) {
    // Show error but don't lose the screen — data is in localStorage
    showError(
      'Your answers could not be saved. Do not close this page. ' +
      'Please check your internet connection and tap the back button to try submitting again.'
    );
    btn.disabled    = false;
    btn.textContent = 'Submit & Complete';
  }
}

// ─── Completion ───────────────────────────────────────────────────────────────

async function showCompletionScreen() {
  document.getElementById('completion-name').textContent   = state.student.name;
  document.getElementById('completion-school').textContent = state.student.school;
  document.getElementById('completion-course').textContent = state.course.name;
  showScreen('completion');

  try {
    const result = await SheetsAPI.getCompletedCourses(state.student.id);
    if (result.success && result.courses.length > 0) {
      renderCompletedCourses(result.courses);
    } else {
      document.getElementById('completed-courses-section').classList.add('hidden');
    }
  } catch (e) {
    document.getElementById('completed-courses-section').classList.add('hidden');
  }
}

function renderCompletedCourses(courses) {
  // Deduplicate: keep first occurrence of each courseId (earliest submission)
  const seen    = new Set();
  const grouped = {};

  courses.forEach(c => {
    if (seen.has(c.courseId)) return;
    seen.add(c.courseId);
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });

  const list = document.getElementById('completed-courses-list');
  list.innerHTML = '';

  Object.entries(grouped).forEach(([category, items]) => {
    const grp = document.createElement('div');
    grp.className = 'cat-group';
    grp.innerHTML = `<div class="cat-label">${esc(category)}</div>`;

    items.forEach(c => {
      const item     = document.createElement('div');
      item.className = 'course-item';
      item.innerHTML = `<span class="tick">✓</span><span>${esc(c.courseName)}</span>`;
      grp.appendChild(item);
    });

    list.appendChild(grp);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setFieldError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearFieldError(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('verify-btn')
    .addEventListener('click', verifyStudentId);

  document.getElementById('student-id-input')
    .addEventListener('keydown', e => { if (e.key === 'Enter') verifyStudentId(); });

  document.getElementById('pre-submit-btn')
    .addEventListener('click', submitPreQuestions);

  document.getElementById('video-done-btn')
    .addEventListener('click', showPostQuestions);

  document.getElementById('post-submit-btn')
    .addEventListener('click', submitResponse);

  init();
});

# SDL Training Platform — Testing Notes

## Current Status
**Phase:** Testing (Demo build)
**Hosting:** GitHub Pages (temporary)
**Approval pending before:** Final production build

---

## Live URLs

| Page | URL |
|------|-----|
| Homepage (course catalog) | `https://irishi-r.github.io/sdl-training-test/home.html` |
| Course — Fire Safety | `https://irishi-r.github.io/sdl-training-test/index.html?course=C001` |
| Course — First Aid Basics | `https://irishi-r.github.io/sdl-training-test/index.html?course=C002` |
| Course — Communication Skills | `https://irishi-r.github.io/sdl-training-test/index.html?course=C003` |
| Course — Teamwork Essentials | `https://irishi-r.github.io/sdl-training-test/index.html?course=C004` |
| Course — Machine Operation Safety | `https://irishi-r.github.io/sdl-training-test/index.html?course=C005` |

---

## Test Credentials

| Student ID | Name | School |
|------------|------|--------|
| STU001 | Ravi Kumar | St. Johns School |
| STU002 | Priya Singh | Delhi Public School |
| STU003 | Arjun Mehta | Kendriya Vidyalaya |
| STU004 | Sunita Patel | Modern School |
| STU005 | Rahul Sharma | St. Marys School |
| STU006 | Anjali Nair | Presidency School |
| STU007 | Vikram Joshi | Ryan International |
| STU008 | Meera Reddy | Lotus Valley School |

Use `STU999` to test invalid ID rejection.

---

## What's Built

### Files
| File | Purpose |
|------|---------|
| `index.html` | Full course flow (ID entry → pre-quiz → video → post-quiz → completion) |
| `home.html` | Course catalog homepage — shows all courses grouped by category |
| `style.css` | Mobile-first styling shared across both pages |
| `app.js` | All course flow logic |
| `sheets.js` | API calls to Google Apps Script |
| `config.js` | Apps Script URL and secret key |
| `apps-script/Code.gs` | Backend — reads/writes Google Sheets |

### Google Sheets
| Sheet | Purpose |
|-------|---------|
| Student Master List | 8 demo students (STU001–STU008) |
| Course Control Panel | 5 demo courses across 3 categories |
| Master Tracking Sheet | Auto-filled when students submit |

### Demo Courses
| ID | Course | Category |
|----|--------|----------|
| C001 | Fire Safety | Safety Training |
| C002 | First Aid Basics | Safety Training |
| C003 | Communication Skills | Soft Skills |
| C004 | Teamwork Essentials | Soft Skills |
| C005 | Machine Operation Safety | Technical Skills |

### Question types per course
Each course has 4 pre-course + 4 post-course questions covering:
- Q1: MCQ (single choice)
- Q2: Multi-select
- Q3: Free text
- Q4: Rating scale (1–5)

---

## What to Test

- [ ] Homepage loads and shows all 5 courses grouped correctly
- [ ] Valid student ID (e.g. STU001) is accepted and name/school auto-filled
- [ ] Invalid student ID (e.g. STU999) is rejected with a friendly error
- [ ] All 4 question types render and validate correctly on mobile
- [ ] Cannot proceed without answering all questions
- [ ] YouTube video loads and plays
- [ ] "Finish the video" button stays disabled until video is complete
- [ ] Post-quiz appears after video
- [ ] Submission saves correctly to Master Tracking Sheet in Google Sheets
- [ ] Completion screen shows student name and completed course
- [ ] Completed courses summary appears below (grouped by category)
- [ ] Full flow works on Android WhatsApp in-app browser
- [ ] Full flow works on iOS WhatsApp in-app browser
- [ ] Homepage course cards link to correct course pages

---

## Known Gaps in This Demo Build

1. **YouTube videos are placeholders** — all courses have `VIDEO_ID_HERE` as the video URL. Real URLs to be added before final build.

2. **No video % tracking** — the app tracks % internally but does not save it to the sheet. To be added in final build.

3. **No dropout tracking** — only completed submissions are saved. Students who finish pre-quiz but don't complete the video/post-quiz are not tracked. To be added in final build.

4. **No group/teacher filtering** — all students see all courses. Group-based filtering (show only relevant courses per group) to be added in final build.

5. **Secret key is in public config.js** — acceptable for demo but noted. For production, consider restricting Sheet access further.

6. **No duplicate submission prevention** — a student can submit the same course multiple times. Each submission creates a new row in the tracking sheet.

---

## Planned for Final Build

### Must have before go-live
- [ ] Replace placeholder YouTube URLs with real video URLs
- [ ] Replace demo student data with real 2000 students
- [ ] Video % watched saved to tracking sheet
- [ ] Pre-assessment saved separately at pre-submit (not only on full completion) — enables dropout tracking
- [ ] Move to Cloudflare Pages (from GitHub Pages)
- [ ] Test thoroughly on iOS and Android WhatsApp in-app browsers

### Nice to have
- [ ] Group-based course filtering (show courses only relevant to each student's group)
- [ ] Prevent duplicate submissions (or flag them in the sheet)
- [ ] Custom domain

### Out of scope for now (post go-live)
- Student self-registration flow
- Full 56-course rollout
- Admin dashboard with completion rates

---

## Tech Stack

| Component | Tool | Cost |
|-----------|------|------|
| Frontend | HTML, CSS, Vanilla JS | Free |
| Hosting (test) | GitHub Pages | Free |
| Hosting (final) | Cloudflare Pages | Free |
| Video | YouTube (unlisted) | Free |
| Data storage | Google Sheets | Free |
| Backend API | Google Apps Script | Free |
| Delivery | WhatsApp links | Free |

**Total cost: Zero**

---

## Changes Needed in Google Sheets Before Final Build

1. **Course Control Panel** — replace `VIDEO_ID_HERE` in Column D with real YouTube URLs
2. **Student Master List** — replace 8 demo students with actual student data
3. **Master Tracking Sheet** — clear any test submissions before go-live

---

## Notes / Decisions Made

- YouTube video completion detected via polling (getCurrentTime / getDuration every 2s) — more reliable than the ENDED event which fails on iOS WhatsApp
- Student ID is normalised to uppercase before lookup — prevents case mismatch errors
- POST submissions use `Content-Type: text/plain` to avoid CORS preflight issues with Google Apps Script
- Answers are cached in localStorage before submission — prevents data loss on network drop
- Apps Script secret key acts as spam filter only, not true security

---

*Last updated: Testing phase — pending approval*

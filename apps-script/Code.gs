// ─────────────────────────────────────────────────────────────────────────────
// SDL Training Platform — Google Apps Script backend
//
// SETUP:
//   1. Replace YOUR_SPREADSHEET_ID_HERE with your actual Spreadsheet ID
//   2. Save (Ctrl+S)
//   3. Run setupDemoData() once to create all sheets and fill demo data
//   4. Deploy > New Deployment > Web App
//      Execute as: Me  |  Who has access: Anyone (even anonymous)
//   5. Copy the Web App URL into config.js
// ─────────────────────────────────────────────────────────────────────────────

var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
var SECRET_KEY     = 'SDL_DEMO_2024'; // Must match config.js

var SHEET_STUDENTS = 'Student Master List';
var SHEET_COURSES  = 'Course Control Panel';
var SHEET_TRACKING = 'Master Tracking Sheet';

// ─── Request routing ──────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var p = e.parameter;
    if (p.secret !== SECRET_KEY) return out({success: false, error: 'Unauthorized'});

    if (p.action === 'verifyStudent')       return out(verifyStudent(p.studentId));
    if (p.action === 'getCourse')           return out(getCourse(p.courseId));
    if (p.action === 'getCompletedCourses') return out(getCompletedCourses(p.studentId));
    if (p.action === 'getAllCourses')        return out(getAllCourses());

    return out({success: false, error: 'Unknown action: ' + p.action});
  } catch (err) {
    return out({success: false, error: err.message});
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET_KEY) return out({success: false, error: 'Unauthorized'});

    if (data.action === 'saveStarted')   return out(saveStarted(data));
    if (data.action === 'saveCompleted') return out(saveCompleted(data));

    return out({success: false, error: 'Unknown action: ' + data.action});
  } catch (err) {
    return out({success: false, error: err.message});
  }
}

function out(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Sheet helper ─────────────────────────────────────────────────────────────

function getSheet(name) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found. Run setupDemoData() first.');
  return sheet;
}

// ─── verifyStudent ────────────────────────────────────────────────────────────

function verifyStudent(studentId) {
  if (!studentId) return {success: false, error: 'Student ID is required'};

  var id   = String(studentId).trim().toUpperCase();
  var rows = getSheet(SHEET_STUDENTS).getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === id) {
      return {
        success: true,
        student: {
          id:     String(rows[i][0]),
          name:   String(rows[i][1]),
          school: String(rows[i][2]),
          phone:  String(rows[i][3])
        }
      };
    }
  }
  return {success: false, error: 'Student ID not found'};
}

// ─── getCourse ────────────────────────────────────────────────────────────────
// Column layout (0-indexed):
//   0  Course ID          1  Category           2  Course Name        3  Video URL
//   4  Pre Q1 Text        5  Pre Q1 Type        6  Pre Q1 Options
//   7  Pre Q2 Text        8  Pre Q2 Type        9  Pre Q2 Options
//   10 Pre Q3 Text        11 Pre Q3 Type        12 Pre Q3 Options
//   13 Pre Q4 Text        14 Pre Q4 Type        15 Pre Q4 Options
//   16 Post Q1 Text       17 Post Q1 Type       18 Post Q1 Options
//   19 Post Q2 Text       20 Post Q2 Type       21 Post Q2 Options
//   22 Post Q3 Text       23 Post Q3 Type       24 Post Q3 Options
//   25 Post Q4 Text       26 Post Q4 Type       27 Post Q4 Options

function getCourse(courseId) {
  if (!courseId) return {success: false, error: 'Course ID is required'};

  var id   = String(courseId).trim();
  var rows = getSheet(SHEET_COURSES).getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== id) continue;

    var row  = rows[i];
    var pre  = [];
    var post = [];

    for (var q = 0; q < 4; q++) {
      var pOff = 4  + q * 3;
      var rOff = 16 + q * 3;

      if (row[pOff]) {
        pre.push({
          text:    String(row[pOff]),
          type:    String(row[pOff + 1]).trim().toLowerCase(),
          options: row[pOff + 2]
            ? String(row[pOff + 2]).split('|').map(function(s){ return s.trim(); }).filter(Boolean)
            : []
        });
      }
      if (row[rOff]) {
        post.push({
          text:    String(row[rOff]),
          type:    String(row[rOff + 1]).trim().toLowerCase(),
          options: row[rOff + 2]
            ? String(row[rOff + 2]).split('|').map(function(s){ return s.trim(); }).filter(Boolean)
            : []
        });
      }
    }

    return {
      success: true,
      course: {
        id:            String(row[0]),
        category:      String(row[1]),
        name:          String(row[2]),
        videoUrl:      String(row[3]),
        preQuestions:  pre,
        postQuestions: post
      }
    };
  }
  return {success: false, error: 'Course not found'};
}

// ─── Tracking sheet column layout (1-indexed for getRange, 0-indexed for arrays)
//
//  Col 1  (idx 0)  Submission ID
//  Col 2  (idx 1)  Status           — Started | Completed
//  Col 3  (idx 2)  Student ID
//  Col 4  (idx 3)  Name
//  Col 5  (idx 4)  School
//  Col 6  (idx 5)  Course ID
//  Col 7  (idx 6)  Course Name
//  Col 8  (idx 7)  Category
//  Col 9  (idx 8)  Started At
//  Col 10 (idx 9)  Completed At
//  Col 11 (idx 10) Resumed          — Yes | No  (blank while Started)
//  Col 12 (idx 11) Video % Watched  (blank while Started)
//  Col 13 (idx 12) Pre Q1
//  Col 14 (idx 13) Pre Q2
//  Col 15 (idx 14) Pre Q3
//  Col 16 (idx 15) Pre Q4
//  Col 17 (idx 16) Post Q1          (blank while Started)
//  Col 18 (idx 17) Post Q2
//  Col 19 (idx 18) Post Q3
//  Col 20 (idx 19) Post Q4

function ensureTrackingHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Submission ID', 'Status', 'Student ID', 'Name', 'School',
      'Course ID', 'Course Name', 'Category',
      'Started At', 'Completed At', 'Resumed', 'Video % Watched',
      'Pre Q1', 'Pre Q2', 'Pre Q3', 'Pre Q4',
      'Post Q1', 'Post Q2', 'Post Q3', 'Post Q4'
    ]);
  }
}

// ─── saveStarted ─────────────────────────────────────────────────────────────
// Called when student submits the pre-assessment. Creates a "Started" row.

function saveStarted(data) {
  var sheet = getSheet(SHEET_TRACKING);
  ensureTrackingHeaders(sheet);

  var subId = 'SUB' + new Date().getTime();
  var pre   = data.preAnswers || [];
  var ts    = new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'});

  sheet.appendRow([
    subId, 'Started',
    data.studentId, data.studentName, data.studentSchool,
    data.courseId, data.courseName, data.category,
    ts, '', '', '',
    pre[0] || '', pre[1] || '', pre[2] || '', pre[3] || '',
    '', '', '', ''
  ]);

  return {success: true, submissionId: subId};
}

// ─── saveCompleted ────────────────────────────────────────────────────────────
// Called on final submission. Finds the "Started" row by submissionId and
// updates it to "Completed". Falls back to appending a full row if not found.

function saveCompleted(data) {
  var sheet = getSheet(SHEET_TRACKING);
  ensureTrackingHeaders(sheet);

  var ts   = new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'});
  var post = data.postAnswers || [];
  var pre  = data.preAnswers  || [];
  var pct  = (data.videoPercent !== undefined) ? data.videoPercent + '%' : '';

  // Find the row matching the submissionId
  if (data.submissionId && !String(data.submissionId).startsWith('LOCAL_')) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.submissionId)) {
        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          var rowRange  = sheet.getRange(i + 1, 1, 1, 20);
          var rowValues = rowRange.getValues()[0];

          rowValues[1]  = 'Completed';
          rowValues[9]  = ts;
          rowValues[10] = data.resumed ? 'Yes' : 'No';
          rowValues[11] = pct;
          rowValues[16] = post[0] || '';
          rowValues[17] = post[1] || '';
          rowValues[18] = post[2] || '';
          rowValues[19] = post[3] || '';

          rowRange.setValues([rowValues]);
        } finally {
          lock.releaseLock();
        }
        return {success: true, submissionId: data.submissionId};
      }
    }
  }

  // Fallback: append a complete Completed row so no data is ever lost
  var subId = data.submissionId || ('SUB' + new Date().getTime());
  sheet.appendRow([
    subId, 'Completed',
    data.studentId, data.studentName, data.studentSchool,
    data.courseId, data.courseName, data.category,
    ts, ts,
    data.resumed ? 'Yes' : 'No', pct,
    pre[0] || '', pre[1] || '', pre[2] || '', pre[3] || '',
    post[0] || '', post[1] || '', post[2] || '', post[3] || ''
  ]);

  return {success: true, submissionId: subId, fallback: true};
}

// ─── getCompletedCourses ──────────────────────────────────────────────────────
// Returns only rows with Status = Completed for the given student.

function getCompletedCourses(studentId) {
  if (!studentId) return {success: true, courses: []};

  var id    = String(studentId).trim().toUpperCase();
  var sheet = getSheet(SHEET_TRACKING);
  if (sheet.getLastRow() <= 1) return {success: true, courses: []};

  var rows    = sheet.getDataRange().getValues();
  var courses = [];

  for (var i = 1; i < rows.length; i++) {
    var rowStudentId = String(rows[i][2]).trim().toUpperCase();
    var rowStatus    = String(rows[i][1]).trim();
    if (rowStudentId === id && rowStatus === 'Completed') {
      courses.push({
        courseId:    String(rows[i][5]),
        courseName:  String(rows[i][6]),
        category:    String(rows[i][7]),
        submittedAt: String(rows[i][9])  // Completed At
      });
    }
  }

  return {success: true, courses: courses};
}

// ─── getAllCourses ─────────────────────────────────────────────────────────────

function getAllCourses() {
  var rows    = getSheet(SHEET_COURSES).getDataRange().getValues();
  var courses = [];

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) {
      courses.push({
        id:       String(rows[i][0]),
        category: String(rows[i][1]),
        name:     String(rows[i][2])
      });
    }
  }
  return {success: true, courses: courses};
}

// ─────────────────────────────────────────────────────────────────────────────
// Run ONCE from the Apps Script editor to set up all sheets with demo data.
// Select this function in the dropdown and click Run.
// ─────────────────────────────────────────────────────────────────────────────

function setupDemoData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ── Sheet 1: Student Master List ─────────────────────────────────────────

  var s1 = ss.getSheetByName(SHEET_STUDENTS) || ss.insertSheet(SHEET_STUDENTS);
  s1.clearContents();
  s1.getRange(1, 1, 9, 4).setValues([
    ['Unique ID',  'Name',           'School',                  'Phone'],
    ['STU001',     'Ravi Kumar',     'St. Johns School',        '9876543210'],
    ['STU002',     'Priya Singh',    'Delhi Public School',     '9765432109'],
    ['STU003',     'Arjun Mehta',    'Kendriya Vidyalaya',      '9654321098'],
    ['STU004',     'Sunita Patel',   'Modern School',           '9543210987'],
    ['STU005',     'Rahul Sharma',   'St. Marys School',        '9432109876'],
    ['STU006',     'Anjali Nair',    'Presidency School',       '9321098765'],
    ['STU007',     'Vikram Joshi',   'Ryan International',      '9210987654'],
    ['STU008',     'Meera Reddy',    'Lotus Valley School',     '9109876543']
  ]);

  // ── Sheet 2: Course Control Panel ────────────────────────────────────────

  var s2 = ss.getSheetByName(SHEET_COURSES) || ss.insertSheet(SHEET_COURSES);
  s2.clearContents();

  var hdr = [
    'Course ID','Category','Course Name','Video URL',
    'Pre Q1 Text','Pre Q1 Type','Pre Q1 Options',
    'Pre Q2 Text','Pre Q2 Type','Pre Q2 Options',
    'Pre Q3 Text','Pre Q3 Type','Pre Q3 Options',
    'Pre Q4 Text','Pre Q4 Type','Pre Q4 Options',
    'Post Q1 Text','Post Q1 Type','Post Q1 Options',
    'Post Q2 Text','Post Q2 Type','Post Q2 Options',
    'Post Q3 Text','Post Q3 Type','Post Q3 Options',
    'Post Q4 Text','Post Q4 Type','Post Q4 Options'
  ];
  s2.getRange(1, 1, 1, hdr.length).setValues([hdr]);

  var courses = [
    ['C001','Safety Training','Fire Safety','https://www.youtube.com/watch?v=VIDEO_ID_HERE',
     'What is the primary purpose of a fire extinguisher?','mcq',
       'To prevent fires|To put out small fires|To call for help|To alert others',
     'Which of the following are fire hazards? Select all that apply.','multiselect',
       'Overloaded electrical outlets|Unattended candles|Open flames near combustibles|Blocked fire exits',
     'Describe what you would do if you discovered a fire in your workplace.','text','',
     'How would you rate your current fire safety knowledge? (1 = Very low, 5 = Very high)','rating','',
     'What does PASS stand for when using a fire extinguisher?','mcq',
       'Pull Aim Squeeze Sweep|Push Activate Spray Stop|Position Activate Suppress Secure|Press Alert Stand Signal',
     'Which actions should you take during a fire evacuation? Select all that apply.','multiselect',
       'Close doors as you leave|Follow marked evacuation routes|Alert colleagues on your way out|Use the nearest lift',
     'What are the three elements of the fire triangle?','text','',
     'How confident do you feel about responding to a fire emergency now? (1 = Not confident, 5 = Very confident)','rating',''],

    ['C002','Safety Training','First Aid Basics','https://www.youtube.com/watch?v=VIDEO_ID_HERE',
     'What does CPR stand for?','mcq',
       'Cardio Pulmonary Resuscitation|Critical Patient Response|Cardiac Pressure Relief|Controlled Pulse Recovery',
     'Which of the following are signs of a heart attack? Select all that apply.','multiselect',
       'Chest pain or discomfort|Shortness of breath|Pain in arm or jaw|Sudden fatigue or nausea',
     'Describe the steps you would take if you found someone unconscious.','text','',
     'How confident are you in your ability to provide first aid? (1 = Not confident, 5 = Very confident)','rating','',
     'What is the correct compression-to-breath ratio in adult CPR?','mcq',
       '30:2|15:2|20:2|10:1',
     'When should you call emergency services? Select all that apply.','multiselect',
       'When someone is unconscious|When someone cannot breathe|When someone is bleeding severely|When someone has a minor cut',
     'What does DRABC stand for in first aid?','text','',
     'How prepared do you feel to handle a medical emergency at work? (1 = Not prepared, 5 = Very prepared)','rating',''],

    ['C003','Soft Skills','Communication Skills','https://www.youtube.com/watch?v=VIDEO_ID_HERE',
     'What is the most important element of effective communication?','mcq',
       'Speaking loudly and clearly|Active listening|Using technical language|Talking frequently',
     'Which of the following are examples of non-verbal communication? Select all that apply.','multiselect',
       'Eye contact|Facial expressions|Body posture|Tone of voice',
     'Describe a time when poor communication caused a problem and how it could have been avoided.','text','',
     'How effective do you consider yourself as a communicator? (1 = Not effective, 5 = Very effective)','rating','',
     'Which listening technique involves repeating back what you heard to confirm understanding?','mcq',
       'Passive listening|Reflective listening|Selective listening|Critical listening',
     'What are key principles of assertive communication? Select all that apply.','multiselect',
       'Expressing your needs clearly|Respecting others views|Using I statements|Avoiding all disagreement',
     'What is one communication skill you would like to improve and why?','text','',
     'How much has this training improved your understanding of effective communication? (1 = Not at all, 5 = Greatly)','rating',''],

    ['C004','Soft Skills','Teamwork Essentials','https://www.youtube.com/watch?v=VIDEO_ID_HERE',
     'What is the most important factor for a successful team?','mcq',
       'Having the most skilled individuals|Clear communication and mutual trust|A strong leader who decides everything|Avoiding all conflict',
     'Which behaviours strengthen a team? Select all that apply.','multiselect',
       'Sharing credit for success|Communicating openly|Supporting teammates|Competing for individual recognition',
     'Describe a time you worked effectively in a team. What made it successful?','text','',
     'How well do you currently work in a team environment? (1 = Not well, 5 = Extremely well)','rating','',
     'What is the best way to handle conflict within a team?','mcq',
       'Ignore it and hope it resolves|Address it privately and respectfully|Escalate to management immediately|Side with the majority',
     'What responsibilities does every team member share? Select all that apply.','multiselect',
       'Meeting deadlines|Contributing ideas|Supporting others|Attending team meetings',
     'What is one change you can make to be a better team member starting from tomorrow?','text','',
     'How much did this training improve your approach to teamwork? (1 = Not at all, 5 = Significantly)','rating',''],

    ['C005','Technical Skills','Machine Operation Safety','https://www.youtube.com/watch?v=VIDEO_ID_HERE',
     'What should you do before operating any machine for the first time?','mcq',
       'Start it and figure it out|Read the manual and get proper training|Ask a nearby colleague|Skip training if it looks simple',
     'Which are essential PPE items for machine operation? Select all that apply.','multiselect',
       'Safety goggles|Steel-toed boots|Hearing protection|Loose gloves near rotating parts',
     'Describe the lockout/tagout (LOTO) procedure and explain why it is important.','text','',
     'How familiar are you with safe machine operation practices? (1 = Not familiar, 5 = Very familiar)','rating','',
     'What should you do if you noticed a machine malfunction during operation?','mcq',
       'Continue and report it later|Stop the machine immediately and report it|Attempt to fix it yourself|Ignore minor malfunctions',
     'Which checks should be done before operating machinery? Select all that apply.','multiselect',
       'Check for visible damage or wear|Ensure all guards are in place|Test the emergency stop|Remove guards for better access',
     'Why is it important to follow machine operation procedures even when they seem unnecessary?','text','',
     'How confident do you feel about safe machine operation after this training? (1 = Not confident, 5 = Very confident)','rating','']
  ];

  s2.getRange(2, 1, courses.length, hdr.length).setValues(courses);

  // ── Sheet 3: Master Tracking Sheet (new 20-column layout) ────────────────

  var s3 = ss.getSheetByName(SHEET_TRACKING) || ss.insertSheet(SHEET_TRACKING);
  s3.clearContents();
  s3.getRange(1, 1, 1, 20).setValues([[
    'Submission ID', 'Status', 'Student ID', 'Name', 'School',
    'Course ID', 'Course Name', 'Category',
    'Started At', 'Completed At', 'Resumed', 'Video % Watched',
    'Pre Q1', 'Pre Q2', 'Pre Q3', 'Pre Q4',
    'Post Q1', 'Post Q2', 'Post Q3', 'Post Q4'
  ]]);

  Logger.log('Setup complete.');
  Logger.log('Students: STU001–STU008');
  Logger.log('Courses: C001–C005');
  Logger.log('Next: Deploy > New Deployment > Web App, then copy the URL into config.js');
}

// ─────────────────────────────────────────────────────────────────────────────
// Run this to update the tracking sheet headers on an existing install
// without clearing data. Only needed if you already have the old layout.
// ─────────────────────────────────────────────────────────────────────────────

function updateTrackingHeaders() {
  var sheet = getSheet(SHEET_TRACKING);
  sheet.getRange(1, 1, 1, 20).setValues([[
    'Submission ID', 'Status', 'Student ID', 'Name', 'School',
    'Course ID', 'Course Name', 'Category',
    'Started At', 'Completed At', 'Resumed', 'Video % Watched',
    'Pre Q1', 'Pre Q2', 'Pre Q3', 'Pre Q4',
    'Post Q1', 'Post Q2', 'Post Q3', 'Post Q4'
  ]]);
  Logger.log('Headers updated. Note: existing data rows use the old column layout and should be cleared.');
}

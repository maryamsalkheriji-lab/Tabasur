// نصوص صفحة تسليم الفيديو (فريق واحد = فيديو واحد). تُدمج في translations.ar.submit و translations.en.submit
// ويحرس اختبار i18n تطابق الشكل بين اللغتين.
export const SUBMIT_COPY = {
  ar: {
    title: 'تسليم الفيديو | معسكر تَبصَّر',
    breadcrumbCamp: 'معسكر تَبصَّر', breadcrumb: 'تسليم الفيديو',
    heroTitle: 'سلّموا فيديو', heroAccent: 'فريقكم.',
    heroText: 'فيديو واحد لكل فريق، من شخص إلى خمسة أشخاص، للمسارَين الحضوري وعن بُعد. سجّلوا الفريق مرة واحدة من هنا، ثم ارفعوا الفيديو مباشرة دون الدخول إلى أي مجلد.',
    status: {
      open: 'باب التسليم مفتوح الآن', closed: 'باب التسليم مغلق حاليًا', notReady: 'خدمة الرفع قيد التجهيز، عودوا لاحقًا',
      loading: 'جارٍ التحقق من حالة التسليم…', deadline: value => `آخر موعد للتسليم: ${value}`, maxSize: value => `الحد الأقصى لحجم الفيديو ${value}`,
    },
    modes: {
      title: 'ابدؤوا من هنا',
      newTitle: 'فريق جديد', newText: 'أول تسليم لنا: نسجّل الفريق ونرفع الفيديو.',
      existingTitle: 'لدينا كود فريق', existingText: 'سجّلنا من قبل: نعرض الفريق أو نستبدل الفيديو.',
    },
    rules: {
      title: 'قواعد التسليم',
      items: [
        'فيديو واحد فقط لكل فريق، ويمكن استبداله قبل انتهاء الموعد.',
        'الفريق من شخص إلى خمسة أشخاص، ويُعرَّف كل عضو برقم جواله المسجّل في الموقع.',
        'الشخص الواحد في فريق واحد فقط، بالاسم وبرقم الجوال.',
        'يجوز أن يجمع الفريق مشاركين من المسار الحضوري والمسار عن بُعد.',
      ],
    },
    team: {
      sectionTitle: 'بيانات الفريق', name: 'اسم الفريق', namePlaceholder: 'مثال: عدسة المدينة',
      nameHint: 'اسم لا يتكرر مع فريق آخر، من حرفين إلى ستين حرفًا.', track: 'المسار', trackHint: 'اختاروا مسارًا واحدًا يناسب فكرة الفيديو.',
    },
    members: {
      sectionTitle: 'الأعضاء', leaderLabel: 'رقم جوالك (قائد الفريق)', memberLabel: n => `رقم جوال العضو ${n}`,
      add: 'إضافة عضو', remove: 'إزالة العضو', max: 'الحد الأقصى خمسة أعضاء',
      hint: 'اكتبوا رقم الجوال الذي سجّل به كل عضو في الموقع، وسيظهر اسمه كما سجّله للتأكد منه.',
      checking: 'جارٍ التحقق…', ok: 'مسجّل', notRegistered: 'هذا الرقم غير مسجّل في المعسكر', inTeam: 'هذا الرقم مسجّل في فريق آخر',
      invalid: 'رقم الجوال غير صحيح', duplicate: 'هذا الرقم مكرر في القائمة', registerLink: 'التسجيل في المعسكر',
    },
    video: {
      sectionTitle: 'الفيديو', title: 'عنوان الفيديو', titlePlaceholder: 'مثال: أسواق المدينة',
      file: 'ملف الفيديو', choose: 'اختيار ملف الفيديو', change: 'تغيير الملف', drop: 'أو اسحبوا الملف إلى هنا',
      hint: max => `MP4 أو MOV، بحد أقصى ${max}.`, notVideo: 'الملف المختار ليس ملف فيديو.', tooLarge: max => `حجم الملف أكبر من الحد المسموح (${max}).`,
      replaceTitle: 'استبدال الفيديو', replaceText: 'عند اكتمال رفع الفيديو الجديد يُحذف الفيديو السابق تلقائيًا.',
    },
    consent: { title: 'إذن النشر', show: 'عرض الشروط كاملة', hide: 'إخفاء الشروط' },
    actions: {
      submitNew: 'تسجيل الفريق ورفع الفيديو', submitReplace: 'رفع الفيديو البديل', submitFirst: 'رفع الفيديو', lookup: 'عرض الفريق',
      back: 'رجوع', replace: 'استبدال الفيديو', remove: 'حذف الفيديو', removeConfirm: 'هل تريدون حذف الفيديو الحالي؟ يمكنكم رفع غيره بعد الحذف.',
      cancelUpload: 'إلغاء الرفع', retry: 'متابعة الرفع', copyCode: 'نسخ الكود', copied: 'تم النسخ', whatsapp: 'حفظ الإيصال في واتساب',
      home: 'العودة إلى الرئيسية', another: 'تسليم فريق آخر', working: 'لحظة…',
    },
    existing: {
      code: 'كود الفريق', codePlaceholder: 'TB-000', mobile: 'رقم جوال أحد الأعضاء',
      hint: 'ظهر الكود لكم بعد أول تسليم. ويمكن لأي عضو عرض الفريق برقم جواله فقط.', orMobile: 'أو برقم الجوال وحده إن نسيتم الكود',
    },
    card: {
      title: 'بطاقة الفريق', code: 'كود الفريق', team: 'الفريق', track: 'المسار', members: 'الأعضاء', leader: 'قائد الفريق',
      video: 'الفيديو المعتمد', noVideo: 'لم يُرفع فيديو بعد.', pending: 'يوجد رفع سابق لم يكتمل؛ يمكنكم إعادة رفع الملف نفسه لإكماله.',
      uploadedAt: 'وقت الرفع', size: 'الحجم', keepCode: 'احتفظوا بالكود: تحتاجونه لعرض الفريق أو استبدال الفيديو.',
    },
    progress: {
      title: 'جارٍ رفع الفيديو…', keepOpen: 'لا تغلقوا هذه الصفحة حتى يكتمل الرفع.', of: (done, total) => `${done} من ${total}`,
      verifying: 'اكتمل الرفع، جارٍ التحقق من الملف…', retrying: 'انقطع الاتصال، تتم إعادة المحاولة تلقائيًا…', cancelled: 'أُلغي الرفع.',
    },
    success: {
      title: 'تم استلام فيديو فريقكم', text: 'سُجّل الفيديو باسم فريقكم ووصل إلى المنظّمين، وهذا إيصالكم.',
      created: 'تم تسجيل الفريق ورفع الفيديو بنجاح.', replaced: 'تم استبدال الفيديو بنجاح.', removed: 'تم حذف الفيديو، ويمكنكم رفع غيره.',
    },
    errors: {
      NETWORK: 'تعذّر الاتصال بالخادم. تحققوا من الإنترنت ثم أعيدوا المحاولة.',
      SUBMISSIONS_CLOSED: 'باب التسليم مغلق حاليًا.',
      DEADLINE_PASSED: 'انتهى موعد التسليم.',
      DRIVE_NOT_CONNECTED: 'خدمة الرفع قيد التجهيز حاليًا. حاولوا بعد قليل.',
      DRIVE_UNAVAILABLE: 'خدمة الرفع غير متاحة حاليًا. حاولوا بعد قليل، وإن استمرت المشكلة تواصلوا مع المنظّمين.',
      TEAM_CREATED_NO_UPLOAD: code => `تم تسجيل فريقكم بالكود ${code}، لكن تعذّر بدء رفع الفيديو. اختاروا «لدينا كود فريق» وأعيدوا الرفع.`,
      INVALID_TEAM_NAME: 'اكتبوا اسم فريق من حرفين إلى ستين حرفًا.',
      TEAM_NAME_TAKEN: 'اسم الفريق مستخدم من فريق آخر. اختاروا اسمًا مختلفًا.',
      INVALID_TRACK: 'اختاروا المسار.',
      INVALID_MEMBERS: 'أضيفوا عضوًا واحدًا على الأقل وخمسة على الأكثر.',
      DUPLICATE_MEMBER: 'يوجد رقم مكرر في قائمة الأعضاء.',
      INVALID_MOBILE: 'أحد أرقام الجوال غير صحيح.',
      NOT_REGISTERED: 'أحد الأرقام غير مسجّل في المعسكر. يسجّل صاحبه أولًا من صفحة التسجيل ثم أعيدوا المحاولة.',
      MOBILE_TAKEN: 'أحد الأعضاء مسجّل في فريق آخر، ولا يجوز للشخص أن يكون في فريقَين.',
      NAME_TAKEN: 'اسم أحد الأعضاء مسجّل في فريق آخر، ولا يجوز للشخص أن يكون في فريقَين.',
      INVALID_VIDEO: 'اختاروا ملف فيديو بصيغة MP4 أو MOV.',
      VIDEO_TOO_LARGE: 'حجم الفيديو أكبر من الحد المسموح.',
      INVALID_TITLE: 'اكتبوا عنوانًا للفيديو من حرفين على الأقل.',
      CONSENT_REQUIRED: 'الموافقة على إذن النشر مطلوبة.',
      CONSENT_OUTDATED: 'تحدّثت شروط النشر. حدّثوا الصفحة ثم وافقوا عليها من جديد.',
      TEAM_NOT_FOUND: 'لا يوجد فريق بهذا الكود أو الرقم.',
      INVALID_CODE: 'كود الفريق يبدأ بـ TB- وتليه أرقام، مثل TB-012.',
      NOT_A_MEMBER: 'هذا الرقم ليس من أعضاء الفريق.',
      LEADER_ONLY: 'حذف الفيديو من صلاحية قائد الفريق فقط.',
      UPLOAD_EXPIRED: 'انتهت جلسة الرفع. ابدؤوا الرفع من جديد.',
      UPLOAD_INCOMPLETE: 'لم يكتمل وصول الملف. اضغطوا «متابعة الرفع».',
      UPLOAD_FAILED: 'تعذّر إتمام الرفع. أعيدوا المحاولة، وإن تكررت المشكلة جرّبوا شبكة أخرى.',
      RATE_LIMITED: 'محاولات كثيرة خلال وقت قصير. انتظروا دقيقة ثم أعيدوا المحاولة.',
      UNKNOWN: 'حدث خطأ غير متوقع. أعيدوا المحاولة بعد قليل.',
    },
  },
  en: {
    title: 'Submit Video | Tabsur Camp',
    breadcrumbCamp: 'Tabsur Camp', breadcrumb: 'Submit Video',
    heroTitle: 'Submit your', heroAccent: 'team video.',
    heroText: 'One video per team, teams of one to five people, for both the in-person and remote tracks. Register the team once here, then upload the video directly without entering any folder.',
    status: {
      open: 'Submissions are open now', closed: 'Submissions are currently closed', notReady: 'The upload service is being prepared, please come back later',
      loading: 'Checking submission status…', deadline: value => `Submission deadline: ${value}`, maxSize: value => `Maximum video size ${value}`,
    },
    modes: {
      title: 'Start here',
      newTitle: 'New team', newText: 'Our first submission: register the team and upload the video.',
      existingTitle: 'We have a team code', existingText: 'Already registered: view the team or replace the video.',
    },
    rules: {
      title: 'Submission rules',
      items: [
        'Exactly one video per team, which can be replaced before the deadline.',
        'Teams of one to five people; each member is identified by the mobile number registered on the website.',
        'A person can be in one team only, by name and by mobile number.',
        'A team may combine participants from the in-person and remote tracks.',
      ],
    },
    team: {
      sectionTitle: 'Team details', name: 'Team name', namePlaceholder: 'e.g. City Lens',
      nameHint: 'A name no other team uses, two to sixty characters.', track: 'Track', trackHint: 'Choose the one track that fits your video.',
    },
    members: {
      sectionTitle: 'Members', leaderLabel: 'Your mobile number (team leader)', memberLabel: n => `Mobile number of member ${n}`,
      add: 'Add member', remove: 'Remove member', max: 'Five members at most',
      hint: 'Enter the mobile number each member registered with on the website; their registered name will appear so you can confirm it.',
      checking: 'Checking…', ok: 'Registered', notRegistered: 'This number is not registered in the camp', inTeam: 'This number is already in another team',
      invalid: 'Invalid mobile number', duplicate: 'This number is repeated in the list', registerLink: 'Register for the camp',
    },
    video: {
      sectionTitle: 'Video', title: 'Video title', titlePlaceholder: 'e.g. Madinah Markets',
      file: 'Video file', choose: 'Choose video file', change: 'Change file', drop: 'or drag the file here',
      hint: max => `MP4 or MOV, up to ${max}.`, notVideo: 'The selected file is not a video.', tooLarge: max => `The file is larger than the allowed limit (${max}).`,
      replaceTitle: 'Replace the video', replaceText: 'Once the new video finishes uploading, the previous one is removed automatically.',
    },
    consent: { title: 'Publication consent', show: 'Show full terms', hide: 'Hide terms' },
    actions: {
      submitNew: 'Register team and upload video', submitReplace: 'Upload replacement video', submitFirst: 'Upload video', lookup: 'View team',
      back: 'Back', replace: 'Replace video', remove: 'Delete video', removeConfirm: 'Delete the current video? You can upload another one afterwards.',
      cancelUpload: 'Cancel upload', retry: 'Resume upload', copyCode: 'Copy code', copied: 'Copied', whatsapp: 'Save receipt to WhatsApp',
      home: 'Back to home', another: 'Submit another team', working: 'One moment…',
    },
    existing: {
      code: 'Team code', codePlaceholder: 'TB-000', mobile: 'Mobile number of any member',
      hint: 'The code was shown after your first submission. Any member can also view the team with their mobile number only.', orMobile: 'or by mobile number alone if you forgot the code',
    },
    card: {
      title: 'Team card', code: 'Team code', team: 'Team', track: 'Track', members: 'Members', leader: 'Team leader',
      video: 'Submitted video', noVideo: 'No video uploaded yet.', pending: 'A previous upload did not finish; upload the same file again to complete it.',
      uploadedAt: 'Uploaded at', size: 'Size', keepCode: 'Keep the code: you need it to view the team or replace the video.',
    },
    progress: {
      title: 'Uploading the video…', keepOpen: 'Do not close this page until the upload completes.', of: (done, total) => `${done} of ${total}`,
      verifying: 'Upload finished, verifying the file…', retrying: 'Connection lost, retrying automatically…', cancelled: 'Upload cancelled.',
    },
    success: {
      title: 'Your team video was received', text: 'The video is registered under your team and has reached the organizers. This is your receipt.',
      created: 'Team registered and video uploaded successfully.', replaced: 'Video replaced successfully.', removed: 'Video deleted; you can upload another one.',
    },
    errors: {
      NETWORK: 'Could not reach the server. Check your connection and try again.',
      SUBMISSIONS_CLOSED: 'Submissions are currently closed.',
      DEADLINE_PASSED: 'The submission deadline has passed.',
      DRIVE_NOT_CONNECTED: 'The upload service is still being prepared. Please try again shortly.',
      DRIVE_UNAVAILABLE: 'The upload service is unavailable right now. Try again shortly, and contact the organizers if it persists.',
      TEAM_CREATED_NO_UPLOAD: code => `Your team was registered with code ${code}, but the upload could not start. Choose “We have a team code” and upload again.`,
      INVALID_TEAM_NAME: 'Enter a team name of two to sixty characters.',
      TEAM_NAME_TAKEN: 'Another team already uses this name. Choose a different one.',
      INVALID_TRACK: 'Choose a track.',
      INVALID_MEMBERS: 'Add at least one member and at most five.',
      DUPLICATE_MEMBER: 'A mobile number is repeated in the member list.',
      INVALID_MOBILE: 'One of the mobile numbers is invalid.',
      NOT_REGISTERED: 'One of the numbers is not registered in the camp. Its owner must register first, then try again.',
      MOBILE_TAKEN: 'One of the members is already in another team; a person cannot be in two teams.',
      NAME_TAKEN: 'One of the members’ names is already in another team; a person cannot be in two teams.',
      INVALID_VIDEO: 'Choose a video file in MP4 or MOV format.',
      VIDEO_TOO_LARGE: 'The video is larger than the allowed limit.',
      INVALID_TITLE: 'Enter a video title of at least two characters.',
      CONSENT_REQUIRED: 'Publication consent is required.',
      CONSENT_OUTDATED: 'The publication terms were updated. Refresh the page and accept them again.',
      TEAM_NOT_FOUND: 'No team matches this code or number.',
      INVALID_CODE: 'A team code starts with TB- followed by digits, e.g. TB-012.',
      NOT_A_MEMBER: 'This number is not a member of the team.',
      LEADER_ONLY: 'Only the team leader can delete the video.',
      UPLOAD_EXPIRED: 'The upload session expired. Start the upload again.',
      UPLOAD_INCOMPLETE: 'The file did not fully arrive. Press “Resume upload”.',
      UPLOAD_FAILED: 'The upload could not be completed. Try again, and switch networks if it keeps failing.',
      RATE_LIMITED: 'Too many attempts in a short time. Wait a minute and try again.',
      UNKNOWN: 'Something unexpected happened. Please try again shortly.',
    },
  },
}

const ERROR_ALIASES = {
  DRIVE_AUTH_REVOKED: 'DRIVE_UNAVAILABLE', DRIVE_TOKEN_FAILED: 'DRIVE_UNAVAILABLE', DRIVE_SESSION_FAILED: 'DRIVE_UNAVAILABLE', DRIVE_FOLDER_FAILED: 'DRIVE_UNAVAILABLE',
  DRIVE_FILE_FAILED: 'DRIVE_UNAVAILABLE', DRIVE_STATUS_FAILED: 'DRIVE_UNAVAILABLE', DRIVE_TRASH_FAILED: 'DRIVE_UNAVAILABLE',
  INVALID_VIDEO_TYPE: 'INVALID_VIDEO', UPLOAD_NOT_FOUND: 'UPLOAD_EXPIRED', UPLOAD_SIZE_MISMATCH: 'UPLOAD_FAILED', UPLOAD_WRONG_FOLDER: 'UPLOAD_FAILED',
  UPLOAD_RETRY_EXHAUSTED: 'UPLOAD_FAILED', UPLOAD_RETRY: 'UPLOAD_FAILED', DB_UNAVAILABLE: 'UNKNOWN', DB_NOT_CONFIGURED: 'UNKNOWN', SERVER_ERROR: 'UNKNOWN',
  INVALID_REQUEST: 'UNKNOWN', UNKNOWN_ACTION: 'UNKNOWN', NOT_ALLOWED: 'UNKNOWN', BODY_TOO_LARGE: 'UNKNOWN',
}

// رسالة مفهومة لأي رمز خطأ يرجع من الخادم أو من الرفع.
export function submissionErrorMessage(copy, code, extra = {}) {
  const key = ERROR_ALIASES[code] || code
  const entry = copy.errors[key] || copy.errors.UNKNOWN
  return typeof entry === 'function' ? entry(extra.teamCode || extra.code || '') : entry
}

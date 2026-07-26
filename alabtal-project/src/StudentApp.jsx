import React, { useState, useEffect } from "react";
import { Play, Lock, Unlock, X, Loader2, BookOpen, ChevronDown, Search, Sparkles, Video, User, Phone, KeyRound, LogOut, Facebook, MessageCircle, CheckCircle2, Circle, ClipboardCheck, Award, Bell } from "lucide-react";
import { dbGet, dbSet, normalizeSubjects } from "./storage";
import { GRADES } from "./grades";
import { requestNotificationPermission } from "./onesignal";
import { registerStudent, loginStudent, logout as authLogout, onAuthChange } from "./auth";

const COLORS = {
  ink: "#1E1B4B", inkDeep: "#14123A", paper: "#F6F4FB", card: "#FFFFFF",
  line: "#E3DFF2", red: "#7C3AED", redDark: "#5B21B6", redSoft: "#EDE4FB",
  gold: "#F59E0B", goldSoft: "#FEF3C7", teal: "#0D9488", tealSoft: "#CCFBF1",
  muted: "#6B7280",
};

const CONTENT_KEY = "alabtal_content";
const STUDENTS_KEY = "alabtal_students";
const QUIZ_RESULTS_KEY = "alabtal_quiz_results";
const TEACHER_NAME = "عبدالله أسامة";
const PLATFORM_NAME = "الأبطال";
const SUPPORT_PHONE = "01068350551";
const SUPPORT_WA_LINK = `https://wa.me/20${SUPPORT_PHONE.slice(1)}`;
const FACEBOOK_URL = "https://www.facebook.com/share/18rKSmYF8t/";

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
function toEmbedUrl(url) {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : url;
}

export default function StudentApp() {
  const [ready, setReady] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [openSubject, setOpenSubject] = useState(null);
  const [unlocked, setUnlocked] = useState({});
  const [codeInputs, setCodeInputs] = useState({});
  const [codeErrors, setCodeErrors] = useState({});
  const [playing, setPlaying] = useState(null);
  const [query, setQuery] = useState("");

  const [entered, setEntered] = useState(false);
  const [student, setStudent] = useState(null);
  const [authMode, setAuthMode] = useState("register");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authGrade, setAuthGrade] = useState(GRADES[0]);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [progress, setProgress] = useState({});
  const [quizOpenFor, setQuizOpenFor] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [homeworkModal, setHomeworkModal] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        setStudent(null);
        return;
      }
      try {
        const profile = await dbGet(`${STUDENTS_KEY}/${user.uid}`);
        if (profile) {
          const session = { uid: user.uid, name: profile.name, phone: profile.phone, grade: profile.grade || GRADES[0] };
          setStudent(session);
          setEntered(true);
          loadProgress(user.uid);
        }
      } catch (e) {}
    });
    return () => unsub();
  }, []);

  const loadProgress = async (uid) => {
    try {
      const p = await dbGet(`${STUDENTS_KEY}/${uid}/progress`);
      setProgress(p && typeof p === "object" ? p : {});
    } catch (e) {
      setProgress({});
    }
  };

  const markComplete = async (lectureId) => {
    if (!student) return;
    const next = { ...progress, [lectureId]: true };
    setProgress(next);
    try {
      await dbSet(`${STUDENTS_KEY}/${student.uid}/progress/${lectureId}`, true);
    } catch (e) {}
  };

  const handleAuthSubmit = async () => {
    const name = authName.trim();
    const phone = authPhone.trim();
    const password = authPassword;
    if (authMode === "register" && !name) { setAuthError("اكتب اسمك."); return; }
    if (!phone || phone.length < 8) { setAuthError("اكتب رقم موبايل صحيح."); return; }
    if (!password || password.length < 6) { setAuthError("كلمة السر لازم 6 حروف/أرقام على الأقل."); return; }

    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const user = await registerStudent(phone, password);
        const record = { name, phone, grade: authGrade, createdAt: Date.now() };
        await dbSet(`${STUDENTS_KEY}/${user.uid}`, record);
        setStudent({ uid: user.uid, name, phone, grade: authGrade });
        setEntered(true);
      } else {
        const user = await loginStudent(phone, password);
        const profile = await dbGet(`${STUDENTS_KEY}/${user.uid}`);
        setStudent({ uid: user.uid, name: profile?.name || "", phone, grade: profile?.grade || GRADES[0] });
        setEntered(true);
      }
    } catch (e) {
      const code = e.code || "";
      if (code.includes("email-already-in-use")) setAuthError("الرقم ده مسجل قبل كده. جرب تسجيل الدخول بدل كده.");
      else if (code.includes("wrong-password") || code.includes("invalid-credential")) setAuthError("كلمة السر غلط.");
      else if (code.includes("user-not-found")) setAuthError("الرقم ده مش مسجل. سجل حساب جديد الأول.");
      else if (code.includes("weak-password")) setAuthError("كلمة السر لازم تكون 6 حروف/أرقام على الأقل.");
      else setAuthError("تعذر الاتصال بقاعدة البيانات. جرب تاني.");
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    try { await authLogout(); } catch (e) {}
    setStudent(null);
    setEntered(false);
    setProgress({});
  };

  const loadContent = async () => {
    try {
      const c = await dbGet(CONTENT_KEY);
      setSubjects(normalizeSubjects(c));
    } catch (e) {
      setSubjects([]);
    }
    setReady(true);
  };

  useEffect(() => {
    if (student) {
      loadContent();
      loadProgress(student.uid);
    }
  }, [student]);

  const tryUnlock = (lecture) => {
    const input = (codeInputs[lecture.id] || "").trim();
    if (input === lecture.code) {
      setUnlocked((prev) => ({ ...prev, [lecture.id]: true }));
      setCodeErrors((prev) => ({ ...prev, [lecture.id]: "" }));
      setPlaying(lecture.id);
    } else {
      setCodeErrors((prev) => ({ ...prev, [lecture.id]: "الكود مش صح" }));
    }
  };

  const gradeSubjectsEarly = student ? subjects.filter((s) => !s.grade || s.grade === student.grade) : subjects;
  const allLectures = gradeSubjectsEarly.flatMap((s) => s.lectures.map((l) => ({ ...l, subjectId: s.id })));
  const playingLecture = allLectures.find((l) => l.id === playing);
  const completedCount = allLectures.filter((l) => progress[l.id]).length;

  const submitQuiz = async (lecture) => {
    const qs = lecture.quiz || [];
    let score = 0;
    qs.forEach((q) => {
      if (quizAnswers[q.id] === q.correct) score += 1;
    });
    setQuizResult({ score, total: qs.length });
    if (student) {
      const record = { name: student.name, phone: student.phone, score, total: qs.length, lectureTitle: lecture.title, submittedAt: Date.now() };
      try {
        await dbSet(`${QUIZ_RESULTS_KEY}/${lecture.id}/${student.uid}`, record);
      } catch (e) {}
    }
  };

  const filteredSubjects = query.trim()
    ? gradeSubjectsEarly
        .map((s) => ({ ...s, lectures: s.lectures.filter((l) => l.title.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase())) }))
        .filter((s) => s.lectures.length > 0 || s.name.toLowerCase().includes(query.toLowerCase()))
    : gradeSubjectsEarly;

  if (!entered) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif", display: "flex", flexDirection: "column" }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.ink}, ${COLORS.inkDeep})`, padding: "30px 20px 40px", position: "relative", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: `repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 40px)` }} />
          <img
            src="/teacher-banner.png"
            alt={TEACHER_NAME}
            style={{ width: "100%", maxWidth: 340, borderRadius: 18, boxShadow: "0 16px 40px rgba(0,0,0,0.35)", marginBottom: 20, position: "relative" }}
          />
          <h1 style={{ fontWeight: 900, fontSize: 26, color: "#fff", marginBottom: 8, position: "relative" }}>منصة {PLATFORM_NAME}</h1>
          <p style={{ fontSize: 13, color: "#8B95A3", maxWidth: 320, lineHeight: 1.8, marginBottom: 26, position: "relative" }}>
            محاضراتك كلها في مكان واحد — سجل حسابك وابدأ رحلتك مع الأبطال.
          </p>
          <button
            onClick={() => setEntered(true)}
            style={{ position: "relative", padding: "14px 40px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(216,67,46,0.3)" }}
          >
            ابدأ الآن
          </button>
        </div>

        <div className="flex items-center justify-center gap-3" style={{ padding: "18px 16px", background: COLORS.card, borderTop: `1px solid ${COLORS.line}` }}>
          <a href={SUPPORT_WA_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ textDecoration: "none", background: COLORS.tealSoft, color: COLORS.ink, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>
            <MessageCircle size={15} color={COLORS.teal} /> دعم واتساب
          </a>
          <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ textDecoration: "none", background: "#E8EEF7", color: COLORS.ink, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>
            <Facebook size={15} color="#3B5998" /> صفحتنا
          </a>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif" }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.ink}, ${COLORS.inkDeep})`, padding: "30px 16px 40px", position: "relative", overflow: "hidden" }}>
          <div className="flex items-center gap-3" style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
            <img src="/teacher-banner.png" alt={TEACHER_NAME} style={{ width: 50, height: 50, borderRadius: 14, objectFit: "cover", border: "2px solid rgba(255,255,255,0.25)" }} />
            <div>
              <h1 style={{ fontWeight: 900, fontSize: 24, color: "#fff" }}>منصة {PLATFORM_NAME}</h1>
              <p style={{ fontSize: 12.5, color: "#B9C2CE" }}>مع {TEACHER_NAME}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6" style={{ paddingTop: 36 }}>
          <div className="w-full" style={{ maxWidth: 380 }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 22, boxShadow: "0 8px 30px rgba(22,31,43,0.06)" }}>
              <div className="flex" style={{ marginBottom: 18, background: COLORS.paper, borderRadius: 10, padding: 4 }}>
                <button
                  onClick={() => { setAuthMode("register"); setAuthError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "'Tajawal', sans-serif", background: authMode === "register" ? COLORS.ink : "transparent", color: authMode === "register" ? "#fff" : COLORS.muted }}
                >
                  حساب جديد
                </button>
                <button
                  onClick={() => { setAuthMode("login"); setAuthError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "'Tajawal', sans-serif", background: authMode === "login" ? COLORS.ink : "transparent", color: authMode === "login" ? "#fff" : COLORS.muted }}
                >
                  تسجيل دخول
                </button>
              </div>

              {authMode === "register" && (
                <>
                  <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 6 }}><User size={13} /> الاسم</label>
                  <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="اسمك بالكامل" style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />
                  <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 6 }}><BookOpen size={13} /> إنت في أنهي صف؟</label>
                  <select
                    value={authGrade}
                    onChange={(e) => setAuthGrade(e.target.value)}
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box", background: "#fff", fontFamily: "'Tajawal', sans-serif" }}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </>
              )}
              <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 6 }}><Phone size={13} /> رقم الموبايل</label>
              <input value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()} placeholder="01xxxxxxxxx" type="tel" inputMode="numeric" style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />
              <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 6 }}><KeyRound size={13} /> كلمة السر</label>
              <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()} placeholder="••••••" type="password" style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 8, boxSizing: "border-box" }} />

              {authError && <p style={{ color: COLORS.red, fontSize: 12.5, marginBottom: 8 }}>{authError}</p>}

              <button
                onClick={handleAuthSubmit}
                disabled={authLoading}
                className="flex items-center justify-center gap-2"
                style={{ width: "100%", marginTop: 8, padding: "12px 14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Tajawal', sans-serif" }}
              >
                {authLoading ? <Loader2 size={17} className="animate-spin" /> : authMode === "register" ? "إنشاء الحساب" : "دخول"}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 16 }}>
              <a href={SUPPORT_WA_LINK} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.muted, fontSize: 11.5, textDecoration: "underline" }}>محتاج مساعدة؟ راسلنا واتساب</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh", background: COLORS.paper }}>
        <Loader2 className="animate-spin" size={26} color={COLORS.red} />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif" }}>
      <style>{`
        @keyframes portalOpen { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        .portal-open { animation: portalOpen 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .portal-open { animation: none; } }
      `}</style>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.ink}, ${COLORS.inkDeep})`, padding: "30px 16px 40px", position: "relative", overflow: "hidden" }}>
        <div className="flex items-center gap-3" style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          <img src="/teacher-banner.png" alt={TEACHER_NAME} style={{ width: 50, height: 50, borderRadius: 14, objectFit: "cover", border: "2px solid rgba(255,255,255,0.25)" }} />
          <div>
            <h1 style={{ fontWeight: 900, fontSize: 24, color: "#fff" }}>منصة {PLATFORM_NAME}</h1>
            <p style={{ fontSize: 12.5, color: "#B9C2CE" }}>مع {TEACHER_NAME}</p>
          </div>
          <button onClick={requestNotificationPermission} className="flex items-center justify-center" style={{ marginRight: "auto", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, width: 36, height: 36, color: "#fff", cursor: "pointer" }} aria-label="فعّل الإشعارات">
            <Bell size={15} />
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#fff", cursor: "pointer" }}>
            <LogOut size={13} /> خروج
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "#8B95A3", maxWidth: 760, margin: "8px auto 0", position: "relative" }}>أهلاً {student.name} 👋 {student.grade ? `· ${student.grade}` : ""}</p>
        {allLectures.length > 0 && (
          <div style={{ maxWidth: 760, margin: "10px auto 0", position: "relative" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "#B9C2CE" }}>تقدمك</span>
              <span style={{ fontSize: 11, color: "#B9C2CE" }}>{completedCount} من {allLectures.length}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${allLectures.length ? (completedCount / allLectures.length) * 100 : 0}%`, background: COLORS.gold, borderRadius: 999, transition: "width 0.3s" }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
        <div className="flex items-center justify-end" style={{ marginBottom: 12 }}>
          <button onClick={loadContent} style={{ fontSize: 11.5, color: COLORS.muted, background: "none", border: "none", cursor: "pointer" }}>تحديث</button>
        </div>

        {subjects.length > 0 && (
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={16} color={COLORS.muted} style={{ position: "absolute", right: 14, top: 14 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="دور على مادة أو محاضرة..." style={{ width: "100%", padding: "12px 40px 12px 14px", borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 14, background: COLORS.card, boxSizing: "border-box" }} />
          </div>
        )}

        {subjects.length === 0 && (
          <div className="text-center" style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "38px 20px", color: COLORS.muted }}>
            <Sparkles size={28} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14 }}>لسه مفيش مواد مضافة.</p>
          </div>
        )}

        <div className="flex flex-col" style={{ gap: 14 }}>
          {filteredSubjects.map((s) => {
            const isOpen = openSubject === s.id || !!query.trim();
            return (
              <div key={s.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, overflow: "hidden", borderRight: `4px solid ${COLORS.red}` }}>
                <button onClick={() => setOpenSubject(isOpen && !query.trim() ? null : s.id)} className="flex items-center justify-between w-full" style={{ padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "right" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: COLORS.redSoft }}>
                      {s.icon ? <span style={{ fontSize: 20 }}>{s.icon}</span> : <BookOpen size={19} color={COLORS.red} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: COLORS.ink, fontSize: 16 }}>{s.name}</div>
                      <div className="flex items-center gap-1" style={{ fontSize: 12, color: COLORS.muted }}><Video size={12} /> {s.lectures.length} محاضرة</div>
                    </div>
                  </div>
                  <ChevronDown size={18} color={COLORS.muted} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                </button>

                {isOpen && (
                  <div style={{ padding: "0 18px 18px" }}>
                    {s.lectures.length === 0 ? (
                      <p style={{ fontSize: 13, color: COLORS.muted, padding: "6px 2px" }}>لسه مفيش محاضرات في المادة دي.</p>
                    ) : (
                      <div className="flex flex-col" style={{ gap: 9 }}>
                        {s.lectures.map((l) => {
                          const isUnlocked = unlocked[l.id];
                          const isDone = !!progress[l.id];
                          const hasQuiz = (l.quiz || []).length > 0;
                          return (
                            <div key={l.id} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 14px" }}>
                              <div className="flex items-center justify-between" style={{ marginBottom: isUnlocked ? 0 : 10 }}>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 9, background: isUnlocked ? COLORS.tealSoft : COLORS.redSoft }}>
                                    {isUnlocked ? <Unlock size={15} color={COLORS.teal} /> : <Lock size={15} color={COLORS.red} />}
                                  </div>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{l.title}</span>
                                </div>
                                {isUnlocked && (
                                  <button onClick={() => setPlaying(l.id)} className="flex items-center gap-1" style={{ border: "none", borderRadius: 9, padding: "8px 14px", color: "#fff", fontSize: 12.5, cursor: "pointer", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})` }}>
                                    <Play size={13} fill="#fff" /> شغّل
                                  </button>
                                )}
                              </div>
                              {isUnlocked && (
                                <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
                                  <button onClick={() => markComplete(l.id)} className="flex items-center gap-1" style={{ background: isDone ? COLORS.tealSoft : "#fff", border: `1px solid ${isDone ? COLORS.teal : COLORS.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, cursor: "pointer", color: isDone ? COLORS.teal : COLORS.muted }}>
                                    {isDone ? <CheckCircle2 size={13} /> : <Circle size={13} />} {isDone ? "خلصتها" : "علّمها خلصت"}
                                  </button>
                                  {hasQuiz && (
                                    <button onClick={() => { setQuizOpenFor(l.id); setQuizAnswers({}); setQuizResult(null); }} className="flex items-center gap-1" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, cursor: "pointer", color: COLORS.ink }}>
                                      <ClipboardCheck size={13} /> ابدأ الاختبار
                                    </button>
                                  )}
                                </div>
                              )}
                              {isUnlocked && l.homework && (
                                <div style={{ marginTop: 10 }}>
                                  <button
                                    onClick={() => setHomeworkModal(l.homework)}
                                    className="flex items-center gap-2 w-full"
                                    style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}
                                  >
                                    <img src={l.homework} alt="الواجب" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12.5, color: COLORS.ink, fontWeight: 700 }}>شوف الواجب</span>
                                  </button>
                                </div>
                              )}
                              {!isUnlocked && (
                                <div className="flex gap-2">
                                  <input value={codeInputs[l.id] || ""} onChange={(e) => setCodeInputs((prev) => ({ ...prev, [l.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && tryUnlock(l)} placeholder="اكتب كود المحاضرة" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} style={{ flex: 1, padding: "9px 11px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, boxSizing: "border-box", background: "#fff" }} />
                                  <button onClick={() => tryUnlock(l)} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: COLORS.ink, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>فتح</button>
                                </div>
                              )}
                              {codeErrors[l.id] && <p style={{ color: COLORS.red, fontSize: 12, marginTop: 6 }}>{codeErrors[l.id]}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {playingLecture && (
        <div className="portal-open" style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <iframe src={toEmbedUrl(playingLecture.link)} title={playingLecture.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: "100%", height: "100%", border: "none" }} />
            <button
              onClick={() => setPlaying(null)}
              className="flex items-center justify-center"
              style={{ position: "absolute", top: 14, left: 14, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}
              aria-label="قفل"
            >
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>
      )}
      {quizOpenFor && (() => {
        const lecture = allLectures.find((l) => l.id === quizOpenFor);
        if (!lecture) return null;
        const qs = lecture.quiz || [];
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(14,21,32,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 55 }} onClick={() => setQuizOpenFor(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", background: COLORS.card, borderRadius: 16, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                <div className="flex items-center gap-2">
                  <Award size={18} color={COLORS.gold} />
                  <span style={{ fontWeight: 800, fontSize: 15, color: COLORS.ink }}>اختبار: {lecture.title}</span>
                </div>
                <button onClick={() => setQuizOpenFor(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={COLORS.ink} /></button>
              </div>

              {quizResult ? (
                <div className="text-center" style={{ padding: "20px 0" }}>
                  <Award size={40} color={COLORS.gold} style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 18, fontWeight: 800, color: COLORS.ink, marginBottom: 6 }}>نتيجتك: {quizResult.score} من {quizResult.total}</p>
                  <p style={{ fontSize: 13, color: COLORS.muted }}>
                    {quizResult.score === quizResult.total ? "ممتاز! إجابات كلها صح 🎉" : "جرب راجع المحاضرة تاني وحاول مرة تانية"}
                  </p>
                  <button onClick={() => setQuizOpenFor(null)} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 9, border: "none", background: COLORS.ink, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>تمام</button>
                </div>
              ) : (
                <>
                  {qs.map((q, qi) => (
                    <div key={q.id} style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>{qi + 1}. {q.q}</p>
                      <div className="flex flex-col" style={{ gap: 6 }}>
                        {q.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                            className="flex items-center gap-2"
                            style={{ textAlign: "right", padding: "9px 11px", borderRadius: 8, border: `1.5px solid ${quizAnswers[q.id] === oi ? COLORS.teal : COLORS.line}`, background: quizAnswers[q.id] === oi ? COLORS.tealSoft : "#fff", cursor: "pointer", fontSize: 13 }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => submitQuiz(lecture)}
                    disabled={Object.keys(quizAnswers).length < qs.length}
                    className="flex items-center justify-center gap-2 w-full"
                    style={{ padding: "12px", borderRadius: 10, border: "none", background: Object.keys(quizAnswers).length < qs.length ? COLORS.line : `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    تسليم الإجابات
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {homeworkModal && (
        <div className="portal-open" style={{ position: "fixed", inset: 0, background: "rgba(14,21,32,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 55 }} onClick={() => setHomeworkModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 14, overflow: "hidden" }}>
            <div className="flex items-center justify-between" style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.line}` }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: COLORS.ink }}>الواجب</span>
              <button onClick={() => setHomeworkModal(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={COLORS.ink} /></button>
            </div>
            <img src={homeworkModal} alt="الواجب" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      )}

      <a href={SUPPORT_WA_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center" style={{ position: "fixed", bottom: 20, left: 20, width: 52, height: 52, borderRadius: "50%", background: COLORS.teal, boxShadow: "0 6px 18px rgba(47,143,124,0.4)", zIndex: 40 }}>
        <MessageCircle size={24} color="#fff" />
      </a>

      <div className="flex items-center justify-center gap-4" style={{ padding: "16px", color: COLORS.muted, fontSize: 12 }}>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: COLORS.muted, textDecoration: "none" }}>
          <Facebook size={13} /> صفحتنا على فيسبوك
        </a>
      </div>
    </div>
  );
}

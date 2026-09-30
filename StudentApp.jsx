import React, { useState, useEffect } from "react";
import { Play, Lock, Unlock, X, Loader2, BookOpen, ChevronDown, Search, Sparkles, Video, User, Phone, KeyRound, LogOut, Facebook, MessageCircle, CheckCircle2, Circle, ClipboardCheck, Award, Bell, Settings, Bot, Send, Upload, Wallet, FileCheck } from "lucide-react";
import { dbGet, dbSet, normalizeSubjects, compressImage } from "./storage";
import { GRADES } from "./grades";
import { requestNotificationPermission } from "./onesignal";
import { registerStudent, loginStudent, logout as authLogout, onAuthChange, changePassword } from "./auth";

const COLORS = {
  ink: "#F1EEFB", inkDeep: "#FFFFFF", paper: "#1B1533", card: "#241D42",
  line: "#3A3060", red: "#8B5CF6", redDark: "#7C3AED", redSoft: "#2E2456",
  gold: "#FBBF24", goldSoft: "#3D3220", teal: "#2DD4BF", tealSoft: "#123B36",
  muted: "#A79FC4", surface: "#1E1B4B",
};

const CONTENT_KEY = "alabtal_content";
const SUBMISSIONS_KEY = "alabtal_submissions";
const PAYMENTS_KEY = "alabtal_payment_requests";
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
  const [submissions, setSubmissions] = useState({});
  const [submitPanelOpen, setSubmitPanelOpen] = useState(null);
  const [submitNote, setSubmitNote] = useState("");
  const [submitUploading, setSubmitUploading] = useState(false);
  const [myPayments, setMyPayments] = useState([]);
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSending, setPaymentSending] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileGrade, setProfileGrade] = useState(GRADES[0]);
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

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

  const loadMySubmissions = async (uid, lectureIds) => {
    try {
      const mine = {};
      await Promise.all(
        (lectureIds || []).map(async (lectureId) => {
          const node = await dbGet(`${SUBMISSIONS_KEY}/${lectureId}/${uid}`);
          if (node) mine[lectureId] = node;
        })
      );
      setSubmissions(mine);
    } catch (e) {
      setSubmissions({});
    }
  };

  const submitHomework = async (lecture, file) => {
    if (!file || !student) return;
    setSubmitUploading(true);
    try {
      const imageData = await compressImage(file);
      const answer = {
        studentName: student.name,
        lectureTitle: lecture.title,
        imageData,
        note: submitNote.trim(),
        submittedAt: Date.now(),
      };
      await dbSet(`${SUBMISSIONS_KEY}/${lecture.id}/${student.uid}/answer`, answer);
      setSubmissions((prev) => ({ ...prev, [lecture.id]: { ...(prev[lecture.id] || {}), answer } }));
      setSubmitNote("");
      setSubmitPanelOpen(null);
    } catch (e) {}
    setSubmitUploading(false);
  };

  const loadMyPayments = async (uid) => {
    try {
      const raw = await dbGet(`${PAYMENTS_KEY}/${uid}`);
      const list = raw && typeof raw === "object"
        ? Object.entries(raw).map(([requestId, node]) => ({ requestId, ...(node.request || {}), decision: node.decision || null }))
        : [];
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMyPayments(list);
    } catch (e) {
      setMyPayments([]);
    }
  };

  const sendPaymentRequest = async (subject) => {
    if (!student) return;
    setPaymentSending(true);
    try {
      const requestId = Math.random().toString(36).slice(2, 10);
      const request = {
        studentName: student.name,
        studentPhone: student.phone,
        subjectName: subject.name,
        note: paymentNote.trim(),
        createdAt: Date.now(),
      };
      await dbSet(`${PAYMENTS_KEY}/${student.uid}/${requestId}/request`, request);
      setMyPayments((prev) => [{ requestId, ...request, decision: null }, ...prev]);
      setPaymentNote("");
      setPaymentPanelOpen(null);
    } catch (e) {}
    setPaymentSending(false);
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

  const openProfile = () => {
    setProfileName(student.name);
    setProfileGrade(student.grade || GRADES[0]);
    setProfileNewPassword("");
    setProfileMsg("");
    setProfileErr("");
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    const name = profileName.trim();
    if (!name) { setProfileErr("اكتب اسمك."); return; }
    setProfileErr("");
    setProfileMsg("");
    setProfileSaving(true);
    try {
      await dbSet(`${STUDENTS_KEY}/${student.uid}/name`, name);
      await dbSet(`${STUDENTS_KEY}/${student.uid}/grade`, profileGrade);
      if (profileNewPassword) {
        if (profileNewPassword.length < 6) {
          setProfileErr("كلمة السر الجديدة لازم تكون 6 حروف/أرقام على الأقل.");
          setProfileSaving(false);
          return;
        }
        await changePassword(profileNewPassword);
      }
      setStudent((prev) => ({ ...prev, name, grade: profileGrade }));
      setProfileNewPassword("");
      setProfileMsg("اتحفظ بنجاح ✓");
    } catch (e) {
      if ((e.code || "").includes("requires-recent-login")) {
        setProfileErr("لتغيير كلمة السر، سجل خروج ودخول تاني الأول ثم جرب.");
      } else {
        setProfileErr("تعذر الحفظ، جرب تاني.");
      }
    }
    setProfileSaving(false);
  };

  const loadContent = async () => {
    let list = [];
    try {
      const c = await dbGet(CONTENT_KEY);
      list = normalizeSubjects(c);
      setSubjects(list);
    } catch (e) {
      setSubjects([]);
    }
    setReady(true);
    return list;
  };

  useEffect(() => {
    if (student) {
      loadContent().then((list) => {
        const myGradeLectureIds = list
          .filter((s) => !s.grade || s.grade === student.grade)
          .flatMap((s) => s.lectures.map((l) => l.id));
        loadMySubmissions(student.uid, myGradeLectureIds);
      });
      loadProgress(student.uid);
      loadMyPayments(student.uid);
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

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const nextMessages = [...chatMessages, { role: "user", content: text }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.error || "حصل خطأ، جرب تاني." }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      }
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "تعذر الاتصال، جرب تاني." }]);
    }
    setChatLoading(false);
  };

  const filteredSubjects = query.trim()
    ? gradeSubjectsEarly
        .map((s) => ({ ...s, lectures: s.lectures.filter((l) => l.title.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase())) }))
        .filter((s) => s.lectures.length > 0 || s.name.toLowerCase().includes(query.toLowerCase()))
    : gradeSubjectsEarly;

  if (!entered) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif", display: "flex", flexDirection: "column" }}>
        <div style={{ background: `linear-gradient(135deg, #1E1B4B, #14123A)`, padding: "30px 20px 40px", position: "relative", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
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
          <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ textDecoration: "none", background: COLORS.redSoft, color: COLORS.ink, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}>
            <Facebook size={15} color="#7B9EF0" /> صفحتنا
          </a>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif" }}>
        <style>{`
          input, select, textarea { color: ${COLORS.ink}; }
          input::placeholder, textarea::placeholder { color: ${COLORS.muted}; opacity: 1; }
          select option { background: ${COLORS.card}; color: ${COLORS.ink}; }
        `}</style>
        <div style={{ background: `linear-gradient(135deg, #1E1B4B, #14123A)`, padding: "30px 16px 40px", position: "relative", overflow: "hidden" }}>
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
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "'Tajawal', sans-serif", background: authMode === "register" ? COLORS.surface : "transparent", color: authMode === "register" ? "#fff" : COLORS.muted }}
                >
                  حساب جديد
                </button>
                <button
                  onClick={() => { setAuthMode("login"); setAuthError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "'Tajawal', sans-serif", background: authMode === "login" ? COLORS.surface : "transparent", color: authMode === "login" ? "#fff" : COLORS.muted }}
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
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box", background: COLORS.card, fontFamily: "'Tajawal', sans-serif" }}
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

              {authMode === "login" && (
                <div className="flex items-center justify-end" style={{ marginBottom: 8 }}>
                  <a
                    href={`${SUPPORT_WA_LINK}?text=${encodeURIComponent(`السلام عليكم، نسيت كلمة السر بتاعتي في منصة الأبطال. رقمي: ${authPhone || "..."}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: COLORS.red, fontSize: 12, textDecoration: "underline" }}
                  >
                    نسيت كلمة السر؟
                  </a>
                </div>
              )}

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
        input, select, textarea { color: ${COLORS.ink}; }
        input::placeholder, textarea::placeholder { color: ${COLORS.muted}; opacity: 1; }
        select option { background: ${COLORS.card}; color: ${COLORS.ink}; }
      `}</style>
      <div style={{ background: `linear-gradient(135deg, #1E1B4B, #14123A)`, padding: "30px 16px 40px", position: "relative", overflow: "hidden" }}>
        <div className="flex items-center gap-3" style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          <img src="/teacher-banner.png" alt={TEACHER_NAME} style={{ width: 50, height: 50, borderRadius: 14, objectFit: "cover", border: "2px solid rgba(255,255,255,0.25)" }} />
          <div>
            <h1 style={{ fontWeight: 900, fontSize: 24, color: "#fff" }}>منصة {PLATFORM_NAME}</h1>
            <p style={{ fontSize: 12.5, color: "#B9C2CE" }}>مع {TEACHER_NAME}</p>
          </div>
          <button onClick={openProfile} className="flex items-center justify-center" style={{ marginRight: "auto", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, width: 36, height: 36, color: "#fff", cursor: "pointer" }} aria-label="الملف الشخصي">
            <Settings size={15} />
          </button>
          <button onClick={() => requestNotificationPermission(student.grade)} className="flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, width: 36, height: 36, color: "#fff", cursor: "pointer" }} aria-label="فعّل الإشعارات">
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
                                    <button onClick={() => { setQuizOpenFor(l.id); setQuizAnswers({}); setQuizResult(null); }} className="flex items-center gap-1" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, cursor: "pointer", color: COLORS.ink }}>
                                      <ClipboardCheck size={13} /> ابدأ الاختبار
                                    </button>
                                  )}
                                  {submissions[l.id]?.grading ? (
                                    <span className="flex items-center gap-1" style={{ background: COLORS.tealSoft, border: `1px solid ${COLORS.teal}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: COLORS.teal }}>
                                      <FileCheck size={13} /> الواجب اتصحح{submissions[l.id].grading.score ? `: ${submissions[l.id].grading.score}` : ""}
                                    </span>
                                  ) : submissions[l.id]?.answer ? (
                                    <span className="flex items-center gap-1" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: COLORS.muted }}>
                                      <FileCheck size={13} /> سلّمت الواجب
                                    </span>
                                  ) : (
                                    <button onClick={() => { setSubmitPanelOpen(l.id); setSubmitNote(""); }} className="flex items-center gap-1" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, cursor: "pointer", color: COLORS.ink }}>
                                      <Upload size={13} /> سلّم واجبك
                                    </button>
                                  )}
                                </div>
                              )}
                              {isUnlocked && submitPanelOpen === l.id && (
                                <div style={{ marginTop: 10, background: COLORS.paper, borderRadius: 9, padding: 12, border: `1px dashed ${COLORS.line}` }}>
                                  <input value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} placeholder="ملاحظة (اختياري)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12.5, marginBottom: 8, boxSizing: "border-box", background: COLORS.card }} />
                                  <label className="flex items-center justify-center gap-2 w-full" style={{ padding: "12px", borderRadius: 8, border: `1.5px dashed ${COLORS.line}`, background: COLORS.card, cursor: "pointer", fontSize: 12.5, color: COLORS.muted }}>
                                    {submitUploading ? <Loader2 size={15} className="animate-spin" /> : (<><Upload size={14} /> اختار صورة الواجب</>)}
                                    <input type="file" accept="image/*" hidden onChange={(e) => submitHomework(l, e.target.files[0])} />
                                  </label>
                                  <button onClick={() => setSubmitPanelOpen(null)} style={{ marginTop: 8, width: "100%", background: "none", border: "none", color: COLORS.muted, fontSize: 11.5, cursor: "pointer" }}>إلغاء</button>
                                </div>
                              )}
                              {isUnlocked && l.homework && (
                                <div style={{ marginTop: 10 }}>
                                  <button
                                    onClick={() => setHomeworkModal(l.homework)}
                                    className="flex items-center gap-2 w-full"
                                    style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}
                                  >
                                    <img src={l.homework} alt="الواجب" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12.5, color: COLORS.ink, fontWeight: 700 }}>شوف الواجب</span>
                                  </button>
                                </div>
                              )}
                              {!isUnlocked && (
                                <div className="flex gap-2">
                                  <input value={codeInputs[l.id] || ""} onChange={(e) => setCodeInputs((prev) => ({ ...prev, [l.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && tryUnlock(l)} placeholder="اكتب كود المحاضرة" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} style={{ flex: 1, padding: "9px 11px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, boxSizing: "border-box", background: COLORS.card }} />
                                  <button onClick={() => tryUnlock(l)} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: COLORS.surface, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>فتح</button>
                                </div>
                              )}
                              {codeErrors[l.id] && <p style={{ color: COLORS.red, fontSize: 12, marginTop: 6 }}>{codeErrors[l.id]}</p>}
                              {!isUnlocked && (() => {
                                const myRequest = myPayments.find((p) => p.subjectName === s.name);
                                if (myRequest) {
                                  return (
                                    <div className="flex items-center gap-1" style={{ marginTop: 8, fontSize: 11.5, color: myRequest.decision ? (myRequest.decision.status === "approved" ? COLORS.teal : COLORS.red) : COLORS.gold }}>
                                      <Wallet size={12} />
                                      {myRequest.decision ? (myRequest.decision.status === "approved" ? "اتوافق على طلبك، استنى الكود" : "الطلب اترفض") : "طلبك عند المعلم، استنى"}
                                    </div>
                                  );
                                }
                                return paymentPanelOpen === s.id ? (
                                  <div style={{ marginTop: 8, background: COLORS.paper, borderRadius: 9, padding: 10, border: `1px dashed ${COLORS.line}` }}>
                                    <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="ملاحظة (زي: حولت فودافون كاش)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12, marginBottom: 8, boxSizing: "border-box", background: COLORS.card }} />
                                    <button onClick={() => sendPaymentRequest(s)} disabled={paymentSending} className="flex items-center justify-center gap-1 w-full" style={{ padding: "8px", borderRadius: 8, border: "none", background: COLORS.gold, color: "#1B1533", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                                      {paymentSending ? <Loader2 size={13} className="animate-spin" /> : "ابعت الطلب"}
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setPaymentPanelOpen(s.id); setPaymentNote(""); }} className="flex items-center gap-1" style={{ marginTop: 8, background: "none", border: "none", color: COLORS.gold, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
                                    <Wallet size={12} /> ملكش كود؟ اطلب فتحها
                                  </button>
                                );
                              })()}
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
                  <button onClick={() => setQuizOpenFor(null)} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 9, border: "none", background: COLORS.surface, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>تمام</button>
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

      {profileOpen && (
        <div className="portal-open" style={{ position: "fixed", inset: 0, background: "rgba(20,18,58,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 55 }} onClick={() => setProfileOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: COLORS.card, borderRadius: 16, padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: COLORS.ink }}>الملف الشخصي</span>
              <button onClick={() => setProfileOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={COLORS.ink} /></button>
            </div>

            <label className="flex items-center gap-2" style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}><User size={12} /> الاسم</label>
            <input value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />

            <label className="flex items-center gap-2" style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}><Phone size={12} /> رقم الموبايل</label>
            <input value={student.phone} disabled style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box", background: COLORS.paper, color: COLORS.muted }} />

            <label className="flex items-center gap-2" style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}><BookOpen size={12} /> الصف الدراسي</label>
            <select value={profileGrade} onChange={(e) => setProfileGrade(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box", background: COLORS.card, fontFamily: "'Tajawal', sans-serif" }}>
              {GRADES.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>

            <label className="flex items-center gap-2" style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}><KeyRound size={12} /> كلمة سر جديدة (اختياري)</label>
            <input value={profileNewPassword} onChange={(e) => setProfileNewPassword(e.target.value)} type="password" placeholder="سيبها فاضية لو مش عايز تغيّرها" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />

            {profileErr && <p style={{ color: COLORS.red, fontSize: 12.5, marginBottom: 8 }}>{profileErr}</p>}
            {profileMsg && <p style={{ color: COLORS.teal, fontSize: 12.5, marginBottom: 8 }}>{profileMsg}</p>}

            <button
              onClick={saveProfile}
              disabled={profileSaving}
              className="flex items-center justify-center gap-2 w-full"
              style={{ padding: "11px", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {profileSaving ? <Loader2 size={16} className="animate-spin" /> : "حفظ التعديلات"}
            </button>
          </div>
        </div>
      )}

      {homeworkModal && (
        <div className="portal-open" style={{ position: "fixed", inset: 0, background: "rgba(14,21,32,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 55 }} onClick={() => setHomeworkModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: COLORS.card, borderRadius: 14, overflow: "hidden" }}>
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

      <button onClick={() => setChatOpen(true)} className="flex items-center justify-center" style={{ position: "fixed", bottom: 20, right: 20, width: 52, height: 52, borderRadius: "50%", border: "none", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, boxShadow: "0 6px 18px rgba(124,58,237,0.4)", zIndex: 40, cursor: "pointer" }} aria-label="اسأل المساعد الذكي">
        <Bot size={24} color="#fff" />
      </button>

      {chatOpen && (
        <div className="portal-open" style={{ position: "fixed", inset: 0, background: "rgba(20,18,58,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }} onClick={() => setChatOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, height: "85vh", background: COLORS.card, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between" style={{ padding: "14px 16px", borderBottom: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center gap-2">
                <Bot size={18} color={COLORS.red} />
                <span style={{ fontWeight: 800, fontSize: 14.5, color: COLORS.ink }}>اسأل عن المنهج</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={COLORS.ink} /></button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {chatMessages.length === 0 && (
                <div className="text-center" style={{ color: COLORS.muted, padding: "30px 10px" }}>
                  <Bot size={30} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 13 }}>اسألني أي سؤال في مادتك، وهحاول أساعدك أفهمها.</p>
                </div>
              )}
              <div className="flex flex-col" style={{ gap: 10 }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
                    <div style={{ maxWidth: "80%", padding: "9px 13px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.7, background: m.role === "user" ? COLORS.redSoft : COLORS.paper, color: COLORS.ink }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ padding: "9px 13px", borderRadius: 12, background: COLORS.paper }}>
                      <Loader2 size={15} className="animate-spin" color={COLORS.muted} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2" style={{ padding: "12px 14px", borderTop: `1px solid ${COLORS.line}` }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="اكتب سؤالك هنا..."
                style={{ flex: 1, padding: "11px 13px", borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 14, boxSizing: "border-box" }}
              />
              <button onClick={sendChatMessage} disabled={chatLoading} className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, cursor: "pointer", flexShrink: 0 }}>
                <Send size={16} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4" style={{ padding: "16px", color: COLORS.muted, fontSize: 12 }}>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: COLORS.muted, textDecoration: "none" }}>
          <Facebook size={13} /> صفحتنا على فيسبوك
        </a>
        <button onClick={() => setPrivacyOpen(true)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          سياسة الخصوصية
        </button>
      </div>

      {privacyOpen && (
        <div className="portal-open" style={{ position: "fixed", inset: 0, background: "rgba(20,18,58,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }} onClick={() => setPrivacyOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", background: COLORS.card, borderRadius: 16, padding: 22 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: COLORS.ink }}>سياسة الخصوصية</span>
              <button onClick={() => setPrivacyOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={COLORS.ink} /></button>
            </div>
            <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 2 }}>
              <p style={{ marginBottom: 12 }}>منصة {PLATFORM_NAME} بتحترم خصوصيتك، وده ملخص بسيط لسياستنا:</p>
              <p style={{ marginBottom: 10 }}><strong>البيانات اللي بنجمعها:</strong> اسمك، رقم موبايلك، والصف الدراسي، وقت التسجيل.</p>
              <p style={{ marginBottom: 10 }}><strong>ليه بنجمعها:</strong> عشان نعرفك وندير حسابك، ونظبط المحاضرات المناسبة لصفك، ونتواصل معاك لو احتجنا.</p>
              <p style={{ marginBottom: 10 }}><strong>مين بيشوفها:</strong> {TEACHER_NAME} بس. مفيش بيانات بتتباع أو تتشارك مع أي جهة تانية.</p>
              <p style={{ marginBottom: 10 }}><strong>كلمة السر:</strong> بتتخزن مشفرة، محدش يقدر يشوفها كنص صريح — حتى إحنا.</p>
              <p style={{ marginBottom: 10 }}><strong>حقك في الحذف:</strong> تقدر تطلب حذف حسابك وبياناتك في أي وقت عن طريق التواصل معانا على واتساب.</p>
              <p style={{ color: COLORS.muted, fontSize: 12 }}>لأي سؤال، تواصل معنا مباشرة على واتساب {SUPPORT_PHONE}.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

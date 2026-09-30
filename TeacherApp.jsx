import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, X, Loader2, BookOpen, ChevronDown,
  LogOut, Sparkles, Video, KeyRound, Check, Users, Phone, ClipboardCheck,
  Image as ImageIcon, Upload, Pencil, Menu, Wallet, FileCheck,
} from "lucide-react";
import { dbGet, dbSet, dbDelete, normalizeSubjects, toArray, compressImage } from "./storage";
import { GRADES } from "./grades";
import { sendNewContentNotification } from "./onesignal";
import { loginTeacher, registerTeacher, logout as authLogout, onAuthChange, createStudentAccountByTeacher } from "./auth";

const COLORS = {
  ink: "#F1EEFB", inkDeep: "#FFFFFF", paper: "#1B1533", card: "#241D42",
  line: "#3A3060", red: "#8B5CF6", redDark: "#7C3AED", redSoft: "#2E2456",
  gold: "#FBBF24", goldSoft: "#3D3220", teal: "#2DD4BF", tealSoft: "#123B36",
  muted: "#A79FC4", surface: "#1E1B4B",
};

const CONTENT_KEY = "alabtal_content";
const STUDENTS_KEY = "alabtal_students";
const QUIZ_RESULTS_KEY = "alabtal_quiz_results";
const SUBMISSIONS_KEY = "alabtal_submissions";
const PAYMENTS_KEY = "alabtal_payment_requests";
const CODE_REDEMPTIONS_KEY = "alabtal_code_redemptions";
const TEACHER_NAME = "عبدالله أسامة";
const PLATFORM_NAME = "الأبطال";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TeacherApp() {
  const [ready, setReady] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [storageOffline, setStorageOffline] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [checking, setChecking] = useState(false);

  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectIcon, setNewSubjectIcon] = useState("");
  const [newSubjectGrade, setNewSubjectGrade] = useState(GRADES[0]);
  const [lectureForms, setLectureForms] = useState({});
  const [quizForms, setQuizForms] = useState({});
  const [editingLecture, setEditingLecture] = useState(null);
  const [editForms, setEditForms] = useState({});
  const [quizPanelOpen, setQuizPanelOpen] = useState(null);
  const [homeworkPanelOpen, setHomeworkPanelOpen] = useState(null);
  const [homeworkUploading, setHomeworkUploading] = useState(null);
  const [openSubject, setOpenSubject] = useState(null);
  const [justAdded, setJustAdded] = useState(null);

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState(GRADES[0]);
  const [newStudentError, setNewStudentError] = useState("");
  const [newStudentSaving, setNewStudentSaving] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [gradeForms, setGradeForms] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("subjects");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [quizResults, setQuizResults] = useState([]);
  const [quizResultsLoading, setQuizResultsLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setIsAdmin(!!user);
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const c = await dbGet(CONTENT_KEY);
        setSubjects(normalizeSubjects(c));
      } catch (e) {}
    })();
  }, [isAdmin]);

  const persist = useCallback(async (next) => {
    setSaving(true);
    try {
      await dbSet(CONTENT_KEY, next);
      setStorageOffline(false);
    } catch (e) {
      setStorageOffline(true);
    }
    setSaving(false);
  }, []);

  const updateSubjects = (updater) => {
    setSubjects((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  };

  const handleAdminSubmit = async () => {
    const email = adminEmail.trim();
    const password = adminPassword;
    if (!email || !password) { setAdminError("اكتب الإيميل وكلمة السر."); return; }
    setAdminError("");
    setChecking(true);
    try {
      if (authMode === "register") {
        await registerTeacher(email, password);
      } else {
        await loginTeacher(email, password);
      }
      setAdminPassword("");
    } catch (e) {
      const code = e.code || "";
      if (code.includes("email-already-in-use")) setAdminError("الإيميل ده متسجل قبل كده. جرب تسجيل الدخول بدل كده.");
      else if (code.includes("wrong-password") || code.includes("invalid-credential")) setAdminError("كلمة السر غلط.");
      else if (code.includes("user-not-found")) setAdminError("الإيميل ده مش متسجل. سجل حساب جديد الأول.");
      else if (code.includes("weak-password")) setAdminError("كلمة السر لازم تكون 6 حروف/أرقام على الأقل.");
      else if (code.includes("invalid-email")) setAdminError("الإيميل مش صحيح.");
      else setAdminError("تعذر الاتصال. تأكد إنك ظبطت إعدادات Firebase صح في src/firebase.js");
    }
    setChecking(false);
  };

  const handleAdminLogout = async () => {
    try { await authLogout(); } catch (e) {}
  };

  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const raw = await dbGet(STUDENTS_KEY);
      const entries = raw && typeof raw === "object" ? Object.entries(raw) : [];
      const list = entries.map(([uid, rec]) => ({ ...rec, uid }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStudents(list);
    } catch (e) {
      setStudents([]);
    }
    setStudentsLoading(false);
  };

  const loadQuizResults = async () => {
    setQuizResultsLoading(true);
    try {
      const raw = await dbGet(QUIZ_RESULTS_KEY);
      const perLecture = toArray(raw);
      const flat = perLecture.flatMap((lectureResults) => toArray(lectureResults)).filter(Boolean);
      flat.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
      setQuizResults(flat);
    } catch (e) {
      setQuizResults([]);
    }
    setQuizResultsLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      loadSubmissions();
      loadPayments();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && activeTab === "homework") loadSubmissions();
    if (isAdmin && activeTab === "payments") loadPayments();
    if (isAdmin && activeTab === "students") loadStudents();
    if (isAdmin && activeTab === "quizzes") {
      loadQuizResults();
      loadStudents();
    }
  }, [isAdmin, activeTab]);

  const gradeBreakdown = GRADES.map((g) => ({
    grade: g,
    count: students.filter((s) => s.grade === g).length,
  })).filter((g) => g.count > 0);

  const lectureViewCounts = (() => {
    const counts = {};
    students.forEach((s) => {
      const progress = s.progress && typeof s.progress === "object" ? s.progress : {};
      Object.keys(progress).forEach((lectureId) => {
        if (progress[lectureId]) counts[lectureId] = (counts[lectureId] || 0) + 1;
      });
    });
    const rows = [];
    subjects.forEach((subj) => {
      (subj.lectures || []).forEach((l) => {
        if (counts[l.id]) rows.push({ title: l.title, subject: subj.name, count: counts[l.id] });
      });
    });
    return rows.sort((a, b) => b.count - a.count);
  })();

  const deleteStudent = async (studentUid) => {
    if (!window.confirm("متأكد إنك عايز تمسح الطالب ده؟")) return;
    try {
      await dbDelete(`${STUDENTS_KEY}/${studentUid}`);
      setStudents((prev) => prev.filter((s) => s.uid !== studentUid));
    } catch (e) {}
  };

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const raw = await dbGet(SUBMISSIONS_KEY);
      const rows = [];
      if (raw && typeof raw === "object") {
        Object.entries(raw).forEach(([lectureId, byStudent]) => {
          Object.entries(byStudent || {}).forEach(([studentUid, node]) => {
            if (!node || !node.answer) return;
            rows.push({
              lectureId,
              studentUid,
              ...node.answer,
              grading: node.grading || null,
            });
          });
        });
      }
      rows.sort((a, b) => {
        const ap = a.grading ? 1 : 0;
        const bp = b.grading ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return (b.submittedAt || 0) - (a.submittedAt || 0);
      });
      setSubmissions(rows);
    } catch (e) {
      setSubmissions([]);
    }
    setSubmissionsLoading(false);
  };

  const gradeSubmission = async (row) => {
    const form = gradeForms[`${row.lectureId}/${row.studentUid}`] || {};
    const grading = {
      status: "graded",
      score: (form.score || "").trim(),
      note: (form.note || "").trim(),
      gradedAt: Date.now(),
    };
    try {
      await dbSet(`${SUBMISSIONS_KEY}/${row.lectureId}/${row.studentUid}/grading`, grading);
      setSubmissions((prev) =>
        prev.map((r) => (r.lectureId === row.lectureId && r.studentUid === row.studentUid ? { ...r, grading } : r))
      );
    } catch (e) {}
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    try {
      const raw = await dbGet(PAYMENTS_KEY);
      const rows = [];
      if (raw && typeof raw === "object") {
        Object.entries(raw).forEach(([studentUid, byRequest]) => {
          Object.entries(byRequest || {}).forEach(([requestId, node]) => {
            if (!node || !node.request) return;
            rows.push({ studentUid, requestId, ...node.request, decision: node.decision || null });
          });
        });
      }
      rows.sort((a, b) => {
        const ap = a.decision ? 1 : 0;
        const bp = b.decision ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setPaymentRequests(rows);
    } catch (e) {
      setPaymentRequests([]);
    }
    setPaymentsLoading(false);
  };

  const decidePayment = async (row, status) => {
    const decision = { status, decidedAt: Date.now() };
    try {
      await dbSet(`${PAYMENTS_KEY}/${row.studentUid}/${row.requestId}/decision`, decision);
      setPaymentRequests((prev) =>
        prev.map((r) => (r.studentUid === row.studentUid && r.requestId === row.requestId ? { ...r, decision } : r))
      );
    } catch (e) {}
  };

  const createStudent = async () => {
    const name = newStudentName.trim();
    const phone = newStudentPhone.trim();
    const password = newStudentPassword;
    if (!name) { setNewStudentError("اكتب اسم الطالب."); return; }
    if (!phone || phone.length < 8) { setNewStudentError("اكتب رقم موبايل صحيح."); return; }
    if (!password || password.length < 6) { setNewStudentError("كلمة السر لازم 6 حروف/أرقام على الأقل."); return; }
    setNewStudentError("");
    setNewStudentSaving(true);
    try {
      const uid = await createStudentAccountByTeacher(phone, password);
      await dbSet(`${STUDENTS_KEY}/${uid}`, { name, phone, grade: newStudentGrade, createdAt: Date.now() });
      setNewStudentName("");
      setNewStudentPhone("");
      setNewStudentPassword("");
      await loadStudents();
    } catch (e) {
      const code = e.code || "";
      if (code.includes("email-already-in-use")) setNewStudentError("الرقم ده مسجل قبل كده.");
      else if (code.includes("weak-password")) setNewStudentError("كلمة السر ضعيفة، لازم 6 حروف/أرقام على الأقل.");
      else setNewStudentError("تعذر إنشاء الحساب، جرب تاني.");
    }
    setNewStudentSaving(false);
  };

  const addSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    updateSubjects((prev) => [...prev, { id: uid(), name, icon: newSubjectIcon.trim() || "📘", grade: newSubjectGrade, lectures: [] }]);
    setNewSubjectName("");
    setNewSubjectIcon("");
    setSubjectFormOpen(false);
  };

  const deleteSubject = (id) => {
    if (!window.confirm("متأكد إنك عايز تمسح المادة دي وكل محاضراتها؟")) return;
    updateSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const addLecture = (subjectId) => {
    const form = lectureForms[subjectId] || {};
    const title = (form.title || "").trim();
    const link = (form.link || "").trim();
    const code = (form.code || "").trim();
    if (!title || !link || !code) return;
    const subject = subjects.find((s) => s.id === subjectId);
    updateSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, lectures: [...s.lectures, { id: uid(), title, link, code, quiz: [] }] } : s))
    );
    setLectureForms((prev) => ({ ...prev, [subjectId]: { title: "", link: "", code: "" } }));
    setJustAdded(subjectId);
    setTimeout(() => setJustAdded(null), 1200);
    sendNewContentNotification(`محاضرة جديدة: ${title}`, subject?.grade);
  };

  const deleteLecture = (subjectId, lectureId) => {
    updateSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, lectures: s.lectures.filter((l) => l.id !== lectureId) } : s))
    );
  };

  const editLecture = (subjectId, lectureId) => {
    const form = editForms[lectureId] || {};
    const title = (form.title || "").trim();
    const link = (form.link || "").trim();
    const code = (form.code || "").trim();
    if (!title || !link || !code) return;
    updateSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, title, link, code } : l)) }
          : s
      )
    );
    setEditingLecture(null);
  };

  const moveLecture = (subjectId, lectureId, direction) => {
    updateSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const idx = s.lectures.findIndex((l) => l.id === lectureId);
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (idx < 0 || swapWith < 0 || swapWith >= s.lectures.length) return s;
        const next = [...s.lectures];
        [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
        return { ...s, lectures: next };
      })
    );
  };

  const addQuizQuestion = (subjectId, lectureId) => {
    const form = quizForms[lectureId] || {};
    const q = (form.q || "").trim();
    const options = [0, 1, 2, 3].map((i) => (form[`opt${i}`] || "").trim());
    const correct = form.correct ?? 0;
    if (!q || options.some((o) => !o)) return;
    updateSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, quiz: [...(l.quiz || []), { id: uid(), q, options, correct }] } : l)) }
          : s
      )
    );
    setQuizForms((prev) => ({ ...prev, [lectureId]: { q: "", opt0: "", opt1: "", opt2: "", opt3: "", correct: 0 } }));
  };

  const deleteQuizQuestion = (subjectId, lectureId, questionId) => {
    updateSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, quiz: (l.quiz || []).filter((q) => q.id !== questionId) } : l)) }
          : s
      )
    );
  };

  const uploadHomework = async (subjectId, lectureId, file) => {
    if (!file) return;
    setHomeworkUploading(lectureId);
    try {
      const data = await compressImage(file);
      updateSubjects((prev) =>
        prev.map((s) =>
          s.id === subjectId
            ? { ...s, lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, homework: data } : l)) }
            : s
        )
      );
    } catch (e) {}
    setHomeworkUploading(null);
  };

  const removeHomework = (subjectId, lectureId) => {
    updateSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, homework: null } : l)) }
          : s
      )
    );
  };

  const pendingSubmissions = submissions.filter((s) => !s.grading).length;
  const pendingPayments = paymentRequests.filter((r) => !r.decision).length;
  const TAB_TITLES = {
    subjects: "المواد",
    students: "الطلاب",
    homework: "المهام والتصحيح",
    payments: "طلبات الدفع",
    quizzes: "الإحصائيات",
  };
  const MENU_ITEMS = [
    { key: "subjects", label: "المواد", icon: BookOpen, badge: 0 },
    { key: "students", label: "الطلاب", icon: Users, badge: 0 },
    { key: "homework", label: "المهام والتصحيح", icon: FileCheck, badge: pendingSubmissions },
    { key: "payments", label: "طلبات الدفع", icon: Wallet, badge: pendingPayments },
    { key: "quizzes", label: "الإحصائيات", icon: ClipboardCheck, badge: 0 },
  ];

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
        input, select, textarea { color: ${COLORS.ink}; }
        input::placeholder, textarea::placeholder { color: ${COLORS.muted}; opacity: 1; }
        select option { background: ${COLORS.card}; color: ${COLORS.ink}; }
      `}</style>
      {!isAdmin ? (
        <div className="flex items-center justify-center px-6" style={{ minHeight: "100vh" }}>
          <div className="w-full" style={{ maxWidth: 380 }}>
            <div className="flex items-center justify-center" style={{ marginBottom: 18 }}>
              <img src="/teacher-banner.png" alt={TEACHER_NAME} style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", boxShadow: "0 10px 24px rgba(30,27,75,0.25)" }} />
            </div>
            <h1 className="text-center" style={{ fontWeight: 900, fontSize: 27, color: COLORS.ink, marginBottom: 4 }}>لوحة {PLATFORM_NAME}</h1>
            <p className="text-center" style={{ color: COLORS.muted, fontSize: 13.5, marginBottom: 26 }}>دخول {TEACHER_NAME} — إدارة المواد والمحاضرات</p>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 22, boxShadow: "0 8px 30px rgba(22,31,43,0.06)" }}>
              <div className="flex" style={{ marginBottom: 16, background: COLORS.paper, borderRadius: 10, padding: 4 }}>
                <button
                  onClick={() => { setAuthMode("login"); setAdminError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: authMode === "login" ? COLORS.surface : "transparent", color: authMode === "login" ? "#fff" : COLORS.muted }}
                >
                  تسجيل دخول
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setAdminError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: authMode === "register" ? COLORS.surface : "transparent", color: authMode === "register" ? "#fff" : COLORS.muted }}
                >
                  حساب جديد
                </button>
              </div>
              <label className="flex items-center gap-2" style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}><KeyRound size={14} /> الإيميل</label>
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="example@gmail.com"
                type="email"
                autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
                style={{ width: "100%", padding: "13px 14px", borderRadius: 11, border: `1px solid ${COLORS.line}`, fontSize: 15, background: COLORS.paper, color: COLORS.ink, boxSizing: "border-box", marginBottom: 10 }}
              />
              <label className="flex items-center gap-2" style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>كلمة السر</label>
              <input
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdminSubmit()}
                placeholder="******"
                type="password"
                style={{ width: "100%", padding: "13px 14px", borderRadius: 11, border: `1px solid ${COLORS.line}`, fontSize: 15, background: COLORS.paper, color: COLORS.ink, boxSizing: "border-box" }}
              />
              {adminError && <p style={{ color: COLORS.red, fontSize: 13, marginTop: 8 }}>{adminError}</p>}
              <button
                onClick={handleAdminSubmit}
                disabled={checking}
                className="flex items-center justify-center gap-2"
                style={{ width: "100%", marginTop: 14, padding: "13px 14px", borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDark})`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                {checking ? <Loader2 size={18} className="animate-spin" /> : authMode === "register" ? "إنشاء الحساب" : "دخول"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: `linear-gradient(135deg, #1E1B4B, #14123A)`, padding: "26px 16px 30px" }}>
            <div className="flex items-center justify-between" style={{ maxWidth: 760, margin: "0 auto" }}>
              <div className="flex items-center gap-3">
                <img src="/teacher-banner.png" alt={TEACHER_NAME} style={{ width: 46, height: 46, borderRadius: 13, objectFit: "cover", border: "2px solid rgba(255,255,255,0.25)" }} />
                <div>
                  <h1 style={{ fontWeight: 900, fontSize: 21, color: "#fff" }}>لوحة تحكم {PLATFORM_NAME}</h1>
                  <p style={{ fontSize: 12, color: "#B9C2CE" }}>{TEACHER_NAME}</p>
                </div>
              </div>
              <button onClick={handleAdminLogout} className="flex items-center gap-1" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: "#fff", cursor: "pointer" }}>
                <LogOut size={14} /> خروج
              </button>
            </div>
          </div>

          <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 16px 60px" }}>
            {storageOffline && (
              <div style={{ background: COLORS.redSoft, border: `1px solid ${COLORS.red}`, borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
                <p style={{ fontSize: 12.5, color: COLORS.ink, lineHeight: 1.6 }}>تعذر الحفظ. تأكد من اتصال النت ورابط قاعدة البيانات في src/storage.js</p>
              </div>
            )}

            <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
              <button
                onClick={() => setMenuOpen(true)}
                className="flex items-center justify-center"
                style={{ width: 42, height: 42, borderRadius: 11, border: `1px solid ${COLORS.line}`, background: COLORS.card, cursor: "pointer", position: "relative" }}
                aria-label="القائمة"
              >
                <Menu size={19} color={COLORS.ink} />
                {(pendingSubmissions + pendingPayments) > 0 && (
                  <span style={{ position: "absolute", top: -5, left: -5, minWidth: 18, height: 18, borderRadius: 9, background: COLORS.gold, color: "#1B1533", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    {pendingSubmissions + pendingPayments}
                  </span>
                )}
              </button>
              <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.ink }}>{TAB_TITLES[activeTab]}</span>
            </div>

            {activeTab === "subjects" && (
            <>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>المواد</span>
                <span style={{ fontSize: 11, background: COLORS.goldSoft, color: COLORS.ink, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>{subjects.length}</span>
              </div>
              {saving && <span className="flex items-center gap-1" style={{ fontSize: 11.5, color: COLORS.teal }}><Loader2 size={12} className="animate-spin" /> بيحفظ</span>}
            </div>

            {subjectFormOpen ? (
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div className="flex gap-2" style={{ marginBottom: 10 }}>
                  <input
                    value={newSubjectIcon}
                    onChange={(e) => setNewSubjectIcon(e.target.value)}
                    placeholder="📘"
                    maxLength={2}
                    style={{ width: 54, padding: "11px 0", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 18, textAlign: "center", boxSizing: "border-box" }}
                  />
                  <input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubject()}
                    placeholder="اسم المادة"
                    style={{ flex: 1, padding: "11px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>
                <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10 }}>الصق أي إيموجي في الخانة الصغيرة عشان يبقى شعار المادة (اختياري)</p>
                <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6 }}>الصف الدراسي</label>
                <select
                  value={newSubjectGrade}
                  onChange={(e) => setNewSubjectGrade(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 12, boxSizing: "border-box", background: COLORS.card, fontFamily: "'Tajawal', sans-serif" }}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={addSubject} style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "none", background: COLORS.surface, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>حفظ</button>
                  <button onClick={() => setSubjectFormOpen(false)} style={{ width: 42, borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer" }}><X size={14} /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => setSubjectFormOpen(true)} className="flex items-center justify-center gap-2 w-full" style={{ marginBottom: 18, padding: "13px 14px", borderRadius: 12, border: `1.5px dashed ${COLORS.red}`, background: "transparent", color: COLORS.red, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                <Plus size={17} /> إضافة مادة جديدة
              </button>
            )}

            {subjects.length === 0 && !subjectFormOpen && (
              <div className="text-center" style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "34px 20px", color: COLORS.muted }}>
                <Sparkles size={26} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: 14 }}>ابدأ بإضافة أول مادة، وبعدين ضيف المحاضرات جواها.</p>
              </div>
            )}

            <div className="flex flex-col" style={{ gap: 14 }}>
              {subjects.map((s) => {
                const isOpen = openSubject === s.id;
                const form = lectureForms[s.id] || {};
                return (
                  <div key={s.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, overflow: "hidden", borderRight: `4px solid ${COLORS.red}` }}>
                    <button onClick={() => setOpenSubject(isOpen ? null : s.id)} className="flex items-center justify-between w-full" style={{ padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "right" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 11, background: COLORS.redSoft }}>
                          {s.icon ? <span style={{ fontSize: 19 }}>{s.icon}</span> : <BookOpen size={18} color={COLORS.red} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: COLORS.ink, fontSize: 15.5 }}>{s.name}</div>
                          <div className="flex items-center gap-1" style={{ fontSize: 12, color: COLORS.muted }}><Video size={12} /> {s.lectures.length} محاضرة {s.grade ? `· ${s.grade}` : ""}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); deleteSubject(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={15} color={COLORS.muted} /></button>
                        <ChevronDown size={18} color={COLORS.muted} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 18px 18px" }}>
                        {s.lectures.length > 0 && (
                          <div className="flex flex-col" style={{ gap: 8, marginBottom: 14 }}>
                            {s.lectures.map((l, li) => (
                              <div key={l.id} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "9px 12px" }}>
                                {editingLecture === l.id ? (
                                  <div>
                                    <input
                                      value={(editForms[l.id] || {}).title ?? l.title}
                                      onChange={(e) => setEditForms((prev) => ({ ...prev, [l.id]: { ...prev[l.id], title: e.target.value } }))}
                                      placeholder="عنوان المحاضرة"
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 13, marginBottom: 6, boxSizing: "border-box", background: COLORS.card }}
                                    />
                                    <input
                                      value={(editForms[l.id] || {}).link ?? l.link}
                                      onChange={(e) => setEditForms((prev) => ({ ...prev, [l.id]: { ...prev[l.id], link: e.target.value } }))}
                                      placeholder="لينك الفيديو"
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 13, marginBottom: 6, boxSizing: "border-box", background: COLORS.card }}
                                    />
                                    <input
                                      value={(editForms[l.id] || {}).code ?? l.code}
                                      onChange={(e) => setEditForms((prev) => ({ ...prev, [l.id]: { ...prev[l.id], code: e.target.value } }))}
                                      placeholder="كود الفتح"
                                      autoCapitalize="off" autoCorrect="off"
                                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 13, marginBottom: 8, boxSizing: "border-box", background: COLORS.card }}
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => editLecture(s.id, l.id)} style={{ flex: 1, padding: "8px", borderRadius: 7, border: "none", background: COLORS.teal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>حفظ</button>
                                      <button onClick={() => setEditingLecture(null)} style={{ width: 40, borderRadius: 7, border: `1px solid ${COLORS.line}`, background: COLORS.card, cursor: "pointer" }}><X size={13} /></button>
                                    </div>
                                  </div>
                                ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="flex flex-col">
                                      <button onClick={() => moveLecture(s.id, l.id, "up")} disabled={li === 0} style={{ background: "none", border: "none", cursor: li === 0 ? "default" : "pointer", opacity: li === 0 ? 0.3 : 1, padding: 1, lineHeight: 0 }}>
                                        <ChevronDown size={13} color={COLORS.muted} style={{ transform: "rotate(180deg)" }} />
                                      </button>
                                      <button onClick={() => moveLecture(s.id, l.id, "down")} disabled={li === s.lectures.length - 1} style={{ background: "none", border: "none", cursor: li === s.lectures.length - 1 ? "default" : "pointer", opacity: li === s.lectures.length - 1 ? 0.3 : 1, padding: 1, lineHeight: 0 }}>
                                        <ChevronDown size={13} color={COLORS.muted} />
                                      </button>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>{l.title}</div>
                                      <div className="flex items-center gap-1" style={{ fontSize: 11.5, color: COLORS.muted }}><KeyRound size={11} /> {l.code}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setHomeworkPanelOpen(homeworkPanelOpen === l.id ? null : l.id)} style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 11.5, color: COLORS.ink }}>
                                      الواجب {l.homework ? "✓" : ""}
                                    </button>
                                    <button onClick={() => setQuizPanelOpen(quizPanelOpen === l.id ? null : l.id)} style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 11.5, color: COLORS.ink }}>
                                      الاختبار ({(l.quiz || []).length})
                                    </button>
                                    <button onClick={() => setEditingLecture(l.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Pencil size={13} color={COLORS.muted} /></button>
                                    <button onClick={() => deleteLecture(s.id, l.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={COLORS.muted} /></button>
                                  </div>
                                </div>
                                )}

                                {homeworkPanelOpen === l.id && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLORS.line}` }}>
                                    {l.homework ? (
                                      <div>
                                        <img src={l.homework} alt="الواجب" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.card, marginBottom: 8 }} />
                                        <button onClick={() => removeHomework(s.id, l.id)} className="flex items-center justify-center gap-1 w-full" style={{ padding: "7px", borderRadius: 7, border: `1px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.red, fontSize: 12, cursor: "pointer" }}>
                                          <Trash2 size={12} /> حذف الواجب
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="flex items-center justify-center gap-2 w-full" style={{ padding: "16px", borderRadius: 9, border: `1.5px dashed ${COLORS.line}`, background: COLORS.card, cursor: "pointer", fontSize: 12.5, color: COLORS.muted }}>
                                        {homeworkUploading === l.id ? (
                                          <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                          <>
                                            <Upload size={15} /> اختار صورة الواجب
                                          </>
                                        )}
                                        <input type="file" accept="image/*" hidden onChange={(e) => uploadHomework(s.id, l.id, e.target.files[0])} />
                                      </label>
                                    )}
                                  </div>
                                )}

                                {quizPanelOpen === l.id && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLORS.line}` }}>
                                    {(l.quiz || []).map((qq, qi) => (
                                      <div key={qq.id} className="flex items-center justify-between" style={{ background: COLORS.card, borderRadius: 8, padding: "7px 10px", marginBottom: 6 }}>
                                        <span style={{ fontSize: 12.5, color: COLORS.ink }}>{qi + 1}. {qq.q}</span>
                                        <button onClick={() => deleteQuizQuestion(s.id, l.id, qq.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={12} color={COLORS.muted} /></button>
                                      </div>
                                    ))}
                                    <div style={{ background: COLORS.card, borderRadius: 9, padding: 10, marginTop: 6 }}>
                                      <input
                                        value={(quizForms[l.id] || {}).q || ""}
                                        onChange={(e) => setQuizForms((prev) => ({ ...prev, [l.id]: { ...prev[l.id], q: e.target.value } }))}
                                        placeholder="نص السؤال"
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 12.5, marginBottom: 6, boxSizing: "border-box" }}
                                      />
                                      {[0, 1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-2" style={{ marginBottom: 5 }}>
                                          <input
                                            type="radio"
                                            name={`correct-${l.id}`}
                                            checked={((quizForms[l.id] || {}).correct ?? 0) === i}
                                            onChange={() => setQuizForms((prev) => ({ ...prev, [l.id]: { ...prev[l.id], correct: i } }))}
                                          />
                                          <input
                                            value={(quizForms[l.id] || {})[`opt${i}`] || ""}
                                            onChange={(e) => setQuizForms((prev) => ({ ...prev, [l.id]: { ...prev[l.id], [`opt${i}`]: e.target.value } }))}
                                            placeholder={`اختيار ${i + 1}${i === 0 ? " (اختار الدائرة جنب الإجابة الصح)" : ""}`}
                                            style={{ flex: 1, padding: "7px 9px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 12, boxSizing: "border-box" }}
                                          />
                                        </div>
                                      ))}
                                      <button onClick={() => addQuizQuestion(s.id, l.id)} className="flex items-center justify-center gap-1 w-full" style={{ padding: "8px", borderRadius: 7, border: "none", background: COLORS.teal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                                        <Plus size={13} /> إضافة سؤال
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ background: COLORS.paper, borderRadius: 12, padding: 14, border: `1px dashed ${COLORS.line}` }}>
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink, marginBottom: 10 }}>إضافة محاضرة</p>
                          <input value={form.title || ""} onChange={(e) => setLectureForms((prev) => ({ ...prev, [s.id]: { ...prev[s.id], title: e.target.value } }))} placeholder="عنوان المحاضرة" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 7, boxSizing: "border-box", background: COLORS.card }} />
                          <input value={form.link || ""} onChange={(e) => setLectureForms((prev) => ({ ...prev, [s.id]: { ...prev[s.id], link: e.target.value } }))} placeholder="لينك الفيديو (يوتيوب)" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 7, boxSizing: "border-box", background: COLORS.card }} />
                          <input value={form.code || ""} onChange={(e) => setLectureForms((prev) => ({ ...prev, [s.id]: { ...prev[s.id], code: e.target.value } }))} placeholder="كود فتح المحاضرة" autoCapitalize="off" autoCorrect="off" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 10, boxSizing: "border-box", background: COLORS.card }} />
                          <button onClick={() => addLecture(s.id)} className="flex items-center justify-center gap-1 w-full" style={{ padding: "10px", borderRadius: 9, border: "none", background: COLORS.teal, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                            {justAdded === s.id ? <Check size={15} /> : <Plus size={15} />} إضافة محاضرة
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            )}

            {activeTab === "students" && (
              <div>
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink, marginBottom: 12 }}>إضافة طالب جديد</p>
                  <input value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="الاسم" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 8, boxSizing: "border-box", background: COLORS.paper }} />
                  <input value={newStudentPhone} onChange={(e) => setNewStudentPhone(e.target.value)} placeholder="رقم الموبايل" type="tel" inputMode="numeric" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 8, boxSizing: "border-box", background: COLORS.paper }} />
                  <input value={newStudentPassword} onChange={(e) => setNewStudentPassword(e.target.value)} placeholder="كلمة السر (6 حروف/أرقام على الأقل)" type="text" autoComplete="off" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 8, boxSizing: "border-box", background: COLORS.paper }} />
                  <select value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 10, boxSizing: "border-box", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif" }}>
                    {GRADES.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                  {newStudentError && <p style={{ color: COLORS.gold, fontSize: 12.5, marginBottom: 8 }}>{newStudentError}</p>}
                  <button onClick={createStudent} disabled={newStudentSaving} className="flex items-center justify-center gap-2 w-full" style={{ padding: "10px", borderRadius: 9, border: "none", background: COLORS.gold, color: "#1B1533", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
                    {newStudentSaving ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} /> إنشاء الحساب</>}
                  </button>
                </div>

                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>الطلاب المسجلين</span>
                  <span style={{ fontSize: 11, background: COLORS.tealSoft, color: COLORS.ink, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>{students.length}</span>
                </div>

                {studentsLoading && (
                  <div className="flex items-center justify-center" style={{ padding: 30 }}>
                    <Loader2 size={22} className="animate-spin" color={COLORS.red} />
                  </div>
                )}

                {!studentsLoading && students.length === 0 && (
                  <div className="text-center" style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "34px 20px", color: COLORS.muted }}>
                    <Users size={26} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 14 }}>لسه مفيش طلاب سجلوا في المنصة.</p>
                  </div>
                )}

                <div className="flex flex-col" style={{ gap: 10 }}>
                  {students.map((st) => (
                    <div key={st.uid} className="flex items-center justify-between" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 14px", borderRight: `4px solid ${COLORS.teal}` }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{st.name}</div>
                        <div className="flex items-center gap-1" style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                          <Phone size={11} /> {st.phone} {st.grade ? `· ${st.grade}` : ""}
                        </div>
                      </div>
                      <button onClick={() => deleteStudent(st.uid)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <Trash2 size={15} color={COLORS.muted} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "quizzes" && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>الطلاب حسب الصف</span>
                </div>
                {studentsLoading ? (
                  <div className="flex items-center justify-center" style={{ padding: 20 }}>
                    <Loader2 size={20} className="animate-spin" color={COLORS.red} />
                  </div>
                ) : gradeBreakdown.length === 0 ? (
                  <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 18 }}>لسه مفيش طلاب مسجلين.</p>
                ) : (
                  <div className="flex flex-col" style={{ gap: 8, marginBottom: 20 }}>
                    {gradeBreakdown.map((g) => (
                      <div key={g.grade} className="flex items-center justify-between" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "9px 14px" }}>
                        <span style={{ fontSize: 13.5, color: COLORS.ink }}>{g.grade}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.red }}>{g.count} طالب</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>كام طالب شاف كل محاضرة</span>
                </div>
                {lectureViewCounts.length === 0 ? (
                  <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>محدش علّم أي محاضرة "خلصتها" لسه.</p>
                ) : (
                  <div className="flex flex-col" style={{ gap: 8, marginBottom: 20 }}>
                    {lectureViewCounts.map((row, i) => (
                      <div key={i} className="flex items-center justify-between" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "9px 14px" }}>
                        <div>
                          <div style={{ fontSize: 13.5, color: COLORS.ink, fontWeight: 700 }}>{row.title}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>{row.subject}</div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.teal }}>{row.count} طالب</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>نتايج الاختبارات</span>
                  <span style={{ fontSize: 11, background: COLORS.goldSoft, color: COLORS.ink, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>{quizResults.length}</span>
                </div>

                {quizResultsLoading && (
                  <div className="flex items-center justify-center" style={{ padding: 30 }}>
                    <Loader2 size={22} className="animate-spin" color={COLORS.red} />
                  </div>
                )}

                {!quizResultsLoading && quizResults.length === 0 && (
                  <div className="text-center" style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "34px 20px", color: COLORS.muted }}>
                    <ClipboardCheck size={26} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 14 }}>لسه محدش عمل اختبار.</p>
                  </div>
                )}

                <div className="flex flex-col" style={{ gap: 10 }}>
                  {quizResults.map((r, i) => {
                    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
                    const good = pct >= 60;
                    return (
                      <div key={i} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 14px", borderRight: `4px solid ${good ? COLORS.teal : COLORS.red}` }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{r.name}</div>
                            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{r.lectureTitle}</div>
                          </div>
                          <div className="text-center">
                            <div style={{ fontSize: 15, fontWeight: 800, color: good ? COLORS.teal : COLORS.red }}>{r.score}/{r.total}</div>
                            <div style={{ fontSize: 10.5, color: COLORS.muted }}>{pct}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "homework" && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>المهام اللي محتاجة تصحيح</span>
                  <span style={{ fontSize: 11, background: COLORS.goldSoft, color: COLORS.gold, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>{pendingSubmissions}</span>
                </div>

                {submissionsLoading && (
                  <div className="flex items-center justify-center" style={{ padding: 30 }}>
                    <Loader2 size={22} className="animate-spin" color={COLORS.red} />
                  </div>
                )}

                {!submissionsLoading && submissions.length === 0 && (
                  <div className="text-center" style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "34px 20px", color: COLORS.muted }}>
                    <FileCheck size={26} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 14 }}>لسه محدش رفع واجب.</p>
                  </div>
                )}

                <div className="flex flex-col" style={{ gap: 12 }}>
                  {submissions.map((row) => {
                    const key = `${row.lectureId}/${row.studentUid}`;
                    const form = gradeForms[key] || {};
                    return (
                      <div key={key} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, borderRight: `4px solid ${row.grading ? COLORS.teal : COLORS.gold}` }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>{row.studentName}</div>
                            <div style={{ fontSize: 11.5, color: COLORS.muted }}>{row.lectureTitle}</div>
                          </div>
                          {row.grading && (
                            <span style={{ fontSize: 11, background: COLORS.tealSoft, color: COLORS.teal, padding: "3px 9px", borderRadius: 999, fontWeight: 700 }}>اتصحح ✓</span>
                          )}
                        </div>

                        {row.imageData && (
                          <button onClick={() => setImagePreview(row.imageData)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 10 }}>
                            <img src={row.imageData} alt="الواجب" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                          </button>
                        )}
                        {row.note && <p style={{ fontSize: 12.5, color: COLORS.ink, marginBottom: 10, background: COLORS.paper, padding: "8px 10px", borderRadius: 8 }}>{row.note}</p>}

                        {row.grading ? (
                          <div style={{ fontSize: 12.5, color: COLORS.muted }}>
                            {row.grading.score && <span>الدرجة: {row.grading.score} — </span>}
                            {row.grading.note}
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-2" style={{ marginBottom: 8 }}>
                              <input
                                value={form.score || ""}
                                onChange={(e) => setGradeForms((prev) => ({ ...prev, [key]: { ...prev[key], score: e.target.value } }))}
                                placeholder="الدرجة (اختياري)"
                                style={{ width: 110, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12.5, background: COLORS.paper, boxSizing: "border-box" }}
                              />
                              <input
                                value={form.note || ""}
                                onChange={(e) => setGradeForms((prev) => ({ ...prev, [key]: { ...prev[key], note: e.target.value } }))}
                                placeholder="ملاحظة للطالب"
                                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12.5, background: COLORS.paper, boxSizing: "border-box" }}
                              />
                            </div>
                            <button onClick={() => gradeSubmission(row)} className="flex items-center justify-center gap-1 w-full" style={{ padding: "9px", borderRadius: 8, border: "none", background: COLORS.teal, color: "#0E2622", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                              <Check size={14} /> تم التصحيح
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "payments" && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>طلبات الدفع</span>
                  <span style={{ fontSize: 11, background: COLORS.goldSoft, color: COLORS.gold, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>{pendingPayments}</span>
                </div>

                {paymentsLoading && (
                  <div className="flex items-center justify-center" style={{ padding: 30 }}>
                    <Loader2 size={22} className="animate-spin" color={COLORS.red} />
                  </div>
                )}

                {!paymentsLoading && paymentRequests.length === 0 && (
                  <div className="text-center" style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "34px 20px", color: COLORS.muted }}>
                    <Wallet size={26} color={COLORS.gold} style={{ margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 14 }}>لسه مفيش طلبات دفع.</p>
                  </div>
                )}

                <div className="flex flex-col" style={{ gap: 10 }}>
                  {paymentRequests.map((row) => (
                    <div key={`${row.studentUid}/${row.requestId}`} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, borderRight: `4px solid ${row.decision ? (row.decision.status === "approved" ? COLORS.teal : COLORS.red) : COLORS.gold}` }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>{row.studentName}</div>
                          <div style={{ fontSize: 11.5, color: COLORS.muted }}>{row.subjectName} · {row.studentPhone}</div>
                        </div>
                        {row.decision && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: row.decision.status === "approved" ? COLORS.teal : COLORS.red }}>
                            {row.decision.status === "approved" ? "اتوافق عليه ✓" : "اترفض"}
                          </span>
                        )}
                      </div>
                      {row.note && <p style={{ fontSize: 12.5, color: COLORS.ink, marginBottom: 10 }}>{row.note}</p>}
                      {!row.decision && (
                        <div className="flex gap-2">
                          <button onClick={() => decidePayment(row, "approved")} className="flex items-center justify-center gap-1" style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: COLORS.teal, color: "#0E2622", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                            <Check size={14} /> قبول
                          </button>
                          <button onClick={() => decidePayment(row, "rejected")} className="flex items-center justify-center gap-1" style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                            <X size={14} /> رفض
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70, display: "flex", justifyContent: "flex-end" }} onClick={() => setMenuOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 260, height: "100%", background: COLORS.card, padding: 18, boxShadow: "-6px 0 20px rgba(0,0,0,0.3)" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: COLORS.ink }}>القائمة</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={COLORS.ink} /></button>
            </div>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {MENU_ITEMS.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => { setActiveTab(item.key); setMenuOpen(false); }}
                    className="flex items-center justify-between"
                    style={{ padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: activeTab === item.key ? COLORS.surface : "transparent", color: activeTab === item.key ? "#fff" : COLORS.ink, fontSize: 13.5, fontWeight: 700 }}
                  >
                    <span className="flex items-center gap-2"><ItemIcon size={16} /> {item.label}</span>
                    {item.badge > 0 && (
                      <span style={{ fontSize: 10.5, background: COLORS.gold, color: "#1B1533", borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, padding: "0 4px" }}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {imagePreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setImagePreview(null)}>
          <img src={imagePreview} alt="الواجب" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Shield, X, Loader2, BookOpen, ChevronDown,
  LogOut, Sparkles, Video, KeyRound, Check, Users, Phone, ClipboardCheck,
  Image as ImageIcon, Upload,
} from "lucide-react";
import { dbGet, dbSet, dbDelete, normalizeSubjects, toArray, compressImage } from "./storage";
import { GRADES } from "./grades";
import { sendNewContentNotification } from "./onesignal";
import { loginTeacher, registerTeacher, logout as authLogout, onAuthChange } from "./auth";

const COLORS = {
  ink: "#161F2B", inkDeep: "#0E1520", paper: "#F3EEE2", card: "#FFFFFF",
  line: "#E4DCC8", red: "#D8432E", redDark: "#A62E1D", redSoft: "#F7DCD5",
  gold: "#E7B23A", goldSoft: "#FBEBC4", teal: "#2F8F7C", tealSoft: "#D9F0EA",
  muted: "#8B8577",
};

const CONTENT_KEY = "alabtal_content";
const STUDENTS_KEY = "alabtal_students";
const QUIZ_RESULTS_KEY = "alabtal_quiz_results";
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
  const [quizPanelOpen, setQuizPanelOpen] = useState(null);
  const [homeworkPanelOpen, setHomeworkPanelOpen] = useState(null);
  const [homeworkUploading, setHomeworkUploading] = useState(null);
  const [openSubject, setOpenSubject] = useState(null);
  const [justAdded, setJustAdded] = useState(null);

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
    if (isAdmin && activeTab === "students") loadStudents();
    if (isAdmin && activeTab === "quizzes") loadQuizResults();
  }, [isAdmin, activeTab]);

  const deleteStudent = async (studentUid) => {
    if (!window.confirm("متأكد إنك عايز تمسح الطالب ده؟")) return;
    try {
      await dbDelete(`${STUDENTS_KEY}/${studentUid}`);
      setStudents((prev) => prev.filter((s) => s.uid !== studentUid));
    } catch (e) {}
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
    updateSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, lectures: [...s.lectures, { id: uid(), title, link, code, quiz: [] }] } : s))
    );
    setLectureForms((prev) => ({ ...prev, [subjectId]: { title: "", link: "", code: "" } }));
    setJustAdded(subjectId);
    setTimeout(() => setJustAdded(null), 1200);
    sendNewContentNotification(`محاضرة جديدة: ${title}`);
  };

  const deleteLecture = (subjectId, lectureId) => {
    updateSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, lectures: s.lectures.filter((l) => l.id !== lectureId) } : s))
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

  if (!ready) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh", background: COLORS.paper }}>
        <Loader2 className="animate-spin" size={26} color={COLORS.red} />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "'Tajawal', sans-serif" }}>
      {!isAdmin ? (
        <div className="flex items-center justify-center px-6" style={{ minHeight: "100vh" }}>
          <div className="w-full" style={{ maxWidth: 380 }}>
            <div className="flex items-center justify-center" style={{ marginBottom: 18 }}>
              <div className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg, ${COLORS.ink}, ${COLORS.inkDeep})`, boxShadow: "0 10px 24px rgba(22,31,43,0.25)" }}>
                <Shield size={28} color={COLORS.gold} />
              </div>
            </div>
            <h1 className="text-center" style={{ fontWeight: 900, fontSize: 27, color: COLORS.ink, marginBottom: 4 }}>لوحة {PLATFORM_NAME}</h1>
            <p className="text-center" style={{ color: COLORS.muted, fontSize: 13.5, marginBottom: 26 }}>دخول {TEACHER_NAME} — إدارة المواد والمحاضرات</p>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 22, boxShadow: "0 8px 30px rgba(22,31,43,0.06)" }}>
              <div className="flex" style={{ marginBottom: 16, background: COLORS.paper, borderRadius: 10, padding: 4 }}>
                <button
                  onClick={() => { setAuthMode("login"); setAdminError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: authMode === "login" ? COLORS.ink : "transparent", color: authMode === "login" ? "#fff" : COLORS.muted }}
                >
                  تسجيل دخول
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setAdminError(""); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: authMode === "register" ? COLORS.ink : "transparent", color: authMode === "register" ? "#fff" : COLORS.muted }}
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
          <div style={{ background: `linear-gradient(135deg, ${COLORS.ink}, ${COLORS.inkDeep})`, padding: "26px 16px 30px" }}>
            <div className="flex items-center justify-between" style={{ maxWidth: 760, margin: "0 auto" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 13, background: COLORS.red }}>
                  <Shield size={22} color="#fff" />
                </div>
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

            <div className="flex" style={{ marginBottom: 18, background: COLORS.card, borderRadius: 12, padding: 4, border: `1px solid ${COLORS.line}` }}>
              <button
                onClick={() => setActiveTab("subjects")}
                className="flex items-center justify-center gap-2"
                style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: activeTab === "subjects" ? COLORS.ink : "transparent", color: activeTab === "subjects" ? "#fff" : COLORS.muted }}
              >
                <BookOpen size={15} /> المواد
              </button>
              <button
                onClick={() => setActiveTab("students")}
                className="flex items-center justify-center gap-2"
                style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: activeTab === "students" ? COLORS.ink : "transparent", color: activeTab === "students" ? "#fff" : COLORS.muted }}
              >
                <Users size={15} /> الطلاب
              </button>
              <button
                onClick={() => setActiveTab("quizzes")}
                className="flex items-center justify-center gap-2"
                style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: activeTab === "quizzes" ? COLORS.ink : "transparent", color: activeTab === "quizzes" ? "#fff" : COLORS.muted }}
              >
                <ClipboardCheck size={15} /> الإحصائيات
              </button>
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
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 12, boxSizing: "border-box", background: "#fff", fontFamily: "'Tajawal', sans-serif" }}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={addSubject} style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "none", background: COLORS.ink, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>حفظ</button>
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
                            {s.lectures.map((l) => (
                              <div key={l.id} style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "9px 12px" }}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>{l.title}</div>
                                    <div className="flex items-center gap-1" style={{ fontSize: 11.5, color: COLORS.muted }}><KeyRound size={11} /> {l.code}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setHomeworkPanelOpen(homeworkPanelOpen === l.id ? null : l.id)} style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 11.5, color: COLORS.ink }}>
                                      الواجب {l.homework ? "✓" : ""}
                                    </button>
                                    <button onClick={() => setQuizPanelOpen(quizPanelOpen === l.id ? null : l.id)} style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 11.5, color: COLORS.ink }}>
                                      الاختبار ({(l.quiz || []).length})
                                    </button>
                                    <button onClick={() => deleteLecture(s.id, l.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={COLORS.muted} /></button>
                                  </div>
                                </div>

                                {homeworkPanelOpen === l.id && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLORS.line}` }}>
                                    {l.homework ? (
                                      <div>
                                        <img src={l.homework} alt="الواجب" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", marginBottom: 8 }} />
                                        <button onClick={() => removeHomework(s.id, l.id)} className="flex items-center justify-center gap-1 w-full" style={{ padding: "7px", borderRadius: 7, border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.red, fontSize: 12, cursor: "pointer" }}>
                                          <Trash2 size={12} /> حذف الواجب
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="flex items-center justify-center gap-2 w-full" style={{ padding: "16px", borderRadius: 9, border: `1.5px dashed ${COLORS.line}`, background: "#fff", cursor: "pointer", fontSize: 12.5, color: COLORS.muted }}>
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
                                      <div key={qq.id} className="flex items-center justify-between" style={{ background: "#fff", borderRadius: 8, padding: "7px 10px", marginBottom: 6 }}>
                                        <span style={{ fontSize: 12.5, color: COLORS.ink }}>{qi + 1}. {qq.q}</span>
                                        <button onClick={() => deleteQuizQuestion(s.id, l.id, qq.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={12} color={COLORS.muted} /></button>
                                      </div>
                                    ))}
                                    <div style={{ background: "#fff", borderRadius: 9, padding: 10, marginTop: 6 }}>
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
                          <input value={form.title || ""} onChange={(e) => setLectureForms((prev) => ({ ...prev, [s.id]: { ...prev[s.id], title: e.target.value } }))} placeholder="عنوان المحاضرة" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 7, boxSizing: "border-box", background: "#fff" }} />
                          <input value={form.link || ""} onChange={(e) => setLectureForms((prev) => ({ ...prev, [s.id]: { ...prev[s.id], link: e.target.value } }))} placeholder="لينك الفيديو (يوتيوب)" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 7, boxSizing: "border-box", background: "#fff" }} />
                          <input value={form.code || ""} onChange={(e) => setLectureForms((prev) => ({ ...prev, [s.id]: { ...prev[s.id], code: e.target.value } }))} placeholder="كود فتح المحاضرة" autoCapitalize="off" autoCorrect="off" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 10, boxSizing: "border-box", background: "#fff" }} />
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
          </div>
        </>
      )}
    </div>
  );
}

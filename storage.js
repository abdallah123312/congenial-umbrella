import { auth, DB_URL } from "./firebase";

async function authParam() {
  const user = auth.currentUser;
  if (!user) return "";
  try {
    const token = await user.getIdToken();
    return `?auth=${token}`;
  } catch (e) {
    return "";
  }
}

export async function dbGet(key) {
  const qs = await authParam();
  const res = await fetch(`${DB_URL}/${key}.json${qs}`);
  if (!res.ok) throw new Error("فشل الاتصال بقاعدة البيانات");
  return res.json(); // null لو الكود مش موجود
}

export async function dbSet(key, value) {
  const qs = await authParam();
  const res = await fetch(`${DB_URL}/${key}.json${qs}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error("فشل الحفظ في قاعدة البيانات");
}

export async function dbDelete(key) {
  const qs = await authParam();
  const res = await fetch(`${DB_URL}/${key}.json${qs}`, { method: "DELETE" });
  if (!res.ok) throw new Error("فشل الحذف من قاعدة البيانات");
}

// Firebase Realtime Database يحول أي array لـ object أحيانًا (خصوصًا لو فاضي أو مش متسلسل).
// الدالة دي بترجعه array تاني عشان .map/.flatMap ما تكسرش الصفحة.
export function toArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") return Object.values(val);
  return [];
}

// بترجع مصفوفة المواد بعد ما تتأكد إن كل مادة وكل قايمة محاضرات جواها arrays حقيقية
export function normalizeSubjects(val) {
  return toArray(val).map((s) => ({ ...s, lectures: toArray(s && s.lectures) }));
}

// تشفير كلمة السر (SHA-256) عشان ما تتخزنش نص صريح في قاعدة البيانات
export async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// مفتاح آمن لتخزين بيانات الطالب في Firebase (بيشيل أي حروف ممنوعة زي . # $ / [ ])
export function phoneKey(phone) {
  return phone.replace(/[^0-9]/g, "");
}

// بتضغط أي صورة وتحولها لـ base64 صغير (عشان تتخزن في قاعدة البيانات من غير ما تبقى تقيلة)
export function compressImage(file, maxWidth = 900, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

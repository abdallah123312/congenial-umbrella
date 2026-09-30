import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
} from "firebase/auth";
import { auth, getSecondaryAuth } from "./firebase";
import { phoneKey } from "./storage";

// الطالب بيسجل برقم موبايله، إحنا بنحوله لإيميل وهمي عشان Firebase Auth يقبله
function phoneToEmail(phone) {
  return `${phoneKey(phone)}@alabtal.app`;
}

export async function registerStudent(phone, password) {
  const cred = await createUserWithEmailAndPassword(auth, phoneToEmail(phone), password);
  return cred.user;
}

export async function loginStudent(phone, password) {
  const cred = await signInWithEmailAndPassword(auth, phoneToEmail(phone), password);
  return cred.user;
}

export async function loginTeacher(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function registerTeacher(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

// المعلم بيعمل حساب لطالب مباشرة، من غير ما يخرج هو نفسه من حسابه
// (بيستخدم تطبيق فايربيز ثانوي عشان تسجيل الحساب الجديد ميأثرش على جلسة المعلم)
export async function createStudentAccountByTeacher(phone, password) {
  const secondaryAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secondaryAuth, phoneToEmail(phone), password);
  const uid = cred.user.uid;
  await signOut(secondaryAuth);
  return uid;
}

export async function logout() {
  await signOut(auth);
}

export async function changePassword(newPassword) {
  if (!auth.currentUser) throw new Error("مش مسجل دخول");
  await updatePassword(auth.currentUser, newPassword);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}

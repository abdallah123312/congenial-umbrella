import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";
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

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}

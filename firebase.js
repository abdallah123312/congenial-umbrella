import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// عدّل القيم دي بالإعدادات اللي هتاخدها من Firebase Console (شرح في README.md)
const firebaseConfig = {
  apiKey: "AIzaSyD2vwebaFvtxi6BxfaY_grrVrTyGwWps2w",
  authDomain: "easymath-fb7a0.firebaseapp.com",
  databaseURL: "https://easymath-fb7a0-default-rtdb.firebaseio.com",
  projectId: "easymath-fb7a0",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const DB_URL = firebaseConfig.databaseURL;

// تطبيق فايربيز تاني (ثانوي) بنستخدمه بس عشان المعلم يقدر يعمل حساب لطالب
// من غير ما يخرج هو نفسه من حسابه (تسجيل حساب جديد بيسجل دخول بيه تلقائي غير مقصود)
export function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === "secondary");
  const secondaryApp = existing || initializeApp(firebaseConfig, "secondary");
  return getAuth(secondaryApp);
}

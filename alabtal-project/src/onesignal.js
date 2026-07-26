// عدّل السطرين دول بالقيم اللي هتاخدها من حساب OneSignal بتاعك (شرح في README.md)
const ONESIGNAL_APP_ID = "YOUR-ONESIGNAL-APP-ID";
const ONESIGNAL_REST_API_KEY = "YOUR-ONESIGNAL-REST-API-KEY";

// بترسل إشعار لكل الطلاب اللي فعّلوا الإشعارات، لما يتضاف محتوى جديد
export async function sendNewContentNotification(message) {
  if (ONESIGNAL_APP_ID.startsWith("YOUR-") || ONESIGNAL_REST_API_KEY.startsWith("YOUR-")) {
    // لسه مش متظبط، تجاهل بهدوء بدل ما يبوظ حفظ المحاضرة
    return;
  }
  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Subscribed Users"],
        headings: { en: "منصة الأبطال", ar: "منصة الأبطال" },
        contents: { en: message, ar: message },
      }),
    });
  } catch (e) {
    // فشل الإرسال ما ينفعش يوقف حفظ المحاضرة
  }
}

// بيطلب من الطالب إذن الإشعارات (بيظهر بوب-أب من OneSignal نفسه)
export function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.Notifications.requestPermission();
    } catch (e) {}
  });
}

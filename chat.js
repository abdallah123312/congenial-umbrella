export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "الخدمة مش متظبطة لسه، كلم المعلم." });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system:
          "إنت مساعد تعليمي في منصة الأبطال، بتساعد طلاب من الصف الرابع الابتدائي للصف الثالث الثانوي في مصر. جاوب بالعربي بطريقة مبسطة وواضحة ومناسبة لسن الطالب. اشرح خطوة بخطوة لو السؤال محتاج كده. لو السؤال مش له علاقة بالمذاكرة أو المناهج الدراسية، اعتذر بلطف واطلب من الطالب يسأل عن حاجة تخص دراسته.",
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(500).json({ error: data?.error?.message || "حصل خطأ، جرب تاني." });
      return;
    }

    const text = (data.content || []).map((b) => b.text || "").join("");
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "تعذر الاتصال بالخدمة، جرب تاني." });
  }
}

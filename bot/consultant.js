import { optionalEnv } from "./env.js";
import { recommendedServices, retrieveKnowledge, serviceContextText } from "./knowledgeBase.js";

const openaiApiKey = optionalEnv("OPENAI_API_KEY");
const openaiModel = optionalEnv("OPENAI_MODEL") || "gpt-5-mini";

function localAnswer(query, matches, services) {
  if (!matches.length) {
    return [
      "По базе Lumi я не нашла точного совпадения.",
      "Могу предложить начать с короткой консультации администратора или выбрать услугу из прайса.",
    ].join("\n");
  }

  const lines = [
    "По базе Lumi лучше всего подойдут:",
    "",
    ...services.map(
      (service, index) =>
        `${index + 1}. ${service.title} — ${service.price}, ${service.duration}. Мастер: ${service.masters[0]}.`,
    ),
    "",
    "Если хотите, нажмите услугу ниже и я сразу открою запись.",
  ];

  return lines.join("\n");
}

async function openaiAnswer(query, matches) {
  if (!openaiApiKey) {
    return "";
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel,
      instructions: [
        "Ты консультант камерного салона красоты Lumi Studio.",
        "Отвечай только по переданному контексту услуг и цен.",
        "Не обещай медицинский эффект, лечение или гарантированный результат.",
        "Если данных не хватает, скажи это и предложи связаться с администратором.",
        "Ответ должен быть коротким, спокойным и продающим: 4-7 строк.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Вопрос клиента: ${query}`,
                "",
                "Контекст базы Lumi:",
                serviceContextText(matches),
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI response failed: ${JSON.stringify(result)}`);
  }

  return result.output_text || "";
}

export async function consultServices(query) {
  const matches = retrieveKnowledge(query, 4);
  const services = recommendedServices(matches);

  try {
    const aiText = await openaiAnswer(query, matches);
    if (aiText) {
      return {
        answer: `${aiText}\n\nМожно сразу выбрать услугу ниже.`,
        services,
        source: "openai_rag",
      };
    }
  } catch (error) {
    console.error(`AI consultant fallback: ${error.message}`);
  }

  return {
    answer: localAnswer(query, matches, services),
    services,
    source: "local_rag",
  };
}

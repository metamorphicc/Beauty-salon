import { services } from "./catalog.js";

export const faq = [
  {
    title: "Сухие и пористые волосы",
    text: "Если волосы сухие, пушатся или плохо держат укладку, лучше начать с ухода для восстановления длины. Окрашивание лучше планировать после консультации мастера.",
    serviceIds: ["haircut"],
    keywords: ["сухие", "пористые", "пушатся", "волосы", "уход", "восстановление"],
  },
  {
    title: "Окрашивание",
    text: "Окрашивание занимает от 2.5 до 4 часов. Цена зависит от длины, густоты и сложности оттенка. Перед сложным окрашиванием лучше заложить время на консультацию.",
    serviceIds: ["coloring"],
    keywords: ["окрашивание", "цвет", "блонд", "тонирование", "осветление", "шатуш", "airtouch"],
  },
  {
    title: "Маникюр на каждый день",
    text: "Для аккуратного повседневного результата подойдет маникюр с покрытием. Если ногти тонкие, можно обсудить укрепление с мастером.",
    serviceIds: ["nails"],
    keywords: ["маникюр", "ногти", "покрытие", "укрепление", "гель", "лак"],
  },
  {
    title: "Педикюр",
    text: "Педикюр подходит для регулярного ухода и занимает около 80 минут. Можно совместить с маникюром при наличии свободных мастеров.",
    serviceIds: ["pedicure"],
    keywords: ["педикюр", "стопы", "ноги", "пятки"],
  },
  {
    title: "Брови",
    text: "Если нужно быстро освежить лицо, подойдут брови: форма, окрашивание и аккуратная коррекция. Процедура занимает около 40 минут.",
    serviceIds: ["brows"],
    keywords: ["брови", "форма", "окрашивание бровей", "ламинирование"],
  },
  {
    title: "Уход лица",
    text: "Для тусклой кожи, сухости или подготовки к событию подойдет уход лица. Мастер подберет мягкий протокол без агрессивных обещаний.",
    serviceIds: ["face-care"],
    keywords: ["лицо", "кожа", "сухость", "уход", "сияние", "событие", "макияж"],
  },
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreText(queryTokens, values) {
  const haystack = normalize(values.join(" "));
  return queryTokens.reduce((score, token) => {
    if (haystack.includes(token)) {
      return score + 2;
    }

    if (haystack.some((word) => word.startsWith(token) || token.startsWith(word))) {
      return score + 1;
    }

    return score;
  }, 0);
}

export function retrieveKnowledge(query, limit = 3) {
  const queryTokens = normalize(query);
  const serviceMatches = services
    .map((service) => ({
      type: "service",
      id: service.id,
      title: service.title,
      text: `${service.category}. ${service.title}. Цена: ${service.price}. Длительность: ${service.duration}. Мастера: ${service.masters.join(", ")}.`,
      service,
      score: scoreText(queryTokens, [
        service.title,
        service.category,
        service.price,
        service.duration,
        ...service.masters,
      ]),
    }))
    .filter((item) => item.score > 1);

  const faqMatches = faq
    .map((item) => ({
      type: "faq",
      id: item.title,
      title: item.title,
      text: item.text,
      services: item.serviceIds
        .map((id) => services.find((service) => service.id === id))
        .filter(Boolean),
      score: scoreText(queryTokens, [item.title, item.text, ...item.keywords]),
    }))
    .filter((item) => item.score > 1);

  const ranked = [...serviceMatches, ...faqMatches].sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export function recommendedServices(matches) {
  const byId = new Map();

  for (const match of matches) {
    if (match.service) {
      byId.set(match.service.id, match.service);
    }

    for (const service of match.services || []) {
      byId.set(service.id, service);
    }
  }

  return [...byId.values()].slice(0, 3);
}

export function serviceContextText(matches) {
  if (!matches.length) {
    return services
      .map((service) => `${service.title}: ${service.price}, ${service.duration}`)
      .join("\n");
  }

  return matches
    .map((match) => `- ${match.title}: ${match.text}`)
    .join("\n");
}

export const salon = {
  name: process.env.SALON_NAME || "Lumi Studio",
  address: "Красный проспект, 22",
  hours: "ежедневно 10:00-21:00",
  timezone: process.env.TIMEZONE || "Asia/Novosibirsk",
};

export const services = [
  {
    id: "haircut",
    title: "Стрижка",
    category: "Волосы",
    price: "от 2 500 ₽",
    duration: "60-75 мин",
    masters: ["Алина Рэй", "София Лайт"],
  },
  {
    id: "coloring",
    title: "Окрашивание",
    category: "Волосы",
    price: "от 6 800 ₽",
    duration: "2.5-4 часа",
    masters: ["Алина Рэй"],
  },
  {
    id: "nails",
    title: "Маникюр с покрытием",
    category: "Ногти",
    price: "3 600 ₽",
    duration: "90 мин",
    masters: ["Мира Соль", "Вера Норд"],
  },
  {
    id: "pedicure",
    title: "Педикюр",
    category: "Ногти",
    price: "3 100 ₽",
    duration: "80 мин",
    masters: ["Мира Соль"],
  },
  {
    id: "brows",
    title: "Брови",
    category: "Лицо и брови",
    price: "1 600 ₽",
    duration: "40 мин",
    masters: ["Ника Вельт"],
  },
  {
    id: "face-care",
    title: "Уход лица",
    category: "Лицо и брови",
    price: "от 4 400 ₽",
    duration: "75 мин",
    masters: ["Ника Вельт"],
  },
];

export const timeSlots = ["10:30", "12:00", "14:30", "16:00", "18:30"];

export function findService(id) {
  return services.find((service) => service.id === id);
}

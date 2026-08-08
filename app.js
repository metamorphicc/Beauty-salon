const form = document.querySelector("#bookingForm");
const statusNode = document.querySelector("#formStatus");

if (form && statusNode) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const service = String(data.get("service") || "").trim();
    const date = String(data.get("date") || "").trim();
    const serviceLabel = service || "выбранную услугу";

    statusNode.textContent = `${name}, заявка на "${serviceLabel}" принята. В демо она уходит в Google Sheets и Telegram администратору.`;

    window.setTimeout(() => {
      form.reset();
      const dateInput = form.querySelector('input[name="date"]');
      if (dateInput) {
        dateInput.value = date;
      }
    }, 350);
  });
}

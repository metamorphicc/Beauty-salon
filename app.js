const form = document.querySelector("#bookingForm");
const statusNode = document.querySelector("#formStatus");
const nameInput = form?.querySelector('input[name="name"]');
const phoneInput = form?.querySelector('input[name="phone"]');
const successPopout = document.querySelector("#successPopout");
const successName = document.querySelector("#successName");
const successService = document.querySelector("#successService");
const successDate = document.querySelector("#successDate");
const successNote = document.querySelector("#successNote");
const popoutCloseButtons = document.querySelectorAll("[data-popout-close]");
let audioContext;
let popoutTimer;

function cleanName(value) {
  return value
    .replace(/[^\p{L}' -]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

function cleanPhone(value) {
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  return `${hasPlus ? "+" : ""}${digits}`;
}

function isValidName(value) {
  return /^[\p{L}][\p{L}' -]{1,39}$/u.test(value);
}

function isValidPhone(value) {
  return /^\+?[0-9]{10,15}$/.test(value);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  audioContext ||= new AudioContextClass();
  return audioContext;
}

function playBubblePop() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
  master.connect(context.destination);

  [620, 880, 1180].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const delay = index * 0.07;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start + delay);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.38, start + delay + 0.055);

    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.22, start + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.11);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + 0.13);
  });
}

function showSuccessPopout(name, service, date, note) {
  if (!successPopout) {
    return;
  }

  window.clearTimeout(popoutTimer);

  if (successName) {
    successName.textContent = name;
  }

  if (successService) {
    successService.textContent = service;
  }

  if (successDate) {
    successDate.textContent = date;
  }

  if (successNote) {
    successNote.textContent = note;
  }

  successPopout.classList.add("is-open");
  successPopout.setAttribute("aria-hidden", "false");
  playBubblePop();

  popoutTimer = window.setTimeout(closeSuccessPopout, 7600);
}

function closeSuccessPopout() {
  if (!successPopout) {
    return;
  }

  successPopout.classList.remove("is-open");
  successPopout.setAttribute("aria-hidden", "true");
  window.clearTimeout(popoutTimer);
}

nameInput?.addEventListener("input", () => {
  nameInput.value = cleanName(nameInput.value);
});

phoneInput?.addEventListener("input", () => {
  phoneInput.value = cleanPhone(phoneInput.value);
});

popoutCloseButtons.forEach((button) => {
  button.addEventListener("click", closeSuccessPopout);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSuccessPopout();
  }
});

if (form && statusNode) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    getAudioContext()?.resume();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const service = String(data.get("service") || "").trim();
    const date = String(data.get("date") || "").trim();
    const submitButton = form.querySelector('button[type="submit"]');

    if (!isValidName(name)) {
      statusNode.textContent = "Введите имя буквами, без цифр и лишних символов.";
      nameInput?.focus();
      return;
    }

    if (!isValidPhone(phone)) {
      statusNode.textContent = "Введите телефон в формате +79990000000, только цифры и плюс в начале.";
      phoneInput?.focus();
      return;
    }

    statusNode.textContent = "Отправляем заявку...";
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const payload = {
        name,
        phone,
        service,
        date,
      };
      const apiUrls =
        window.location.protocol === "file:"
          ? ["http://localhost:3000/api/booking"]
          : ["/api/booking", "http://localhost:3000/api/booking"];

      let result;
      let lastError;
      for (const apiUrl of apiUrls) {
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

          result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result.message || "Не удалось отправить заявку.");
          }
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        throw lastError;
      }

      statusNode.textContent = "";
      showSuccessPopout(name, service, date, result.message);
      form.reset();
      const dateInput = form.querySelector('input[name="date"]');
      if (dateInput) {
        dateInput.value = date;
      }
    } catch (error) {
      statusNode.textContent =
        "Форма не отправилась. Запустите сайт через `node server.js` и попробуйте еще раз.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

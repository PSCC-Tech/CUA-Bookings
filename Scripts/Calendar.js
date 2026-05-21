const MentorScheduleStore = (() => {
  let mentors = {};

  const aliases = {};
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  let loadPromise = null;

  function rebuildAliases() {
    Object.keys(aliases).forEach(key => delete aliases[key]);
    Object.values(mentors).forEach(mentor => {
      aliases[normalizeKey(mentor.name)] = mentor.name;
      aliases[normalizeKey(mentor.id)] = mentor.name;
      aliases[normalizeKey(mentor.mentor_number)] = mentor.name;
    });
  }

  rebuildAliases();

  function normalizeKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function listMentors() {
    return Object.values(mentors);
  }

  function setMentorsFromApi(apiMentors = []) {
    const nextMentors = {};

    apiMentors.forEach(mentor => {
      if (!mentor || !mentor.name) return;
      nextMentors[mentor.name] = {
        id: mentor.mentor_number || mentor.id || normalizeKey(mentor.name),
        mentorId: mentor.mentor_id,
        mentor_number: mentor.mentor_number || mentor.id || "",
        name: mentor.name,
        categories: mentor.categories || [],
        courseCodes: mentor.courseCodes || mentor.course_codes || [],
        weeklyAvailability: mentor.weeklyAvailability || {},
        bookings: mentor.bookings || [],
        absences: mentor.absences || []
      };
    });

    if (Object.keys(nextMentors).length) {
      mentors = nextMentors;
      rebuildAliases();
    }
  }

  async function loadFromApi(force = false) {
    if (!window.CUAApi) return listMentors();
    if (!force && loadPromise) return loadPromise;

    loadPromise = window.CUAApi.getSchedule(force)
      .then(apiMentors => {
        setMentorsFromApi(apiMentors);
        return listMentors();
      })
      .catch(error => {
        console.warn("Could not load mentor schedule data:", error);
        return listMentors();
      })
      .finally(() => {
        loadPromise = null;
      });

    return loadPromise;
  }

  function getMentor(value) {
    const key = normalizeKey(value);
    return mentors[aliases[key]] || null;
  }

  function getDefaultMentor() {
    return Object.values(mentors)[0] || null;
  }

  function getMentorsForCourse(courseCode) {
    const normalized = normalizeKey(courseCode);
    const directMatches = listMentors().filter(mentor =>
      (mentor.courseCodes || []).some(code => normalizeKey(code) === normalized)
    );

    if (directMatches.length) {
      return directMatches;
    }

    if (normalized.startsWith("math")) {
      return listMentors().filter(mentor => mentor.categories.includes("Mathematics"));
    }

    if (normalized.startsWith("comp") || normalized.startsWith("cs") || normalized.startsWith("tech")) {
      return listMentors().filter(mentor => mentor.categories.includes("Technology"));
    }

    if (normalized.startsWith("bio") || normalized.startsWith("biol") || normalized.startsWith("chem")) {
      return listMentors().filter(mentor => mentor.categories.includes("Sciences"));
    }

    if (normalized.startsWith("engl")) {
      return listMentors().filter(mentor => mentor.categories.includes("English"));
    }

    return listMentors();
  }

  function getDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDateLabel(date) {
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isPastDate(date) {
    return startOfDay(date) < startOfDay(new Date());
  }

  function isToday(date) {
    return startOfDay(date).getTime() === startOfDay(new Date()).getTime();
  }

  function getWeeklyAvailability(mentor, date) {
    const dayName = dayNames[date.getDay()];
    const dateKey = getDateKey(date);

    return (mentor.weeklyAvailability[dayName] || []).filter(range => {
      const effectiveFrom = range.effectiveFrom || range.effective_from || "";
      const effectiveTo = range.effectiveTo || range.effective_to || "";

      if (effectiveFrom && effectiveFrom > dateKey) return false;
      if (effectiveTo && effectiveTo < dateKey) return false;
      return true;
    });
  }

  function getBookingsForDate(mentor, key) {
    return mentor.bookings.filter(booking => booking.date === key);
  }

  function getAbsencesForDate(mentor, key) {
    return mentor.absences.filter(absence => absence.date === key);
  }

  function parseTime(time) {
    if (!time || time === "All day") return null;

    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3].toUpperCase();

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  function formatTime(minutes) {
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
  }

  function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function generateSlots(ranges) {
    const slots = [];

    ranges.forEach(range => {
      let current = parseTime(range.start);
      const end = parseTime(range.end);

      while (current !== null && end !== null && current + 30 <= end) {
        slots.push({
          start: formatTime(current),
          end: formatTime(current + 30)
        });
        current += 30;
      }
    });

    return slots;
  }

  function timeBlocksOverlap(aStart, aEnd, bStart, bEnd) {
    const startA = parseTime(aStart);
    const endA = parseTime(aEnd);
    const startB = parseTime(bStart);
    const endB = parseTime(bEnd);

    if ([startA, endA, startB, endB].some(value => value === null)) return false;
    return startA < endB && startB < endA;
  }

  function isFullDayAbsence(absence) {
    return absence.start === "All day";
  }

  function getAvailableSlots(mentor, date) {
    if (isPastDate(date)) {
      return [];
    }

    const key = getDateKey(date);
    const absences = getAbsencesForDate(mentor, key);

    if (absences.some(isFullDayAbsence)) {
      return [];
    }

    const bookings = getBookingsForDate(mentor, key);
    const slots = generateSlots(getWeeklyAvailability(mentor, date));
    const nowMinutes = minutesSinceMidnight(new Date());

    return slots.filter(slot => {
      const slotStart = parseTime(slot.start);
      if (isToday(date) && slotStart !== null && slotStart <= nowMinutes) {
        return false;
      }

      const overlapsBooking = bookings.some(booking =>
        timeBlocksOverlap(slot.start, slot.end, booking.start, booking.end)
      );
      const overlapsAbsence = absences.some(absence =>
        timeBlocksOverlap(slot.start, slot.end, absence.start, absence.end)
      );

      return !overlapsBooking && !overlapsAbsence;
    });
  }

  function hasScheduleOnDate(mentor, date) {
    const key = getDateKey(date);
    return getWeeklyAvailability(mentor, date).length > 0 ||
      getBookingsForDate(mentor, key).length > 0 ||
      getAbsencesForDate(mentor, key).length > 0;
  }

  return {
    dayNames,
    monthNames,
    listMentors,
    loadFromApi,
    setMentorsFromApi,
    getMentor,
    getDefaultMentor,
    getMentorsForCourse,
    getDateKey,
    parseDateKey,
    formatDateLabel,
    isPastDate,
    isToday,
    getWeeklyAvailability,
    getBookingsForDate,
    getAbsencesForDate,
    getAvailableSlots,
    hasScheduleOnDate,
    isFullDayAbsence
  };
})();

window.MentorScheduleStore = MentorScheduleStore;

document.addEventListener("DOMContentLoaded", () => {
  const monthYearEl = document.getElementById("month-year");
  const daysEl = document.getElementById("days");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const todayBtn = document.getElementById("today-btn");
  const eventDateEl = document.getElementById("event-date");
  const eventListEl = document.getElementById("event-list");

  if (!monthYearEl || !daysEl || !prevMonthBtn || !nextMonthBtn || !todayBtn || !eventDateEl || !eventListEl) {
    return;
  }

  (async () => {
  await MentorScheduleStore.loadFromApi();

  const state = {
    currentDate: new Date(),
    selectedDate: null,
    activeMentor: resolveInitialMentor()
  };

  if (!state.activeMentor) {
    eventDateEl.textContent = "No mentor schedule available";
    eventListEl.innerHTML = `<div class="no-events">Mentor schedule data could not be loaded from the database.</div>`;
    window.CUACalendar = {
      setMentor: () => {},
      setCourse: () => {},
      refresh: () => {},
      getActiveMentor: () => null
    };
    return;
  }

  setupMentorTabs();
  setupMentorSelect();
  syncMentorDetailsScheduleList();
  updateCalendarLegend();
  renderCalendar();
  resetEventPanel();

  prevMonthBtn.addEventListener("click", () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
    resetEventPanel();
  });

  nextMonthBtn.addEventListener("click", () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
    resetEventPanel();
  });

  todayBtn.addEventListener("click", () => {
    state.currentDate = new Date();
    state.selectedDate = new Date();
    renderCalendar();
    showSchedule(MentorScheduleStore.getDateKey(state.selectedDate));
  });

  window.CUACalendar = {
    setMentor: setActiveMentor,
    setCourse: setActiveCourse,
    refresh: () => {
      renderCalendar();
      if (state.selectedDate) showSchedule(MentorScheduleStore.getDateKey(state.selectedDate));
    },
    getActiveMentor: () => state.activeMentor
  };

  function resolveInitialMentor() {
    const detailMentorName = document.getElementById("mentor-name")?.textContent;
    const mentorSelectValue = document.getElementById("mentor-select")?.value;
    const activeMentorTab = document.querySelector(".mentor-tabs .mentor-tab.active")?.dataset.mentorName;
    const firstBookingMentor = document.querySelector(".booking-card")?.dataset.mentor;

    return MentorScheduleStore.getMentor(detailMentorName) ||
      MentorScheduleStore.getMentor(mentorSelectValue) ||
      MentorScheduleStore.getMentor(activeMentorTab) ||
      MentorScheduleStore.getMentor(firstBookingMentor) ||
      MentorScheduleStore.getDefaultMentor();
  }

  function setupMentorTabs() {
    const tabs = [...document.querySelectorAll(".mentor-tabs .mentor-tab")];
    if (!tabs.length || !tabsAreMentorSelectors(tabs)) return;

    const courseCode = getCourseCodeValue();
    const assignedMentors = document.getElementById("course-info")
      ? MentorScheduleStore.getMentorsForCourse(courseCode)
      : MentorScheduleStore.listMentors();

    tabs.forEach(tab => {
      if (tab.dataset.calendarTabBound === "true") return;

      tab.dataset.calendarTabBound = "true";
      tab.addEventListener("click", () => {
        if (!tab.dataset.mentorName) return;
        setActiveMentor(tab.dataset.mentorName);
        updateMentorSelectValue(tab.dataset.mentorName);
      });
    });

    updateMentorTabs(assignedMentors, state.activeMentor.name);
  }

  function getCourseCodeValue() {
    const courseCodeEl = document.getElementById("course-code");
    if (!courseCodeEl) return "";

    return "value" in courseCodeEl
      ? courseCodeEl.value
      : courseCodeEl.textContent;
  }

  function setActiveCourse(courseCode, preferredMentorName = "", showOnlyPreferredMentor = false) {
    const courseMentors = courseCode
      ? MentorScheduleStore.getMentorsForCourse(courseCode)
      : MentorScheduleStore.listMentors();
    const preferredMentor = MentorScheduleStore.getMentor(preferredMentorName);
    const visibleMentors = showOnlyPreferredMentor && preferredMentor
      ? [preferredMentor]
      : courseMentors;

    updateMentorTabs(visibleMentors, preferredMentorName || state.activeMentor.name);
    renderCalendar();

    if (state.selectedDate) {
      showSchedule(MentorScheduleStore.getDateKey(state.selectedDate));
    } else {
      resetEventPanel();
    }
  }

  function updateMentorTabs(mentors, preferredMentorName = "") {
    const tabs = [...document.querySelectorAll(".mentor-tabs .mentor-tab")];
    if (!tabs.length || !tabsAreMentorSelectors(tabs)) return;

    const usableMentors = mentors.filter(Boolean);
    const selectedMentor = usableMentors.find(mentor => mentor.name === preferredMentorName) ||
      usableMentors[0] ||
      state.activeMentor ||
      MentorScheduleStore.getDefaultMentor();

    tabs.forEach((tab, index) => {
      const mentor = usableMentors[index];
      tab.classList.remove("active");

      if (!mentor) {
        tab.hidden = true;
        delete tab.dataset.mentorName;
        return;
      }

      tab.hidden = false;
      tab.textContent = mentor.name;
      tab.dataset.mentorName = mentor.name;
      tab.classList.toggle("active", mentor.name === selectedMentor.name);
    });

    state.activeMentor = selectedMentor;
  }

  function tabsAreMentorSelectors(tabs) {
    return tabs.every(tab => {
      const label = tab.textContent.trim();
      return /^Mentor\s*\d+$/i.test(label) ||
        Boolean(tab.dataset.mentorName) ||
        Boolean(MentorScheduleStore.getMentor(label));
    });
  }

  function setupMentorSelect() {
    const mentorSelect = document.getElementById("mentor-select");
    if (!mentorSelect) return;

    mentorSelect.addEventListener("change", () => {
      if (mentorSelect.value) {
        setActiveMentor(mentorSelect.value);
      }
    });
  }

  function updateMentorSelectValue(mentorName) {
    const mentorSelect = document.getElementById("mentor-select");
    if (!mentorSelect) return;

    const option = [...mentorSelect.options].find(item => item.value === mentorName || item.textContent === mentorName);
    if (option) mentorSelect.value = option.value;
  }

  function setActiveMentor(mentorName) {
    const mentor = MentorScheduleStore.getMentor(mentorName);
    if (!mentor) return;

    state.activeMentor = mentor;
    updateActiveMentorTab();
    renderCalendar();

    if (state.selectedDate) {
      showSchedule(MentorScheduleStore.getDateKey(state.selectedDate));
    } else {
      resetEventPanel();
    }
  }

  function updateActiveMentorTab() {
    document.querySelectorAll(".mentor-tabs .mentor-tab[data-mentor-name]").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.mentorName === state.activeMentor.name);
    });
  }

  function syncMentorDetailsScheduleList() {
    const scheduleList = document.getElementById("schedule-list");
    const mentorName = document.getElementById("mentor-name")?.textContent;
    const mentor = MentorScheduleStore.getMentor(mentorName);

    if (!scheduleList || !mentor) return;

    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    scheduleList.innerHTML = weekdays.map(day => {
      const shifts = mentor.weeklyAvailability[day] || [];
      const shiftHtml = shifts.length
        ? shifts.map(shift => `<div class="schedule-shift"><span class="schedule-start">${shift.start}</span> - <span class="schedule-end">${shift.end}</span></div>`).join("")
        : `<div class="schedule-shift unavailable">Unavailable</div>`;

      return `<li><strong>${day}:</strong>${shiftHtml}</li>`;
    }).join("");
  }

  function updateCalendarLegend() {
    const legendText = document.querySelector(".event-indicator span");
    if (legendText) legendText.textContent = "Mentor schedule";
  }

  function renderCalendar() {
    const firstDay = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
    const lastDay = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0);
    const prevLastDay = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 0);
    const firstDayIndex = firstDay.getDay();
    const lastDayIndex = lastDay.getDay();
    const nextDays = 7 - lastDayIndex - 1;

    monthYearEl.textContent = `${MentorScheduleStore.monthNames[state.currentDate.getMonth()]} ${state.currentDate.getFullYear()}`;

    let days = "";

    for (let x = firstDayIndex; x > 0; x--) {
      const prevDate = prevLastDay.getDate() - x + 1;
      days += `<div class="day other-month">${prevDate}</div>`;
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), i);
      const dateKey = MentorScheduleStore.getDateKey(date);
      const dayClass = getDayClass(date);
      days += `<div class="${dayClass}" data-date="${dateKey}">${i}</div>`;
    }

    for (let j = 1; j <= nextDays; j++) {
      days += `<div class="day other-month">${j}</div>`;
    }

    daysEl.innerHTML = days;

    document.querySelectorAll(".day:not(.other-month)").forEach(day => {
      day.addEventListener("click", () => {
        const dateStr = day.getAttribute("data-date");
        state.selectedDate = MentorScheduleStore.parseDateKey(dateStr);
        renderCalendar();
        showSchedule(dateStr);
      });
    });
  }

  function getDayClass(date) {
    const today = new Date();
    const key = MentorScheduleStore.getDateKey(date);
    const absences = MentorScheduleStore.getAbsencesForDate(state.activeMentor, key);
    const bookings = MentorScheduleStore.getBookingsForDate(state.activeMentor, key);
    const availableSlots = MentorScheduleStore.getAvailableSlots(state.activeMentor, date);

    let dayClass = "day";

    if (date.toDateString() === today.toDateString()) {
      dayClass += " today";
    }

    if (MentorScheduleStore.isPastDate(date)) {
      dayClass += " is-past";
    }

    if (state.selectedDate && date.toDateString() === state.selectedDate.toDateString()) {
      dayClass += " selected";
    }

    if (MentorScheduleStore.hasScheduleOnDate(state.activeMentor, date)) {
      dayClass += " has-events";
    }

    if (availableSlots.length) {
      dayClass += " has-available-slots";
    }

    if (bookings.length) {
      dayClass += " has-bookings";
    }

    if (absences.some(MentorScheduleStore.isFullDayAbsence)) {
      dayClass += " is-unavailable";
    }

    return dayClass;
  }

  function resetEventPanel() {
    eventDateEl.textContent = `${state.activeMentor.name} schedule`;
    eventListEl.innerHTML = `<div class="no-events">Select a date to view this mentor's availability and booked sessions.</div>`;
  }

  function showSchedule(dateStr) {
    const dateObj = MentorScheduleStore.parseDateKey(dateStr);
    const isPastDate = MentorScheduleStore.isPastDate(dateObj);
    const availability = MentorScheduleStore.getWeeklyAvailability(state.activeMentor, dateObj);
    const availableSlots = MentorScheduleStore.getAvailableSlots(state.activeMentor, dateObj);
    const bookings = MentorScheduleStore.getBookingsForDate(state.activeMentor, dateStr);
    const absences = MentorScheduleStore.getAbsencesForDate(state.activeMentor, dateStr);

    eventDateEl.textContent = `${MentorScheduleStore.formatDateLabel(dateObj)} - ${state.activeMentor.name}`;
    eventListEl.innerHTML = "";

    addScheduleSummary(availability);

    if (isPastDate) {
      addEventItem({
        type: "past",
        time: "Passed",
        text: "This date has already passed and cannot be booked."
      });
    }

    absences.forEach(absence => {
      addEventItem({
        type: "absence",
        time: absence.start === "All day" ? "All day" : `${absence.start} - ${absence.end}`,
        text: `Unavailable: ${absence.reason}`
      });
    });

    bookings.forEach(booking => {
      addEventItem({
        type: "booked",
        time: `${booking.start} - ${booking.end}`,
        text: `${booking.course} with ${booking.student} (${booking.location})`
      });
    });

    availableSlots.forEach(slot => {
      addEventItem({
        type: "available",
        time: `${slot.start} - ${slot.end}`,
        text: canSelectSlots() ? getSelectableSlotText() : "Available",
        slot,
        dateObj
      });
    });

    if (!availability.length && !bookings.length && !absences.length && !isPastDate) {
      eventListEl.innerHTML = `<div class="no-events">${state.activeMentor.name} is not scheduled on this day.</div>`;
    }
  }

  function addScheduleSummary(availability) {
    const summary = document.createElement("div");
    summary.className = "schedule-summary";
    summary.textContent = availability.length
      ? `Scheduled shift: ${availability.map(shift => `${shift.start} - ${shift.end}`).join(", ")}`
      : "No regular shift for this weekday.";
    eventListEl.appendChild(summary);
  }

  function addEventItem({ type, time, text, slot, dateObj }) {
    const eventItem = document.createElement("div");
    eventItem.className = `event-item ${type}-slot`;

    const color = document.createElement("div");
    color.className = `event-color ${type}`;

    const eventTime = document.createElement("div");
    eventTime.className = "event-time";
    eventTime.textContent = time;

    const eventText = document.createElement("div");
    eventText.className = "event-text";
    eventText.textContent = text;

    eventItem.appendChild(color);
    eventItem.appendChild(eventTime);
    eventItem.appendChild(eventText);

    if (type === "available" && canSelectSlots()) {
      eventItem.classList.add("selectable-slot");
      eventItem.addEventListener("click", () => {
        const dateLabel = MentorScheduleStore.formatDateLabel(dateObj);
        const dateKey = MentorScheduleStore.getDateKey(dateObj);

        if (typeof window.CUAHandleCalendarSlot === "function") {
          window.CUAHandleCalendarSlot({
            dateObj,
            dateKey,
            dateLabel,
            slot,
            mentor: state.activeMentor
          });
          return;
        }

        window.openConfirmation(dateLabel, slot.start);
      });
    }

    eventListEl.appendChild(eventItem);
  }

  function canSelectSlots() {
    return typeof window.CUAHandleCalendarSlot === "function" ||
      (typeof window.openConfirmation === "function" &&
        (Boolean(document.getElementById("confirm-selection")) || typeof window.viewEditDateCallback === "function"));
  }

  function getSelectableSlotText() {
    return typeof window.CUAHandleCalendarSlot === "function"
      ? "Available for selection"
      : "Available for booking";
  }
  })();
});

const ViewData = {
    bookingGrid: null,
    bookingCards: [],

    init() {
        this.bookingGrid = document.querySelector('.booking-grid');
        this.bookingCards = Array.from(document.querySelectorAll('.booking-card'));

        this.buildDateGroups();
    },

    parseCardDate(dateString) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed)) return parsed;
        return new Date(dateString.replace(/\s+/g, ' ').trim());
    },

    parseCardTime(timeString) {
        const parsed = new Date(`1970-01-01 ${timeString}`);
        return isNaN(parsed) ? null : parsed;
    },

    formatDateLabel(date) {
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    },

    buildDateGroups() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const grouped = new Map();

        this.bookingCards.forEach(card => {
            const cardDate = this.parseCardDate(card.dataset.date);
            if (isNaN(cardDate)) return card.style.display = 'none';

            cardDate.setHours(0, 0, 0, 0);
            if (cardDate < today) return card.style.display = 'none';

            const key = cardDate.toISOString().slice(0, 10);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(card);
        });

        if (!grouped.size) {
            this.bookingGrid.innerHTML = '<div class="no-bookings">No upcoming bookings available.</div>';
            return;
        }

        const sortedDates = Array.from(grouped.keys()).sort();
        this.bookingGrid.innerHTML = '';

        sortedDates.forEach(dateKey => {
            const [year, month, day] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1, day);

            const group = document.createElement('div');
            group.className = 'booking-date-group';

            const label = document.createElement('div');
            label.className = 'booking-date-label';
            label.textContent = this.formatDateLabel(date);
            group.appendChild(label);

            const cardsRow = document.createElement('div');
            cardsRow.className = 'booking-date-cards';

            grouped.get(dateKey)
                .sort((a, b) => {
                    const aTime = this.parseCardTime(a.dataset.time);
                    const bTime = this.parseCardTime(b.dataset.time);
                    if (aTime && bTime) return aTime - bTime;
                    return a.dataset.time.localeCompare(b.dataset.time, undefined, { numeric: true });
                })
                .forEach(card => {
                    card.style.display = '';
                    cardsRow.appendChild(card);
                });

            group.appendChild(cardsRow);
            this.bookingGrid.appendChild(group);
        });
    }
};
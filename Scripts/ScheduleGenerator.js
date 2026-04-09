// ScheduleGenerator.js

const ScheduleGenerator = {

    // Generate 30-minute increments between two times
    generateTimeOptions(start, end) {
        const times = [];
        let current = new Date(`2000-01-01T${start}:00`);
        const endTime = new Date(`2000-01-01T${end}:00`);

        while (current <= endTime) {
            const formatted = current.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });
            times.push(formatted);
            current.setMinutes(current.getMinutes() + 30);
        }

        return times;
    },

    // Remove booked/busy times from a list
    removeBusyTimes(allTimes, busyTimes) {
        return allTimes.filter(t => !busyTimes.includes(t));
    },

    // Generate a mentor's available times for a specific day
    generateDailySchedule(mentorSchedule, dayName) {
        const day = mentorSchedule[dayName];
        if (!day) return [];

        return this.generateTimeOptions(day.start, day.end);
    }
};

export default ScheduleGenerator;
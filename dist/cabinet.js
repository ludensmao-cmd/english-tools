const requestedRole = new URLSearchParams(location.search).get('role');
const role = requestedRole === 'teacher' ? 'teacher' : 'student';
const destination = `/lessons/?role=${role}`;
const link = document.getElementById('cabinet-destination');
if (link) {
  link.href = destination;
  link.textContent = `Открыть кабинет ${role === 'teacher' ? 'преподавателя' : 'ученика'}`;
}
location.replace(destination);

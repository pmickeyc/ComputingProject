document.addEventListener('DOMContentLoaded', async () => {
    const gradesTableBody = document.querySelector('#grades-table tbody');

    try {
        const response = await fetch('/api/user-grades');
        const courses = await response.json();

        courses.forEach(course => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${course.Title}</td>
                <td>${course.Description}</td>
                <td>${course.Progress}%</td>
            `;
            gradesTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching course grades:', error);
    }
});
